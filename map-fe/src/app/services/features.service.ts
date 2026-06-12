import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const BASE_URL = 'http://localhost:9000';

export type GeoJSONFeature = {
  type: 'Feature';
  id?: string | number;
  geometry: unknown;
  properties: Record<string, unknown>;
};

export type GeoJSONFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
};

@Injectable({ providedIn: 'root' })
export class FeaturesService {
  private http = inject(HttpClient);

  getFeature(collection: string, id: string): Observable<GeoJSONFeature> {
    return this.http.get<GeoJSONFeature>(
      `${BASE_URL}/collections/${collection}/items/${id}`
    );
  }

  getFeaturesInBbox(collection: string, bbox: number[]): Observable<GeoJSONFeatureCollection> {
    const params = new HttpParams()
      .set('bbox', bbox.join(','))
      .set('limit', '100');
    return this.http.get<GeoJSONFeatureCollection>(
      `${BASE_URL}/collections/${collection}/items`,
      { params }
    );
  }

  getFeaturesByFilter(
    collection: string,
    filter: Record<string, string>
  ): Observable<GeoJSONFeatureCollection> {
    let params = new HttpParams().set('limit', '100');
    for (const [key, value] of Object.entries(filter)) {
      params = params.set(key, value);
    }
    return this.http.get<GeoJSONFeatureCollection>(
      `${BASE_URL}/collections/${collection}/items`,
      { params }
    );
  }

  getParcelAddresses(fid: number): Observable<string[]> {
    return this.http
      .get<{ full_address: string }[]>(
        `${BASE_URL}/functions/postgisftw.parcel_addresses/items`,
        { params: new HttpParams().set('parcel_fid', fid) }
      )
      .pipe(map((rows) => rows.map((r) => r.full_address)));
  }

  getTitleByRef(titleNo: string): Observable<GeoJSONFeature | null> {
    return this.getFeaturesByFilter('public.nz_titles', { title_no: titleNo }).pipe(
      map((fc) => fc.features[0] ?? null)
    );
  }

  geocode(q: string, limit = 8): Observable<GeoJSONFeatureCollection> {
    const params = new HttpParams().set('q', q).set('lim', limit);
    return this.http.get<GeoJSONFeatureCollection>(
      `${BASE_URL}/functions/postgisftw.address_search/items`,
      { params }
    );
  }
}
