import { Injectable } from '@angular/core';
import maplibregl, { type Map } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { BasemapConfig } from '../config/basemaps.config';

const MARTIN = 'http://localhost:7100';

type CensusMetric = 'density' | 'ownership' | 'mould';

const CENSUS_PAINT: Record<CensusMetric, maplibregl.FillLayerSpecification['paint']> = {
  density: {
    'fill-color': [
      'step', ['coalesce', ['get', 'var_4_24'], 0],
      '#f0f9ff', 1, '#bae6fd', 10, '#7dd3fc', 50, '#38bdf8',
      100, '#0ea5e9', 250, '#0284c7', 500, '#0369a1', 1000, '#075985',
    ],
    'fill-opacity': 0.7,
  },
  ownership: {
    'fill-color': [
      'step', ['coalesce', ['get', 'var_2_3'], 0],
      '#fef9c3', 50, '#fde68a', 60, '#fbbf24', 70, '#f59e0b',
      75, '#84cc16', 80, '#22c55e', 85, '#16a34a', 90, '#15803d',
    ],
    'fill-opacity': 0.7,
  },
  mould: {
    'fill-color': [
      'step', ['coalesce', ['get', 'var_3_2'], 0],
      '#f0fdf4', 10, '#bbf7d0', 20, '#86efac', 30, '#4ade80',
      40, '#f97316', 50, '#ef4444', 60, '#b91c1c',
    ],
    'fill-opacity': 0.7,
  },
};

const LAYER_VISIBILITY_MAP: Record<string, string[]> = {
  meshblocks: ['meshblocks-fill', 'meshblocks-outline'],
  'ta-boundaries': ['ta-boundaries', 'ta-labels'],
  parcels: ['parcels-fill', 'parcels-outline'],
  buildings: ['buildings-fill', 'buildings-outline'],
  flood: ['flood-fill', 'flood-outline'],
  census: ['census-fill', 'census-outline', 'census-labels'],
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
    map.addSource('flood', { type: 'vector', url: `${MARTIN}/auckland_flood` });
    map.addSource('sa2-census', { type: 'vector', url: `${MARTIN}/nz_sa2_census` });
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

    // Auckland flood plains — color by return period (rainfall_event).
    map.addLayer({
      id: 'flood-fill', type: 'fill', source: 'flood',
      'source-layer': 'auckland_flood', minzoom: 9,
      paint: {
        'fill-color': [
          'step', ['coalesce', ['get', 'rainfall_event'], 0],
          '#93c5fd',   // default / < 10yr
          10,  '#60a5fa',   // 10-year
          50,  '#3b82f6',   // 50-year
          100, '#1d4ed8',   // 100-year
          500, '#1e3a8a',   // 500-year+
        ],
        'fill-opacity': 0.45,
      },
    });
    map.addLayer({
      id: 'flood-outline', type: 'line', source: 'flood',
      'source-layer': 'auckland_flood', minzoom: 9,
      paint: { 'line-color': '#3b82f6', 'line-width': 0.5, 'line-opacity': 0.6 },
    });

    // SA2 census choropleth — metric swapped at runtime via updateCensusMetric().
    map.addLayer({
      id: 'census-fill', type: 'fill', source: 'sa2-census',
      'source-layer': 'nz_sa2_census', minzoom: 4,
      paint: CENSUS_PAINT['density'],
    });
    map.addLayer({
      id: 'census-outline', type: 'line', source: 'sa2-census',
      'source-layer': 'nz_sa2_census', minzoom: 4,
      paint: { 'line-color': 'rgba(255,255,255,0.15)', 'line-width': 0.5 },
    });
    map.addLayer({
      id: 'census-labels', type: 'symbol', source: 'sa2-census',
      'source-layer': 'nz_sa2_census', minzoom: 9,
      layout: {
        'text-field': ['get', 'sa22023_v1_00_name'],
        'text-size': 11,
        'text-font': ['Open Sans Semibold', 'Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-max-width': 8,
      },
      paint: {
        'text-color': '#fff',
        'text-halo-color': 'rgba(0,0,0,0.6)',
        'text-halo-width': 1.2,
      },
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

  updateCensusMetric(map: Map, metric: CensusMetric): void {
    if (!map.getLayer('census-fill')) return;
    const paint = CENSUS_PAINT[metric];
    map.setPaintProperty('census-fill', 'fill-color', paint!['fill-color']);
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
