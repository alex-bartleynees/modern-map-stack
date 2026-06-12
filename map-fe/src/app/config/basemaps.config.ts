import type { StyleSpecification } from 'maplibre-gl';

export const LINZ_BASEMAPS_KEY = '';

export interface BasemapConfig {
  id: string;
  label: string;
  type: 'raster' | 'vector';
  tileUrl?: string;
  styleUrl?: string;
  attribution?: string;
}

export const BASEMAPS: BasemapConfig[] = [
  {
    id: 'linz',
    label: 'LINZ Aerial',
    type: 'raster',
    tileUrl: `https://basemaps.linz.govt.nz/v1/tiles/aerial/EPSG:3857/{z}/{x}/{y}.webp?api=${LINZ_BASEMAPS_KEY}`,
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

export const RASTER_BASE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [],
};
