import { Injectable } from '@angular/core';
import maplibregl, { type Map, type MapGeoJSONFeature } from 'maplibre-gl';

@Injectable({ providedIn: 'root' })
export class ParcelSelectionService {
  private selectedId: string | number | null = null;
  private popup: maplibregl.Popup | null = null;
  private suppressClose = false;
  private currentParcelProps: Record<string, unknown> | null = null;

  select(
    map: Map,
    feature: MapGeoJSONFeature,
    lngLat: maplibregl.LngLat,
    onCleared: () => void,
  ): void {
    this.clearState(map);

    const fid = feature.id ?? null;
    this.selectedId = fid;
    this.currentParcelProps = feature.properties as Record<string, unknown>;

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
      maxWidth: '300px',
      offset: 8,
    })
      .setLngLat(lngLat)
      .setHTML(this.buildHtml(this.currentParcelProps, null, []))
      .addTo(map);

    this.popup.on('close', () => {
      if (this.suppressClose) return;
      this.currentParcelProps = null;
      this.clearState(map);
      onCleared();
    });
  }

  private currentAddresses: string[] = [];

  enrich(titleProps: Record<string, unknown> | null, addresses: string[]): void {
    if (!this.popup || !this.currentParcelProps) return;
    this.currentAddresses = addresses;
    this.popup.setHTML(this.buildHtml(this.currentParcelProps, titleProps, addresses));
  }

  clear(map: Map): void {
    this.currentParcelProps = null;
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

  private buildHtml(
    parcel: Record<string, unknown>,
    title: Record<string, unknown> | null,
    addresses: string[] = [],
  ): string {
    const row = (label: string, value: unknown, highlight = false) =>
      `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;font-size:12px;padding:3px 0;">
         <span style="color:#9aa6c0;flex-shrink:0;">${label}</span>
         <span style="color:${highlight ? '#00d4aa' : '#e8edf7'};font-weight:${highlight ? '600' : '500'};text-align:right;">${this.esc(value)}</span>
       </div>`;

    const area = parcel['calc_area'] != null ? `${parcel['calc_area']} m²` : '—';
    const titleRef = this.esc(parcel['titles']);

    const addressHtml = addresses.length
      ? addresses.map(a =>
          `<div style="font-size:11px;color:#00d4aa;margin-bottom:2px;">${this.esc(a)}</div>`
        ).join('')
      : '';

    const parcelSection = `
      ${addressHtml}
      <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:8px;padding-right:14px;line-height:1.3;${addresses.length ? 'margin-top:6px;' : ''}">
        ${this.esc(parcel['appellation'])}
      </div>
      ${row('Title', titleRef)}
      ${row('Survey', parcel['affected_surveys'])}
      ${row('District', parcel['land_district'])}
      ${row('Area', area)}`;

    const titleSection = title === null
      ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
           <div style="font-size:10px;color:rgba(255,255,255,0.25);display:flex;align-items:center;gap:6px;">
             <span style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.2);border-top-color:rgba(255,255,255,0.6);border-radius:50%;animation:spin 0.7s linear infinite;"></span>
             Loading title details…
           </div>
         </div>`
      : !title || !title['type']
      ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
           <div style="font-size:10px;color:rgba(255,255,255,0.2);">No title record found</div>
         </div>`
      : `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
           <div style="font-size:10px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:6px;">Title Register</div>
           ${row('Type', title['type'], true)}
           ${row('Status', title['status'])}
           ${row('Guarantee', title['guarantee_status'])}
           ${row('Issued', this.formatDate(title['issue_date']))}
           ${row('Owners', title['number_owners'])}
           ${title['estate_description'] ? `<div style="margin-top:6px;font-size:10px;color:rgba(255,255,255,0.3);line-height:1.5;">${this.esc(title['estate_description'])}</div>` : ''}
         </div>`;

    return `<style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      <div style="font-family:Inter,system-ui,sans-serif;min-width:210px;">
        ${parcelSection}
        ${titleSection}
      </div>`;
  }

  private formatDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private esc(value: unknown): string {
    if (value == null || value === '') return '—';
    return String(value).replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
    );
  }
}
