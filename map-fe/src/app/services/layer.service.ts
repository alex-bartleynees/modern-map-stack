import { Injectable } from '@angular/core';
import maplibregl, { type Map } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { BasemapConfig } from '../config/basemaps.config';

const MARTIN = '/tiles';

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

const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

const LAYER_VISIBILITY_MAP: Record<string, string[]> = {
  meshblocks: ['meshblocks-fill', 'meshblocks-outline'],
  'ta-boundaries': ['ta-boundaries', 'ta-labels'],
  contours: ['contours-index', 'contours-minor', 'contours-label'],
  suburbs: ['suburbs-fill', 'suburbs-outline', 'suburbs-label'],
  parcels: ['parcels-fill', 'parcels-outline'],
  buildings: ['buildings-fill', 'buildings-outline', 'buildings-extrusion'],
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
    // Terrain DEM (always registered; only activated when 3D mode is on).
    map.addSource('terrain-dem', {
      type: 'raster-dem',
      tiles: [TERRAIN_TILES],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
      attribution: 'Terrain © Mapzen / AWS',
    });

    // Sky layer — rendered first so it sits behind everything when the camera is pitched.
    map.addLayer({
      id: 'sky',
      type: 'sky',
      layout: { visibility: 'none' },
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0.0, 90.0],
        'sky-atmosphere-sun-intensity': 15,
      },
    } as unknown as maplibregl.LayerSpecification);

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
    map.addSource('contours', { type: 'vector', url: `${MARTIN}/nz-contours` });
    map.addSource('suburbs', { type: 'vector', url: `${MARTIN}/nz-suburbs` });
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

    // 100m index contours — visible from z10 (PMTiles min zoom; z8 tiles too dense for NZ)
    map.addLayer({
      id: 'contours-index', type: 'line', source: 'contours',
      'source-layer': 'nz_contours', minzoom: 10,
      filter: ['==', ['%', ['to-number', ['get', 'elevation']], 100], 0],
      paint: {
        'line-color': '#d4783c',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.0, 14, 1.8],
        'line-opacity': 0.9,
      },
    });
    // Minor contours — only shown when zoomed in enough to be readable
    map.addLayer({
      id: 'contours-minor', type: 'line', source: 'contours',
      'source-layer': 'nz_contours', minzoom: 11,
      filter: ['!=', ['%', ['to-number', ['get', 'elevation']], 100], 0],
      paint: {
        'line-color': '#c47840',
        'line-width': 0.7,
        'line-opacity': 0.65,
      },
    });
    // Elevation labels on index contours from z12
    map.addLayer({
      id: 'contours-label', type: 'symbol', source: 'contours',
      'source-layer': 'nz_contours', minzoom: 12,
      filter: ['==', ['%', ['to-number', ['get', 'elevation']], 100], 0],
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'elevation']], 'm'],
        'text-size': 10,
        'text-font': ['Open Sans Semibold', 'Open Sans Regular', 'Arial Unicode MS Regular'],
        'symbol-placement': 'line',
        'text-max-angle': 30,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#d4783c',
        'text-halo-color': 'rgba(255,255,255,0.85)',
        'text-halo-width': 1.5,
      },
    });

    map.addLayer({
      id: 'suburbs-fill', type: 'fill', source: 'suburbs',
      'source-layer': 'nz_suburbs', minzoom: 7, maxzoom: 14,
      paint: { 'fill-color': '#a78bfa', 'fill-opacity': 0.08 },
    });
    map.addLayer({
      id: 'suburbs-outline', type: 'line', source: 'suburbs',
      'source-layer': 'nz_suburbs', minzoom: 7, maxzoom: 14,
      paint: { 'line-color': '#a78bfa', 'line-width': 0.8, 'line-opacity': 0.5 },
    });
    map.addLayer({
      id: 'suburbs-label', type: 'symbol', source: 'suburbs',
      'source-layer': 'nz_suburbs', minzoom: 10, maxzoom: 14,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-font': ['Open Sans Semibold', 'Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-max-width': 8,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#c4b5fd',
        'text-halo-color': 'rgba(0,0,0,0.65)',
        'text-halo-width': 1.2,
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

    // 3D building extrusion — hidden until 3D mode is active.
    // No height field in LINZ data, so building_id modulo gives natural-looking variation (4–16m).
    map.addLayer({
      id: 'buildings-extrusion', type: 'fill-extrusion', source: 'buildings',
      'source-layer': 'nz_buildings', minzoom: 14,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': [
          'interpolate', ['linear'],
          ['coalesce', ['get', 'height_m'], ['+', 4, ['%', ['to-number', ['get', 'building_id']], 13]]],
          4,   '#c8793e',
          20,  '#d9924f',
          60,  '#e8a870',
          150, '#f2c49a',
          330, '#fff0e0',
        ],
        'fill-extrusion-height': [
          'coalesce',
          ['get', 'height_m'],
          ['+', 4, ['%', ['to-number', ['get', 'building_id']], 13]],
        ],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.9,
      },
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

    map.addSource('zone-draw', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'zone-fill', type: 'fill', source: 'zone-draw',
      filter: ['==', ['get', 'role'], 'fill'],
      paint: { 'fill-color': '#00d4aa', 'fill-opacity': 0.1 },
    });
    map.addLayer({
      id: 'zone-outline', type: 'line', source: 'zone-draw',
      filter: ['==', ['get', 'role'], 'outline'],
      paint: {
        'line-color': '#00d4aa',
        'line-width': 2,
        'line-dasharray': [4, 3],
      },
    });
    map.addLayer({
      id: 'zone-vertices', type: 'circle', source: 'zone-draw',
      filter: ['==', ['get', 'role'], 'vertex'],
      paint: {
        'circle-radius': 5,
        'circle-color': '#00d4aa',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
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

  applyVisibility(map: Map, visibility: Record<string, boolean>, is3D = false): void {
    for (const [groupId, layers] of Object.entries(LAYER_VISIBILITY_MAP)) {
      const groupOn = visibility[groupId] ?? false;
      layers.forEach((l) => {
        let show = groupOn;
        if (l === 'buildings-extrusion') show = groupOn && is3D;
        if ((l === 'buildings-fill' || l === 'buildings-outline') && is3D) show = false;
        if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', show ? 'visible' : 'none');
      });
    }
  }

  enableTerrain(map: Map, exaggeration = 1.5): void {
    map.setTerrain({ source: 'terrain-dem', exaggeration });
    if (map.getLayer('sky')) map.setLayoutProperty('sky', 'visibility', 'visible');
  }

  disableTerrain(map: Map): void {
    map.setTerrain(null as unknown as maplibregl.TerrainSpecification);
    if (map.getLayer('sky')) map.setLayoutProperty('sky', 'visibility', 'none');
  }
}
