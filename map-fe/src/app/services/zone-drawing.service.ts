import { Injectable, signal } from '@angular/core';
import type { Map, MapGeoJSONFeature, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, Feature } from 'geojson';

export interface ZoneParcel {
  id: string | number | undefined;
  appellation: string;
  area: string;
  titles: string;
  land_district: string;
}

@Injectable({ providedIn: 'root' })
export class ZoneDrawingService {
  readonly isDrawing = signal(false);
  readonly zoneActive = signal(false);
  readonly zoneParcels = signal<ZoneParcel[]>([]);

  private vertices: [number, number][] = [];
  private previewPos: [number, number] | null = null;

  startDrawing(map: Map): void {
    this.vertices = [];
    this.previewPos = null;
    this.isDrawing.set(false);
    this.zoneActive.set(false);
    this.zoneParcels.set([]);
    this.syncSource(map);
    this.isDrawing.set(true);
  }

  addVertex(map: Map, pos: [number, number]): void {
    this.vertices.push(pos);
    this.syncSource(map);
  }

  updatePreview(map: Map, pos: [number, number]): void {
    this.previewPos = pos;
    this.syncSource(map);
  }

  completePolygon(map: Map): void {
    if (this.vertices.length < 3) {
      this.cancelDrawing(map);
      return;
    }
    this.isDrawing.set(false);
    this.previewPos = null;
    this.syncSource(map);
    this.queryParcels(map);
    this.zoneActive.set(true);
  }

  cancelDrawing(map: Map): void {
    this.vertices = [];
    this.previewPos = null;
    this.isDrawing.set(false);
    this.syncSource(map);
  }

  clearZone(map: Map): void {
    this.vertices = [];
    this.previewPos = null;
    this.isDrawing.set(false);
    this.zoneActive.set(false);
    this.zoneParcels.set([]);
    this.syncSource(map);
  }

  private syncSource(map: Map): void {
    const src = map.getSource('zone-draw') as GeoJSONSource | undefined;
    src?.setData(this.buildGeoJSON());
  }

  private buildGeoJSON(): FeatureCollection {
    const feats: Feature[] = [];
    const v = this.vertices;

    if (v.length >= 2 || (v.length >= 1 && this.previewPos)) {
      const coords: [number, number][] = this.isDrawing() && this.previewPos
        ? [...v, this.previewPos, v[0]]
        : [...v, v[0]];
      feats.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: { role: 'outline' },
      });
    }

    if (!this.isDrawing() && v.length >= 3) {
      feats.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...v, v[0]]] },
        properties: { role: 'fill' },
      });
    }

    v.forEach((pos) =>
      feats.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pos },
        properties: { role: 'vertex' },
      }),
    );

    return { type: 'FeatureCollection', features: feats };
  }

  private queryParcels(map: Map): void {
    const poly = this.vertices;
    if (poly.length < 3) return;

    const pts = poly.map((v) => map.project(v));
    const minX = Math.min(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxX = Math.max(...pts.map((p) => p.x));
    const maxY = Math.max(...pts.map((p) => p.y));

    const features = map.queryRenderedFeatures(
      [[minX, minY], [maxX, maxY]],
      { layers: ['parcels-hit'] },
    );

    const seen = new Set<string | number>();
    const inZone = features.filter((f) => {
      if (f.id == null || seen.has(f.id)) return false;
      const c = this.featureCenter(f);
      if (!c || !this.pointInPolygon(c, poly)) return false;
      seen.add(f.id);
      return true;
    });

    this.zoneParcels.set(
      inZone.map((f) => ({
        id: f.id,
        appellation: String(f.properties['appellation'] ?? ''),
        area: f.properties['calc_area'] != null ? `${f.properties['calc_area']} m²` : '',
        titles: String(f.properties['titles'] ?? ''),
        land_district: String(f.properties['land_district'] ?? ''),
      })),
    );
  }

  private featureCenter(f: MapGeoJSONFeature): [number, number] | null {
    const g = f.geometry;
    if (!g) return null;
    if (g.type === 'Point') return g.coordinates as [number, number];
    if (g.type === 'Polygon') return this.ringCentroid(g.coordinates[0] as [number, number][]);
    if (g.type === 'MultiPolygon') return this.ringCentroid(g.coordinates[0][0] as [number, number][]);
    return null;
  }

  private ringCentroid(ring: [number, number][]): [number, number] {
    let x = 0, y = 0;
    ring.forEach(([px, py]) => { x += px; y += py; });
    return [x / ring.length, y / ring.length];
  }

  private pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [px, py] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }
}
