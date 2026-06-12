import {
  Component,
  OnDestroy,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import maplibregl, { Map, MapGeoJSONFeature, MapMouseEvent } from 'maplibre-gl';
import { forkJoin, of } from 'rxjs';
import type { FeatureCollection, Feature } from 'geojson';
import { LayerControlComponent } from '../layer-control/layer-control.component';
import { FeaturePanelComponent } from '../feature-panel/feature-panel.component';
import { StackInfoComponent } from '../stack-info/stack-info.component';
import { GeocoderComponent, type GeocoderResult } from '../geocoder/geocoder.component';
import { MapService } from '../../services/map.service';
import { FeaturesService } from '../../services/features.service';
import { LayerService } from '../../services/layer.service';
import { ParcelSelectionService } from '../../services/parcel-selection.service';
import { BASEMAPS, RASTER_BASE_STYLE } from '../../config/basemaps.config';
import type { SelectedFeature } from '../../models/layer.model';

const NZ_BOUNDS: maplibregl.LngLatBoundsLike = [165, -47, 178, -34];
const CLICKABLE_LAYERS = ['parcels-hit', 'buildings-fill', 'flood-fill', 'meshblocks-fill', 'ta-boundaries'];

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [LayerControlComponent, FeaturePanelComponent, StackInfoComponent, GeocoderComponent],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapComponent implements OnDestroy {
  private mapService = inject(MapService);
  private featuresService = inject(FeaturesService);
  private layerService = inject(LayerService);
  private parcelSelection = inject(ParcelSelectionService);

  mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');

  selectedFeature = signal<SelectedFeature | null>(null);
  activeBasemap = signal<string>('linz');
  subjectPropertyId = signal<string | number | null>(null);
  layerVisibility = signal<Record<string, boolean>>({
    meshblocks: false,
    'ta-boundaries': false,
    parcels: false,
    buildings: false,
    flood: false,
    census: false,
  });

  censusMetric = signal<'density' | 'ownership' | 'mould'>('density');

  readonly basemaps = BASEMAPS;

  private map: Map | null = null;
  private interactionsReady = false;
  private geocoderMarker: maplibregl.Marker | null = null;
  private subjectData: FeatureCollection = { type: 'FeatureCollection', features: [] };

  constructor() {
    afterNextRender(() => this.initMap());
  }

  private initMap(): void {
    this.map = new Map({
      container: this.mapContainer().nativeElement,
      style: RASTER_BASE_STYLE,
      center: [174.0, -41.3],
      zoom: 5,
      attributionControl: { compact: true },
    });
    this.map.fitBounds(NZ_BOUNDS, { padding: 20, animate: false });
    this.map.on('style.load', () => this.onStyleLoad());
  }

  private onStyleLoad(): void {
    if (!this.map) return;
    const bm = BASEMAPS.find((b) => b.id === this.activeBasemap())!;
    this.layerService.addSourcesAndLayers(this.map, bm, this.subjectData, this.parcelSelection.currentId);
    this.layerService.applyVisibility(this.map, this.layerVisibility());

    if (!this.interactionsReady) {
      this.setupInteractions();
      this.interactionsReady = true;
      this.mapService.setMap(this.map);
    }
  }

  private setupInteractions(): void {
    if (!this.map) return;
    let hoveredParcelId: string | number | null = null;

    this.map.on('mousemove', 'parcels-hit', (e) => {
      if (!this.map || !e.features?.length) return;
      this.map.getCanvas().style.cursor = 'pointer';
      const fid = e.features[0].id;
      if (fid != null && fid !== hoveredParcelId) {
        if (hoveredParcelId != null) {
          this.map.setFeatureState({ source: 'parcels', sourceLayer: 'nz_parcels', id: hoveredParcelId }, { hover: false });
        }
        hoveredParcelId = fid;
        this.map.setFeatureState({ source: 'parcels', sourceLayer: 'nz_parcels', id: fid }, { hover: true });
      }
    });

    this.map.on('mouseleave', 'parcels-hit', () => {
      if (!this.map) return;
      this.map.getCanvas().style.cursor = '';
      if (hoveredParcelId != null) {
        this.map.setFeatureState({ source: 'parcels', sourceLayer: 'nz_parcels', id: hoveredParcelId }, { hover: false });
        hoveredParcelId = null;
      }
    });

    CLICKABLE_LAYERS.forEach((layer) => {
      this.map!.on('click', layer, (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        if (!e.features?.length) return;
        const f = e.features[0];
        this.selectedFeature.set({
          properties: f.properties as Record<string, unknown>,
          sourceLayer: f.sourceLayer ?? '',
          source: f.source,
          id: f.id,
          lngLat: { lng: e.lngLat.lng, lat: e.lngLat.lat },
        });
        if (layer === 'parcels-hit') {
          this.parcelSelection.select(this.map!, f, e.lngLat, () => this.selectedFeature.set(null));
          this.fetchTitleForParcel(f.properties as Record<string, unknown>, f.id);
        }
      });
    });

    this.map.on('click', (e: MapMouseEvent) => {
      const hit = this.map!.queryRenderedFeatures(e.point, { layers: CLICKABLE_LAYERS });
      if (!hit.length) {
        this.parcelSelection.clear(this.map!);
        this.selectedFeature.set(null);
      }
    });
  }

  onLayerToggle(layerId: string): void {
    if (!this.map) return;
    const current = this.layerVisibility();
    this.layerVisibility.set({ ...current, [layerId]: !current[layerId] });
    this.layerService.applyVisibility(this.map, this.layerVisibility());
  }

  onBasemapChange(basemapId: string): void {
    if (!this.map || basemapId === this.activeBasemap()) return;
    this.activeBasemap.set(basemapId);
    const bm = BASEMAPS.find((b) => b.id === basemapId)!;
    this.map.setStyle(bm.type === 'vector' ? bm.styleUrl! : RASTER_BASE_STYLE);
    // style.load fires → onStyleLoad() re-adds all sources/layers
  }

  onSetSubjectProperty(): void {
    const feature = this.selectedFeature();
    if (!feature || feature.source !== 'parcels') return;
    this.subjectPropertyId.set(feature.id ?? null);

    this.featuresService.getFeature('public.nz_parcels', String(feature.id)).subscribe({
      next: (f) => {
        this.subjectData = { type: 'FeatureCollection', features: [f as unknown as Feature] };
        const source = this.map?.getSource('subject-property') as maplibregl.GeoJSONSource | undefined;
        source?.setData(this.subjectData);
      },
      error: () => {},
    });
  }

  private fetchTitleForParcel(props: Record<string, unknown>, featureId?: string | number): void {
    const titleRef = String(props['titles'] ?? '').split(',')[0].trim();
    const fid = Number(featureId ?? 0);

    const title$ = titleRef
      ? this.featuresService.getTitleByRef(titleRef)
      : of(null);
    const addresses$ = fid
      ? this.featuresService.getParcelAddresses(fid)
      : of([] as string[]);

    forkJoin({ title: title$, addresses: addresses$ }).subscribe({
      next: ({ title, addresses }) =>
        this.parcelSelection.enrich(title?.properties ?? null, addresses),
      error: () => this.parcelSelection.enrich(null, []),
    });
  }

  onCensusMetricChange(metric: 'density' | 'ownership' | 'mould'): void {
    this.censusMetric.set(metric);
    if (!this.map) return;
    this.layerService.updateCensusMetric(this.map, metric);
  }

  onGeocoderSelected(result: GeocoderResult): void {
    if (!this.map) return;
    this.geocoderMarker?.remove();
    this.geocoderMarker = new maplibregl.Marker({ color: '#00d4aa' })
      .setLngLat([result.lng, result.lat])
      .addTo(this.map);
    this.map.flyTo({ center: [result.lng, result.lat], zoom: 17, duration: 1200 });
  }

  ngOnDestroy(): void {
    this.geocoderMarker?.remove();
    this.mapService.destroy();
  }
}
