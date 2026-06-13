import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import type { ZoneParcel } from '../../services/zone-drawing.service';

@Component({
  selector: 'app-zone-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="zone-card">
      <div class="zone-header">
        <div class="zone-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/>
          </svg>
          Zone &mdash; {{ parcels().length }} parcel{{ parcels().length !== 1 ? 's' : '' }}
        </div>
        <button class="clear-btn" (click)="clear.emit()">Clear</button>
      </div>

      <div class="parcel-list">
        @if (parcels().length === 0) {
          <div class="empty-msg">No parcels found — zoom in and try again</div>
        }
        @for (p of parcels(); track p.id) {
          <div class="parcel-item">
            <div class="parcel-name">{{ p.appellation || '—' }}</div>
            <div class="parcel-meta">
              @if (p.area) { <span class="meta-area">{{ p.area }}</span> }
              @if (p.land_district) { <span class="meta-district">{{ p.land_district }}</span> }
            </div>
            @if (p.titles) {
              <div class="parcel-titles">{{ p.titles }}</div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .zone-card {
      background: rgba(13, 17, 30, 0.92);
      border: 1px solid rgba(0, 212, 170, 0.28);
      border-radius: 8px;
      padding: 12px 14px;
      width: 260px;
      max-height: 50vh;
      display: flex;
      flex-direction: column;
      gap: 10px;
      backdrop-filter: blur(8px);
      color: #d0d6e8;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }

    .zone-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .zone-title {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #00d4aa;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .clear-btn {
      font-size: 11px;
      font-family: inherit;
      padding: 3px 9px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.04);
      color: rgba(255, 255, 255, 0.45);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      white-space: nowrap;
    }

    .clear-btn:hover {
      background: rgba(255, 255, 255, 0.09);
      color: rgba(255, 255, 255, 0.75);
    }

    .parcel-list {
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-height: 0;
    }

    .parcel-item {
      padding: 7px 8px;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 5px;
    }

    .parcel-name {
      font-size: 11px;
      font-weight: 500;
      color: #c8d0e4;
      margin-bottom: 3px;
      line-height: 1.35;
    }

    .parcel-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .meta-area {
      font-size: 10px;
      color: #00d4aa;
      font-family: 'JetBrains Mono', monospace;
    }

    .meta-district {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.3);
    }

    .parcel-titles {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.25);
      margin-top: 2px;
      line-height: 1.3;
    }

    .empty-msg {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.3);
      text-align: center;
      padding: 18px 0;
      line-height: 1.5;
    }
  `],
})
export class ZonePanelComponent {
  parcels = input.required<ZoneParcel[]>();
  clear = output<void>();
}
