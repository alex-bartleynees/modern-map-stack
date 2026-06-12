import { Component } from '@angular/core';
import { MapComponent } from './components/map/map.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MapComponent],
  template: '<app-map />',
  styles: [':host { display: block; width: 100%; height: 100dvh; }'],
})
export class App {}
