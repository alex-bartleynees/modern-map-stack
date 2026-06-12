import { Injectable } from '@angular/core';
import maplibregl, { type Map, type MapGeoJSONFeature } from 'maplibre-gl';

@Injectable({ providedIn: 'root' })
export class ParcelSelectionService {
  private selectedId: string | number | null = null;
  private popup: maplibregl.Popup | null = null;
  private suppressClose = false;

  select(
    map: Map,
    feature: MapGeoJSONFeature,
    lngLat: maplibregl.LngLat,
    onCleared: () => void,
  ): void {
    this.clearState(map);

    const fid = feature.id ?? null;
    this.selectedId = fid;
    if (fid != null) {
      map.setFeatureState(
        { source: 'parcels', sourceLayer: 'nz_parcels', id: fid },
        { selected: true },
      );
    }

    this.popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      className: 'parcel-popup',
      maxWidth: '280px',
      offset: 8,
    })
      .setLngLat(lngLat)
      .setHTML(this.buildHtml(feature.properties as Record<string, unknown>))
      .addTo(map);

    this.popup.on('close', () => {
      if (this.suppressClose) return;
      this.clearState(map);
      onCleared();
    });
  }

  clear(map: Map): void {
    this.clearState(map);
  }

  get currentId(): string | number | null {
    return this.selectedId;
  }

  private clearState(map: Map): void {
    if (this.selectedId != null) {
      map.setFeatureState(
        { source: 'parcels', sourceLayer: 'nz_parcels', id: this.selectedId },
        { selected: false },
      );
      this.selectedId = null;
    }
    if (this.popup) {
      this.suppressClose = true;
      this.popup.remove();
      this.popup = null;
      this.suppressClose = false;
    }
  }

  private buildHtml(props: Record<string, unknown>): string {
    const row = (label: string, value: unknown) =>
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
}
