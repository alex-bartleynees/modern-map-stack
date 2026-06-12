export type SourceType = 'Martin' | 'PMTiles' | 'GeoJSON' | 'Raster';

export interface LayerConfig {
  id: string;
  label: string;
  sourceType: SourceType;
  sourceUrl: string;
  minzoom?: number;
  maxzoom?: number;
}

export interface SelectedFeature {
  properties: Record<string, unknown>;
  sourceLayer: string;
  source: string;
  id?: string | number;
  lngLat: { lng: number; lat: number };
}

export const LAYER_CONFIGS: LayerConfig[] = [
  { id: 'meshblocks', label: 'Meshblocks', sourceType: 'PMTiles', sourceUrl: 'localhost:7100', minzoom: 6, maxzoom: 14 },
  { id: 'ta-boundaries', label: 'Territorial Authorities', sourceType: 'Martin', sourceUrl: 'localhost:7100', minzoom: 4, maxzoom: 12 },
  { id: 'parcels', label: 'Parcels', sourceType: 'Martin', sourceUrl: 'localhost:7100', minzoom: 12, maxzoom: 20 },
  { id: 'buildings', label: 'Buildings', sourceType: 'PMTiles', sourceUrl: 'localhost:7100', minzoom: 14, maxzoom: 17 },
  { id: 'linz-aerial', label: 'LINZ Aerial', sourceType: 'Raster', sourceUrl: 'basemaps.linz.govt.nz' },
  { id: 'osm', label: 'OpenStreetMap', sourceType: 'Raster', sourceUrl: 'tile.openstreetmap.org' },
  { id: 'subject-property', label: 'Subject Property', sourceType: 'GeoJSON', sourceUrl: 'Inline' },
];
