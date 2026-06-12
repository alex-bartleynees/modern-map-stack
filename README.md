# Modern Map Stack Demo

A local proof-of-concept for a modern geospatial stack using real New Zealand data.

## Architecture

```
PostGIS (port 5432)
  ├── Martin (port 3001)       → /tiles/{z}/{x}/{y}   → MapLibre (vector tiles)
  ├── pg_featureserv (port 9000) → /collections/{id}/items → Angular (GeoJSON queries)
  └── ogr2ogr export → GeoJSON
        └── Tippecanoe → nz-meshblocks.pmtiles → Martin → MapLibre (static tiles)

Angular 22 Frontend (port 4200)
  ├── LINZ Aerial basemap (raster)
  ├── Meshblocks layer   ← PMTiles (pre-tiled, static)
  ├── TA Boundaries      ← Martin (dynamic PostGIS)
  ├── Parcels            ← Martin (dynamic PostGIS)
  └── Subject Property   ← Inline GeoJSON (ephemeral)
```

### Static vs Dynamic split

| Dataset                      | Approach               | Reason                                           |
| ---------------------------- | ---------------------- | ------------------------------------------------ |
| Meshblocks (~54k features)   | PMTiles via Tippecanoe | Large static dataset — pre-tile once, serve fast |
| Territorial Authorities (67) | Martin live tiles      | Small dataset, dynamic fine                      |
| Parcels                      | Martin live tiles      | Property data should be live/queryable           |
| Subject property             | Inline GeoJSON         | Ephemeral UI state, no server needed             |

## Stack

| Component                   | Role                                                 |
| --------------------------- | ---------------------------------------------------- |
| PostgreSQL 16 + PostGIS 3.4 | Spatial data store                                   |
| Martin (Rust)               | Serves MVT tiles from PostGIS tables + PMTiles files |
| pg_featureserv              | OGC Features API — GeoJSON feature queries           |
| Tippecanoe                  | Generates PMTiles from GeoJSON                       |
| Angular 22                  | Frontend — standalone components, signals            |
| MapLibre GL JS              | WebGL map renderer                                   |
| pmtiles npm                 | Client-side PMTiles protocol for MapLibre            |

## Running

### 1. Start backend services

```bash
docker compose up
```

This starts PostGIS, Martin, and pg_featureserv. Wait for all three to be healthy.

### 2. Load NZ data

Prerequisites: `ogr2ogr` (GDAL), `tippecanoe`, `psql`, `curl`

**Option A — with Koordinates API key (auto-download):**

```bash
KOORDINATES_KEY=your_key_here ./scripts/load-data.sh
```

Get a free key at https://datafinder.stats.govt.nz/my/api/

**Option B — manual download:**

1. Download meshblocks GeoJSON from https://datafinder.stats.govt.nz/layer/98971-meshblock-2023-clipped-generalised/ and save to `data/nz_meshblocks.geojson`
2. Download territorial authorities GeoJSON from https://datafinder.stats.govt.nz/layer/98772-territorial-authority-2023-clipped-generalised/ and save to `data/nz_territorial_authorities.geojson`
3. Run `./scripts/load-data.sh`

Parcels fall back to 1000 synthetic points across Auckland, Wellington, and Christchurch if no real data is provided.

### 3. Verify backend

- Martin catalog: http://localhost:7100/catalog
- pg_featureserv: http://localhost:9000/collections
- PMTiles: `ls -lh tiles/nz-meshblocks.pmtiles`

### 4. Start frontend

```bash
cd map-fe
npm start
```

Open http://localhost:4200

## LINZ API Key

The demo uses a public LINZ basemaps API key. For production use, get your own free key at https://basemaps.linz.govt.nz — click "API Keys" after signing in.

Update the key in `map-fe/src/app/components/map/map.component.ts`:

```typescript
const LINZ_KEY = "your_key_here";
```

## Frontend features

- Full-viewport map (LINZ aerial or OSM basemap)
- Layer toggles: Meshblocks, TA Boundaries, Parcels
- Click any feature → attribute panel shows properties from vector tile
- Hover parcels → highlight
- Set Subject Property → marks a parcel with teal highlight (CMA workflow simulation)
- Stack info panel (top-right) — shows which source each layer comes from

## Links

- [Martin docs](https://maplibre.org/martin/)
- [pg_featureserv docs](https://access.crunchydata.com/documentation/pg_featureserv/latest/)
- [MapLibre GL JS docs](https://maplibre.org/maplibre-gl-js/docs/)
- [PMTiles spec](https://github.com/protomaps/PMTiles)
- [Tippecanoe](https://github.com/felt/tippecanoe)
- [Stats NZ datafinder](https://datafinder.stats.govt.nz)
