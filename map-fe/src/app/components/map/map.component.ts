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
import maplibregl, { Map, MapGeoJSONFeature, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import { LayerControlComponent } from '../layer-control/layer-control.component';
import { FeaturePanelComponent } from '../feature-panel/feature-panel.component';
import { StackInfoComponent } from '../stack-info/stack-info.component';
import { MapService } from '../../services/map.service';
import { FeaturesService } from '../../services/features.service';
import type { SelectedFeature } from '../../models/layer.model';

const LINZ_KEY = '';
const NZ_BOUNDS: maplibregl.LngLatBoundsLike = [165, -47, 178, -34];

interface BasemapConfig {
  id: string;
  label: string;
  type: 'raster' | 'vector';
  tileUrl?: string;
  styleUrl?: string;
  attribution?: string;
}

const BASEMAPS: BasemapConfig[] = [
  {
    id: 'linz',
    label: 'LINZ Aerial',
    type: 'raster',
    tileUrl: `https://basemaps.linz.govt.nz/v1/tiles/aerial/EPSG:3857/{z}/{x}/{y}.webp?api=${LINZ_KEY}`,
    attribution: '© LINZ',
  },
  {
    id: 'osm',
    label: 'OSM',
    type: 'raster',
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },
  {
    id: 'dark',
    label: 'Dark',
    type: 'vector',
    styleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  {
    id: 'positron',
    label: 'Positron',
    type: 'vector',
    styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
];

const RASTER_BASE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [],
};

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [LayerControlComponent, FeaturePanelComponent, StackInfoComponent],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapComponent implements OnDestroy {
  private mapService = inject(MapService);
  private featuresService = inject(FeaturesService);

  mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');

  selectedFeature = signal<SelectedFeature | null>(null);
  activeBasemap = signal<string>('linz');
  subjectPropertyId = signal<string | number | null>(null);
  layerVisibility = signal<Record<string, boolean>>({
    meshblocks: false,
    'ta-boundaries': false,
    parcels: false,
  });

  readonly basemaps = BASEMAPS;

  private map: Map | null = null;
  private interactionsReady = false;
  private selectedParcelId: string | number | null = null;
  private popup: maplibregl.Popup | null = null;
  private suppressPopupClose = false;
  private subjectData: { type: 'FeatureCollection'; features: unknown[] } = {
    type: 'FeatureCollection',
    features: [],
  };

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
    this.addSourcesAndLayers();

    if (!this.interactionsReady) {
      this.setupInteractions();
      this.interactionsReady = true;
      this.mapService.setMap(this.map);
    }
  }

  private addSourcesAndLayers(): void {
    if (!this.map) return;
    const bm = BASEMAPS.find((b) => b.id === this.activeBasemap())!;

    // ── Raster basemap (only when style is bare) ─────────────
    if (bm.type === 'raster') {
      this.map.addSource('raster-basemap', {
        type: 'raster',
        tiles: [bm.tileUrl!],
        tileSize: 256,
        attribution: bm.attribution ?? '',
      });
      this.map.addLayer({ id: 'raster-basemap', type: 'raster', source: 'raster-basemap' });
    }

    // ── Data sources ─────────────────────────────────────────
    this.map.addSource('meshblocks', {
      type: 'vector',
      url: 'http://localhost:7100/nz-meshblocks',
    });
    this.map.addSource('territorial-authorities', {
      type: 'vector',
      url: 'http://localhost:7100/nz_territorial_authorities',
    });
    this.map.addSource('ta-labels', {
      type: 'vector',
      url: 'http://localhost:7100/nz_ta_labels',
    });
    this.map.addSource('parcels', {
      type: 'vector',
      url: 'http://localhost:7100/nz_parcels',
    });
    this.map.addSource('subject-property', {
      type: 'geojson',
      data: this.subjectData as never,
    });

    // ── Data layers (above basemap) ───────────────────────────
    this.map.addLayer({
      id: 'meshblocks-fill',
      type: 'fill',
      source: 'meshblocks',
      'source-layer': 'nz_meshblocks',
      minzoom: 6,
      maxzoom: 14,
      paint: { 'fill-color': '#4a90d9', 'fill-opacity': 0.08 },
    });
    this.map.addLayer({
      id: 'meshblocks-outline',
      type: 'line',
      source: 'meshblocks',
      'source-layer': 'nz_meshblocks',
      minzoom: 6,
      maxzoom: 14,
      paint: { 'line-color': '#4a90d9', 'line-width': 0.5, 'line-opacity': 0.4 },
    });

    this.map.addLayer({
      id: 'ta-boundaries',
      type: 'line',
      source: 'territorial-authorities',
      'source-layer': 'nz_territorial_authorities',
      minzoom: 4,
      maxzoom: 12,
      paint: { 'line-color': '#e8c547', 'line-width': 1.5, 'line-opacity': 0.8 },
    });
    this.map.addLayer({
      id: 'ta-labels',
      type: 'symbol',
      source: 'ta-labels',
      'source-layer': 'nz_ta_labels',
      minzoom: 5,
      maxzoom: 12,
      layout: {
        'text-field': [
          'coalesce',
          ['get', 'ta_name'],
          ['get', 'ta2023_v1_00_name'],
          ['get', 'ta2019_v1_00_name'],
          '',
        ],
        'text-size': 13,
        'text-font': ['Open Sans Semibold', 'Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-max-width': 10,
        'text-letter-spacing': 0.04,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'symbol-placement': 'point',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0, 0, 0, 0.75)',
        'text-halo-width': 1.5,
        'text-halo-blur': 0.5,
      },
    });

    // Visual "show all parcels" layers — toggled on/off by the layer control.
    this.map.addLayer({
      id: 'parcels-fill',
      type: 'fill',
      source: 'parcels',
      'source-layer': 'nz_parcels',
      minzoom: 12,
      paint: {
        'fill-color': '#6eb5ff',
        'fill-opacity': 0.15,
      },
    });
    this.map.addLayer({
      id: 'parcels-outline',
      type: 'line',
      source: 'parcels',
      'source-layer': 'nz_parcels',
      minzoom: 12,
      paint: {
        'line-color': '#6eb5ff',
        'line-width': 0.8,
      },
    });

    // Transparent hit layer — always visible (never toggled), so clicking and
    // hovering parcels works whether or not the visual layer is shown. It also
    // renders the hover/selected highlight, keeping it consistent in both states.
    this.map.addLayer({
      id: 'parcels-hit',
      type: 'fill',
      source: 'parcels',
      'source-layer': 'nz_parcels',
      minzoom: 12,
      paint: {
        'fill-color': '#00d4aa',
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          0.4,
          ['boolean', ['feature-state', 'hover'], false],
          0.25,
          0,
        ],
      },
    });
    this.map.addLayer({
      id: 'parcels-hit-outline',
      type: 'line',
      source: 'parcels',
      'source-layer': 'nz_parcels',
      minzoom: 12,
      paint: {
        'line-color': '#00d4aa',
        'line-width': 2.5,
        'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0],
      },
    });

    this.map.addLayer({
      id: 'subject-property-fill',
      type: 'fill',
      source: 'subject-property',
      paint: { 'fill-color': '#00d4aa', 'fill-opacity': 0.35 },
    });
    this.map.addLayer({
      id: 'subject-property-outline',
      type: 'line',
      source: 'subject-property',
      paint: { 'line-color': '#00d4aa', 'line-width': 2.5 },
    });

    if (this.selectedParcelId != null) {
      this.map.setFeatureState(
        { source: 'parcels', sourceLayer: 'nz_parcels', id: this.selectedParcelId },
        { selected: true },
      );
    }

    this.applyLayerVisibility();
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
          this.map.setFeatureState(
            { source: 'parcels', sourceLayer: 'nz_parcels', id: hoveredParcelId },
            { hover: false },
          );
        }
        hoveredParcelId = fid;
        this.map.setFeatureState(
          { source: 'parcels', sourceLayer: 'nz_parcels', id: fid },
          { hover: true },
        );
      }
    });

    this.map.on('mouseleave', 'parcels-hit', () => {
      if (!this.map) return;
      this.map.getCanvas().style.cursor = '';
      if (hoveredParcelId != null) {
        this.map.setFeatureState(
          { source: 'parcels', sourceLayer: 'nz_parcels', id: hoveredParcelId },
          { hover: false },
        );
        hoveredParcelId = null;
      }
    });

    const clickableLayers = ['parcels-hit', 'meshblocks-fill', 'ta-boundaries'];
    clickableLayers.forEach((layer) => {
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
        if (layer === 'parcels-hit') this.selectParcel(f, e.lngLat);
      });
    });

    this.map.on('click', (e: MapMouseEvent) => {
      const hit = this.map!.queryRenderedFeatures(e.point, { layers: clickableLayers });
      if (!hit.length) this.clearParcelSelection();
    });
  }

  private selectParcel(f: MapGeoJSONFeature, lngLat: maplibregl.LngLat): void {
    if (!this.map) return;

    if (this.selectedParcelId != null) {
      this.map.setFeatureState(
        { source: 'parcels', sourceLayer: 'nz_parcels', id: this.selectedParcelId },
        { selected: false },
      );
    }

    const fid = f.id ?? null;
    this.selectedParcelId = fid;
    if (fid != null) {
      this.map.setFeatureState(
        { source: 'parcels', sourceLayer: 'nz_parcels', id: fid },
        { selected: true },
      );
    }

    // Replace any existing popup without triggering its close → clear.
    this.suppressPopupClose = true;
    this.popup?.remove();
    this.suppressPopupClose = false;

    this.popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      className: 'parcel-popup',
      maxWidth: '280px',
      offset: 8,
    })
      .setLngLat(lngLat)
      .setHTML(this.buildParcelPopupHtml(f.properties as Record<string, unknown>))
      .addTo(this.map);

    this.popup.on('close', () => {
      if (this.suppressPopupClose) return;
      this.clearParcelSelection();
    });
  }

  private clearParcelSelection(): void {
    this.selectedFeature.set(null);
    if (this.map && this.selectedParcelId != null) {
      this.map.setFeatureState(
        { source: 'parcels', sourceLayer: 'nz_parcels', id: this.selectedParcelId },
        { selected: false },
      );
    }
    this.selectedParcelId = null;
    if (this.popup) {
      this.suppressPopupClose = true;
      this.popup.remove();
      this.popup = null;
      this.suppressPopupClose = false;
    }
  }

  private buildParcelPopupHtml(props: Record<string, unknown>): string {
    const row = (label: string, value: unknown): string =>
      `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;padding:3px 0;">
         <span style="color:#9aa6c0;">${label}</span>
         <span style="color:#e8edf7;font-weight:500;text-align:right;">${this.esc(value)}</span>
       </div>`;
    const area = props['calc_area'] != null ? `${props['calc_area']} m²` : '—';
    return `<div style="font-family:Inter,system-ui,sans-serif;min-width:190px;">
      <div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:8px;padding-right:14px;">
        ${this.esc(props['appellation'])}
      </div>
      ${row('Title', props['titles'])}
      ${row('Survey', props['affected_surveys'])}
      ${row('District', props['land_district'])}
      ${row('Area', area)}
    </div>`;
  }

  private esc(value: unknown): string {
    if (value == null || value === '') return '—';
    return String(value).replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
    );
  }

  private applyLayerVisibility(): void {
    if (!this.map) return;
    const vis = this.layerVisibility();
    const layerMap: Record<string, string[]> = {
      meshblocks: ['meshblocks-fill', 'meshblocks-outline'],
      'ta-boundaries': ['ta-boundaries', 'ta-labels'],
      parcels: ['parcels-fill', 'parcels-outline'],
    };
    for (const [groupId, mapLayers] of Object.entries(layerMap)) {
      const visibility = vis[groupId] ? 'visible' : 'none';
      mapLayers.forEach((l) => {
        if (this.map!.getLayer(l)) this.map!.setLayoutProperty(l, 'visibility', visibility);
      });
    }
  }

  onLayerToggle(layerId: string): void {
    if (!this.map) return;
    const current = this.layerVisibility();
    this.layerVisibility.set({ ...current, [layerId]: !current[layerId] });
    this.applyLayerVisibility();
  }

  onBasemapChange(basemapId: string): void {
    if (!this.map || basemapId === this.activeBasemap()) return;
    this.activeBasemap.set(basemapId);

    const bm = BASEMAPS.find((b) => b.id === basemapId)!;
    const style: StyleSpecification | string =
      bm.type === 'vector' ? bm.styleUrl! : RASTER_BASE_STYLE;

    this.map.setStyle(style);
    // style.load fires → onStyleLoad() → addSourcesAndLayers() with new basemap
  }

  onSetSubjectProperty(): void {
    const feature = this.selectedFeature();
    if (!feature || feature.source !== 'parcels') return;

    this.subjectPropertyId.set(feature.id ?? null);

    this.featuresService.getFeature('public.nz_parcels', String(feature.id)).subscribe({
      next: (f) => {
        this.subjectData = { type: 'FeatureCollection', features: [f as unknown as object] };
        const source = this.map?.getSource('subject-property') as
          | maplibregl.GeoJSONSource
          | undefined;
        source?.setData(this.subjectData as never);
      },
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    this.popup?.remove();
    this.mapService.destroy();
  }
}
