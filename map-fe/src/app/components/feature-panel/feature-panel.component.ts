import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import type { SelectedFeature } from '../../models/layer.model';

const SOURCE_LABELS: Record<string, string> = {
  meshblocks: 'PMTiles',
  'territorial-authorities': 'Martin (live)',
  parcels: 'Martin (live)',
  'subject-property': 'GeoJSON',
};

@Component({
  selector: 'app-feature-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">Selected Feature</h3>
          <span class="source-badge">{{ sourceLabel() }}</span>
        </div>
        @if (feature().source === 'parcels' && !isSubjectProperty()) {
          <button class="subject-btn" (click)="setSubjectProperty.emit()">
            Set Subject
          </button>
        }
        @if (isSubjectProperty()) {
          <span class="subject-tag">Subject Property</span>
        }
      </div>

      <div class="prop-list">
        @for (entry of displayProps(); track entry.key) {
          <div class="prop-row">
            <span class="prop-key">{{ entry.key }}</span>
            <span class="prop-value">{{ entry.value }}</span>
          </div>
        }
      </div>

      <div class="coords">
        {{ feature().lngLat.lat.toFixed(5) }}, {{ feature().lngLat.lng.toFixed(5) }}
      </div>
    </div>
  `,
  styles: [`
    .panel-card {
      background: rgba(13, 17, 30, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 14px 16px;
      width: 260px;
      backdrop-filter: blur(8px);
      color: #d0d6e8;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
      gap: 8px;
    }

    .panel-title {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.35);
      margin: 0 0 4px;
    }

    .source-badge {
      font-size: 10px;
      color: #00c49a;
      background: rgba(0,196,154,0.1);
      border: 1px solid rgba(0,196,154,0.25);
      border-radius: 3px;
      padding: 1px 5px;
    }

    .subject-btn {
      font-size: 11px;
      font-family: inherit;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid rgba(0,196,154,0.4);
      background: rgba(0,196,154,0.08);
      color: #00c49a;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .subject-btn:hover {
      background: rgba(0,196,154,0.18);
    }

    .subject-tag {
      font-size: 10px;
      color: #00c49a;
      border: 1px solid #00c49a;
      border-radius: 3px;
      padding: 2px 6px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .prop-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: 220px;
      overflow-y: auto;
    }

    .prop-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      padding-bottom: 5px;
    }

    .prop-key {
      color: rgba(255,255,255,0.4);
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      flex-shrink: 0;
    }

    .prop-value {
      color: #c8d0e4;
      font-size: 12px;
      text-align: right;
      word-break: break-word;
    }

    .coords {
      margin-top: 8px;
      font-size: 10px;
      color: rgba(255,255,255,0.25);
      font-family: 'JetBrains Mono', monospace;
    }
  `],
})
export class FeaturePanelComponent {
  feature = input.required<SelectedFeature>();
  isSubjectProperty = input<boolean>(false);
  setSubjectProperty = output<void>();

  sourceLabel = computed(() => SOURCE_LABELS[this.feature().source] ?? this.feature().source);

  displayProps = computed(() => {
    const props = this.feature().properties;
    const priority = [
      'mb2023_v1_00', 'mb2019_v1_00',
      'ta_code', 'ta_name',
      'ta2023_v1_00_name', 'ta2019_v1_00_name',
      'land_area_sq_km', 'land_area_km2',
      'parcel_id', 'city', 'land_use', 'area_m2',
    ];
    const entries = Object.entries(props)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
      .map(([k, v]) => ({ key: k, value: String(v), order: priority.indexOf(k) }))
      .sort((a, b) => {
        if (a.order >= 0 && b.order >= 0) return a.order - b.order;
        if (a.order >= 0) return -1;
        if (b.order >= 0) return 1;
        return a.key.localeCompare(b.key);
      })
      .slice(0, 12);
    return entries;
  });
}
