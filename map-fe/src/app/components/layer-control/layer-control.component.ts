import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

interface BasemapOption {
  id: string;
  label: string;
  type: 'raster' | 'vector';
}

@Component({
  selector: 'app-layer-control',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel-card">
      <h3 class="panel-title">Layers</h3>

      <div class="layer-list">
        @for (layer of layers; track layer.id) {
          <label class="toggle-row">
            <span class="toggle-label">{{ layer.label }}</span>
            <button
              class="toggle"
              [class.toggle--on]="layerVisibility()[layer.id]"
              (click)="layerToggle.emit(layer.id)"
              [attr.aria-label]="
                (layerVisibility()[layer.id] ? 'Hide' : 'Show') + ' ' + layer.label
              "
            >
              <span class="toggle-thumb"></span>
            </button>
          </label>
        }
      </div>

      <div class="divider"></div>

      <h3 class="panel-title">Basemap</h3>
      <div class="basemap-grid">
        @for (bm of basemaps(); track bm.id) {
          <button
            class="basemap-btn"
            [class.basemap-btn--active]="activeBasemap() === bm.id"
            [class.basemap-btn--vector]="bm.type === 'vector'"
            (click)="basemapChange.emit(bm.id)"
          >
            <span class="basemap-icon">{{ bmIcon(bm) }}</span>
            <span class="basemap-label">{{ bm.label }}</span>
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .panel-card {
        background: rgba(13, 17, 30, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 14px 16px;
        min-width: 200px;
        backdrop-filter: blur(8px);
        color: #d0d6e8;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 13px;
      }

      .panel-title {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.35);
        margin: 0 0 10px;
      }

      .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.06);
        margin: 12px 0;
      }

      .layer-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        cursor: pointer;
      }

      .toggle-label {
        font-size: 13px;
        color: #c8d0e4;
      }

      .toggle {
        position: relative;
        width: 32px;
        height: 18px;
        border-radius: 9px;
        border: none;
        background: rgba(255, 255, 255, 0.12);
        cursor: pointer;
        transition: background 0.2s;
        padding: 0;
        flex-shrink: 0;
      }

      .toggle--on {
        background: #00c49a;
      }

      .toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #fff;
        transition: transform 0.2s;
        display: block;
      }

      .toggle--on .toggle-thumb {
        transform: translateX(14px);
      }

      .basemap-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }

      .basemap-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 8px 4px 7px;
        font-size: 11px;
        font-family: inherit;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.03);
        color: #8a93a8;
        cursor: pointer;
        transition: all 0.15s;
      }

      .basemap-btn:hover {
        background: rgba(255, 255, 255, 0.07);
        color: #c8d0e4;
        border-color: rgba(255, 255, 255, 0.14);
      }

      .basemap-btn--active {
        background: rgba(0, 196, 154, 0.12);
        border-color: #00c49a;
        color: #00c49a;
      }

      .basemap-icon {
        font-size: 16px;
        line-height: 1;
      }

      .basemap-label {
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.02em;
      }
    `,
  ],
})
export class LayerControlComponent {
  layerVisibility = input.required<Record<string, boolean>>();
  activeBasemap = input.required<string>();
  basemaps = input.required<{ id: string; label: string; type: 'raster' | 'vector' }[]>();
  layerToggle = output<string>();
  basemapChange = output<string>();

  layers = [
    { id: 'meshblocks', label: 'Meshblocks' },
    { id: 'ta-boundaries', label: 'TA Boundaries' },
    { id: 'parcels', label: 'Parcels' },
    { id: 'buildings', label: 'Buildings' },
    { id: 'flood', label: 'Flood Plains (AKL)' },
  ];

  bmIcon(bm: BasemapOption): string {
    const icons: Record<string, string> = {
      linz: '🛰',
      osm: '🗺',
      dark: '🌑',
      positron: '☀',
    };
    return icons[bm.id] ?? (bm.type === 'vector' ? '◈' : '⊞');
  }
}
