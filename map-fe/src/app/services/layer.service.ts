import { Injectable } from '@angular/core';
import type { Map } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { BasemapConfig } from '../config/basemaps.config';

const MARTIN = 'http://localhost:7100';

const LAYER_VISIBILITY_MAP: Record<string, string[]> = {
  meshblocks: ['meshblocks-fill', 'meshblocks-outline'],
  'ta-boundaries': ['ta-boundaries', 'ta-labels'],
  parcels: ['parcels-fill', 'parcels-outline'],
  buildings: ['buildings-fill', 'buildings-outline'],
};

@Injectable({ providedIn: 'root' })
export class LayerService {
  addSourcesAndLayers(
    map: Map,
    basemap: BasemapConfig,
    subjectData: FeatureCollection,
    selectedParcelId: string | number | null,
  ): void {
    if (basemap.type === 'raster') {
      map.addSource('raster-basemap', {
        type: 'raster',
        tiles: [basemap.tileUrl!],
        tileSize: 256,
        attribution: basemap.attribution ?? '',
      });
      map.addLayer({ id: 'raster-basemap', type: 'raster', source: 'raster-basemap' });
    }

    map.addSource('meshblocks', { type: 'vector', url: `${MARTIN}/nz-meshblocks` });
    map.addSource('territorial-authorities', { type: 'vector', url: `${MARTIN}/nz_territorial_authorities` });
    map.addSource('ta-labels', { type: 'vector', url: `${MARTIN}/nz_ta_labels` });
    map.addSource('parcels', { type: 'vector', url: `${MARTIN}/nz_parcels` });
    map.addSource('buildings', { type: 'vector', url: `${MARTIN}/nz-buildings` });
    map.addSource('subject-property', { type: 'geojson', data: subjectData });

    map.addLayer({
      id: 'meshblocks-fill', type: 'fill', source: 'meshblocks',
      'source-layer': 'nz_meshblocks', minzoom: 6, maxzoom: 14,
      paint: { 'fill-color': '#4a90d9', 'fill-opacity': 0.08 },
    });
    map.addLayer({
      id: 'meshblocks-outline', type: 'line', source: 'meshblocks',
      'source-layer': 'nz_meshblocks', minzoom: 6, maxzoom: 14,
      paint: { 'line-color': '#4a90d9', 'line-width': 0.5, 'line-opacity': 0.4 },
    });

    map.addLayer({
      id: 'ta-boundaries', type: 'line', source: 'territorial-authorities',
      'source-layer': 'nz_territorial_authorities', minzoom: 4, maxzoom: 12,
      paint: { 'line-color': '#e8c547', 'line-width': 1.5, 'line-opacity': 0.8 },
    });
    map.addLayer({
      id: 'ta-labels', type: 'symbol', source: 'ta-labels',
      'source-layer': 'nz_ta_labels', minzoom: 5, maxzoom: 12,
      layout: {
        'text-field': ['coalesce', ['get', 'ta_name'], ['get', 'ta2023_v1_00_name'], ['get', 'ta2019_v1_00_name'], ''],
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

    map.addLayer({
      id: 'parcels-fill', type: 'fill', source: 'parcels',
      'source-layer': 'nz_parcels', minzoom: 12,
      paint: { 'fill-color': '#6eb5ff', 'fill-opacity': 0.15 },
    });
    map.addLayer({
      id: 'parcels-outline', type: 'line', source: 'parcels',
      'source-layer': 'nz_parcels', minzoom: 12,
      paint: { 'line-color': '#6eb5ff', 'line-width': 0.8 },
    });

    map.addLayer({
      id: 'buildings-fill', type: 'fill', source: 'buildings',
      'source-layer': 'nz_buildings', minzoom: 14,
      paint: { 'fill-color': '#f2b27a', 'fill-opacity': 0.45 },
    });
    map.addLayer({
      id: 'buildings-outline', type: 'line', source: 'buildings',
      'source-layer': 'nz_buildings', minzoom: 14,
      paint: { 'line-color': '#e08a3c', 'line-width': 0.6 },
    });

    // Always-on hit layer: transparent until hover/selected state is applied.
    map.addLayer({
      id: 'parcels-hit', type: 'fill', source: 'parcels',
      'source-layer': 'nz_parcels', minzoom: 12,
      paint: {
        'fill-color': '#00d4aa',
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 0.4,
          ['boolean', ['feature-state', 'hover'], false], 0.25,
          0,
        ],
      },
    });
    map.addLayer({
      id: 'parcels-hit-outline', type: 'line', source: 'parcels',
      'source-layer': 'nz_parcels', minzoom: 12,
      paint: {
        'line-color': '#00d4aa',
        'line-width': 2.5,
        'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0],
      },
    });

    map.addLayer({
      id: 'subject-property-fill', type: 'fill', source: 'subject-property',
      paint: { 'fill-color': '#00d4aa', 'fill-opacity': 0.35 },
    });
    map.addLayer({
      id: 'subject-property-outline', type: 'line', source: 'subject-property',
      paint: { 'line-color': '#00d4aa', 'line-width': 2.5 },
    });

    if (selectedParcelId != null) {
      map.setFeatureState(
        { source: 'parcels', sourceLayer: 'nz_parcels', id: selectedParcelId },
        { selected: true },
      );
    }
  }

  applyVisibility(map: Map, visibility: Record<string, boolean>): void {
    for (const [groupId, layers] of Object.entries(LAYER_VISIBILITY_MAP)) {
      const value = visibility[groupId] ? 'visible' : 'none';
      layers.forEach((l) => {
        if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', value);
      });
    }
  }
}
