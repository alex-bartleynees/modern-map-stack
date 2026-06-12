import { Injectable, signal } from '@angular/core';
import type { Map } from 'maplibre-gl';

@Injectable({ providedIn: 'root' })
export class MapService {
  private map: Map | null = null;
  readonly mapReady = signal(false);

  setMap(map: Map): void {
    this.map = map;
    this.mapReady.set(true);
  }

  getMap(): Map | null {
    return this.map;
  }

  destroy(): void {
    this.map?.remove();
    this.map = null;
    this.mapReady.set(false);
  }
}
