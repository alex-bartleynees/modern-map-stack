import {
  Component,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, switchMap, debounceTime, distinctUntilChanged, of, takeUntil } from 'rxjs';
import { FeaturesService, type GeoJSONFeature } from '../../services/features.service';

export interface GeocoderResult {
  label: string;
  lng: number;
  lat: number;
}

@Component({
  selector: 'app-geocoder',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="geocoder">
      <div class="input-wrap">
        <span class="icon">⌕</span>
        <input
          class="search-input"
          type="text"
          placeholder="Search address…"
          autocomplete="off"
          [ngModel]="query()"
          (ngModelChange)="onInput($event)"
          (keydown.Escape)="clear()"
        />
        @if (query()) {
          <button class="clear-btn" (click)="clear()" aria-label="Clear">✕</button>
        }
      </div>

      @if (results().length) {
        <ul class="results">
          @for (r of results(); track r.label) {
            <li class="result-item" (click)="select(r)">{{ r.label }}</li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .geocoder {
      position: relative;
      width: 300px;
      font-family: Inter, system-ui, sans-serif;
    }

    @media (max-width: 720px) {
      .geocoder { width: 100%; }
    }

    .input-wrap {
      display: flex;
      align-items: center;
      background: rgba(13, 17, 30, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      backdrop-filter: blur(8px);
      padding: 0 10px;
      gap: 6px;
    }

    .icon {
      color: rgba(255, 255, 255, 0.35);
      font-size: 16px;
      flex-shrink: 0;
      line-height: 1;
    }

    .search-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #d0d6e8;
      font-size: 13px;
      font-family: inherit;
      padding: 10px 0;
    }

    .search-input::placeholder { color: rgba(255, 255, 255, 0.3); }

    .clear-btn {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.3);
      cursor: pointer;
      font-size: 11px;
      padding: 2px 0;
      flex-shrink: 0;
      line-height: 1;
    }
    .clear-btn:hover { color: rgba(255, 255, 255, 0.7); }

    .results {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: rgba(13, 17, 30, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      backdrop-filter: blur(8px);
      list-style: none;
      margin: 0;
      padding: 4px 0;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
      z-index: 20;
      max-height: 240px;
      overflow-y: auto;
    }

    .result-item {
      padding: 8px 12px;
      font-size: 12px;
      color: #c8d0e4;
      cursor: pointer;
      transition: background 0.1s;
    }
    .result-item:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
  `],
})
export class GeocoderComponent implements OnDestroy {
  selected = output<GeocoderResult>();

  private featuresService = inject(FeaturesService);
  private input$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  query = signal('');
  results = signal<GeocoderResult[]>([]);

  constructor() {
    this.input$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) => q.length >= 3 ? this.featuresService.geocode(q) : of(null)),
      takeUntil(this.destroy$),
    ).subscribe((fc) => {
      this.results.set(fc ? fc.features.map((f) => this.toResult(f)) : []);
    });
  }

  onInput(value: string): void {
    this.query.set(value);
    this.input$.next(value);
    if (!value) this.results.set([]);
  }

  select(result: GeocoderResult): void {
    this.query.set(result.label);
    this.results.set([]);
    this.selected.emit(result);
  }

  clear(): void {
    this.query.set('');
    this.results.set([]);
    this.input$.next('');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private toResult(f: GeoJSONFeature): GeocoderResult {
    const geom = f.geometry as { coordinates: [number, number] };
    return {
      label: String(f.properties['full_address'] ?? ''),
      lng: geom.coordinates[0],
      lat: geom.coordinates[1],
    };
  }
}
