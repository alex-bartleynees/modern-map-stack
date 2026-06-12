import { Component, ChangeDetectionStrategy } from '@angular/core';

interface StackEntry {
  layer: string;
  source: string;
  badge: 'pmtiles' | 'martin' | 'geojson' | 'raster' | 'vector';
}

@Component({
  selector: 'app-stack-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel-card">
      <h3 class="panel-title">Stack Sources</h3>
      <div class="stack-list">
        @for (entry of entries; track entry.layer) {
          <div class="stack-row">
            <span class="stack-layer">{{ entry.layer }}</span>
            <span class="stack-badge" [class]="'stack-badge--' + entry.badge">{{ entry.source }}</span>
          </div>
        }
      </div>
      <div class="stack-legend">
        <div class="legend-row"><span class="dot dot--raster"></span> Raster — external tile service</div>
        <div class="legend-row"><span class="dot dot--vector"></span> Vector style — CARTO CDN</div>
        <div class="legend-row"><span class="dot dot--pmtiles"></span> PMTiles — static, pre-tiled</div>
        <div class="legend-row"><span class="dot dot--martin"></span> Martin — dynamic PostGIS</div>
        <div class="legend-row"><span class="dot dot--geojson"></span> GeoJSON — inline ephemeral</div>
      </div>
    </div>
  `,
  styles: [`
    .panel-card {
      background: rgba(13, 17, 30, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 14px 16px;
      min-width: 220px;
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
      color: rgba(255,255,255,0.35);
      margin: 0 0 10px;
    }

    .stack-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }

    .stack-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .stack-layer { font-size: 12px; color: #c8d0e4; }

    .stack-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 500;
      flex-shrink: 0;
    }

    .stack-badge--pmtiles  { background: rgba(139,92,246,0.15); color: #a78bfa; border: 1px solid rgba(139,92,246,0.3); }
    .stack-badge--martin   { background: rgba(0,196,154,0.12); color: #00c49a; border: 1px solid rgba(0,196,154,0.25); }
    .stack-badge--geojson  { background: rgba(251,146,60,0.12); color: #fb923c; border: 1px solid rgba(251,146,60,0.25); }
    .stack-badge--raster   { background: rgba(99,179,237,0.12); color: #63b3ed; border: 1px solid rgba(99,179,237,0.25); }
    .stack-badge--vector   { background: rgba(236,72,153,0.12); color: #f472b6; border: 1px solid rgba(236,72,153,0.25); }

    .stack-legend {
      border-top: 1px solid rgba(255,255,255,0.06);
      padding-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .legend-row {
      font-size: 10px;
      color: rgba(255,255,255,0.3);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .dot--raster   { background: #63b3ed; }
    .dot--vector   { background: #f472b6; }
    .dot--pmtiles  { background: #a78bfa; }
    .dot--martin   { background: #00c49a; }
    .dot--geojson  { background: #fb923c; }
  `],
})
export class StackInfoComponent {
  entries: StackEntry[] = [
    { layer: 'LINZ Aerial / OSM', source: 'Raster', badge: 'raster' },
    { layer: 'Dark / Positron', source: 'Vector', badge: 'vector' },
    { layer: 'Meshblocks', source: 'PMTiles→Martin', badge: 'pmtiles' },
    { layer: 'TA Boundaries', source: 'Martin', badge: 'martin' },
    { layer: 'Parcels', source: 'Martin', badge: 'martin' },
    { layer: 'Buildings', source: 'PMTiles→Martin', badge: 'pmtiles' },
    { layer: 'Subject Property', source: 'GeoJSON', badge: 'geojson' },
    { layer: 'Geocoder', source: 'pg_featureserv', badge: 'geojson' },
  ];
}
