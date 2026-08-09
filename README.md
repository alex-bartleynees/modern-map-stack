# Modern Map Stack Demo

A self-hosted geospatial stack proof-of-concept using real New Zealand data.

## Architecture

```
PostGIS 16 + PostGIS 3.4 (port 5432)
  ├── Martin (port 7100)          → MVT tiles from PostGIS tables + PMTiles files
  ├── pg_featureserv (port 9000)  → OGC Features API + custom SQL functions
  └── Tippecanoe → *.pmtiles → Martin → MapLibre (static pre-tiled layers)

Angular 22 Frontend (port 4200)
  ├── 4 basemaps: LINZ Aerial, OSM, CARTO Dark, CARTO Positron
  ├── Meshblocks        ← PMTiles (Tippecanoe → Martin)
  ├── Contours          ← PMTiles (Tippecanoe → Martin)
  ├── Suburbs           ← PMTiles (Tippecanoe → Martin)
  ├── Buildings 2D/3D   ← PMTiles (Tippecanoe → Martin) + OSM height enrichment
  ├── TA Boundaries     ← Martin (dynamic PostGIS)
  ├── Parcels           ← Martin (dynamic PostGIS)
  ├── Auckland Flood    ← Martin (dynamic PostGIS)
  ├── Census SA2        ← Martin (dynamic PostGIS)
  ├── Terrain           ← AWS Terrain Tiles (Terrarium DEM, external)
  ├── Address Geocoder  ← pg_featureserv function (postgisftw.address_search)
  ├── Parcel addresses  ← pg_featureserv function (postgisftw.parcel_addresses)
  ├── Title register    ← pg_featureserv collection (public.nz_titles)
  ├── Subject Property  ← Inline GeoJSON (ephemeral)
  └── Zone Drawing      ← Inline GeoJSON (ephemeral, point-in-polygon parcel query)
```

### Serving path rationale

| Dataset              | Serving path              | Reason                                              |
| -------------------- | ------------------------- | --------------------------------------------------- |
| Meshblocks (53k)     | PMTiles → Martin          | Large, static — pre-tile once, serve fast           |
| Contours (485k)      | PMTiles → Martin          | Large, static — z8+ only, Z stripped at tile time   |
| Suburbs (6.5k)       | PMTiles → Martin          | Static admin boundaries, no live updates needed     |
| Buildings (3.2M)     | PMTiles → Martin          | Large, static — z14+ only; OSM heights baked in     |
| TAs (68)             | Martin dynamic            | Small, fine to tile live                            |
| Parcels (2.8M)       | Martin dynamic            | Property data should be live/queryable              |
| Flood plains         | Martin dynamic            | Regional layer, moderate complexity                 |
| Census SA2 (2.3k)    | Martin dynamic            | Small, needs dynamic choropleth switching           |
| Terrain DEM          | AWS Terrain Tiles         | RGB-encoded elevation, external CDN, free           |
| Address search       | pg_featureserv function   | Full-text search with pg_trgm, self-hosted          |
| Title lookup         | pg_featureserv collection | Simple property filter by title_no                  |
| Subject property     | Inline GeoJSON            | Ephemeral UI state, no server needed                |
| Zone drawing         | Inline GeoJSON            | Ephemeral draw state, parcel query via client-side  |

## Prerequisites

- Docker + Docker Compose
- Nix + direnv (for the dev shell) — or install manually: `gdal`, `tippecanoe`, `postgresql-client`, `curl`, `jq`

### API Keys

Two separate LINZ keys are required — they are different systems:

| Key                 | Used for                                                                          | Get it at                                          |
| ------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| `LINZ_KEY`          | WFS bulk downloads from data.linz.govt.nz (parcels, buildings, addresses, titles) | https://data.linz.govt.nz → sign in → API Keys     |
| `LINZ_BASEMAPS_KEY` | Aerial tile basemap in the frontend                                               | https://basemaps.linz.govt.nz → sign in → API Keys |
| `KOORDINATES_KEY`   | Stats NZ data downloads (meshblocks, census SA2)                                  | https://datafinder.stats.govt.nz/my/api/           |

Copy `.env.example` to `.env` and fill in the keys:

```bash
cp .env.example .env
# edit .env with your keys
```

Or export them directly:

```bash
export LINZ_KEY=your_linz_data_key
export KOORDINATES_KEY=your_stats_nz_key
```

The `LINZ_BASEMAPS_KEY` is set in `map-fe/src/app/config/basemaps.config.ts`.

## Running

### 1. Start backend services

```bash
docker compose up -d
```

Starts PostGIS (5432), Martin (7100), pg_featureserv (9000). Wait for all three to be healthy.

### 2. Load data

This downloads ~6GB of NZ data, loads it into PostGIS, builds PMTiles, and installs pg_featureserv functions. Takes 30–60 minutes on first run; subsequent runs skip already-downloaded files.

```bash
LINZ_KEY=your_key KOORDINATES_KEY=your_key bash scripts/load-data.sh
```

Datasets loaded:

| Table                        | Source                        | Size                        |
| ---------------------------- | ----------------------------- | --------------------------- |
| `nz_sa2_census`              | Stats NZ layer 122391         | 2.3k SA2s                   |
| `nz_meshblocks`              | Stats NZ layer 98971          | 53k meshblocks              |
| `nz_territorial_authorities` | Derived from meshblocks       | 68 TAs                      |
| `nz_contours`                | LINZ layer 50768              | 485k contour lines (Topo50) |
| `nz_suburbs`                 | LINZ layer 113764             | 6.5k suburbs & localities   |
| `nz_parcels`                 | LINZ layer 50772              | 2.8M parcels                |
| `nz_buildings`               | LINZ layer 101290             | 3.2M buildings + OSM heights|
| `nz_titles`                  | LINZ layer 50804              | 2.4M titles (no ownership)  |
| `auckland_flood`             | Auckland Council / ArcGIS Hub | ~60k flood polygons         |
| `nz_addresses`               | LINZ layer 123113             | 2.4M addresses              |

After loading, PMTiles are generated for meshblocks, contours, suburbs, and buildings. Martin is restarted automatically.

Building heights are enriched from OpenStreetMap via the Overpass API (`scripts/add_osm_heights.sh`) — buildings with explicit `height` or `building:levels` tags in OSM (Sky Tower, CBD towers, etc.) get real heights baked into the PMTiles; all others fall back to a building-id-based approximation.

### 3. Verify backend

```bash
# Martin serving all layers
curl -s http://localhost:7100/tiles/catalog | jq '[.[].id]'

# pg_featureserv functions
curl -s 'http://localhost:9000/features/functions/postgisftw.address_search/items?q=Lambton+Quay&lim=3' | jq '[.features[].properties.full_address]'

# PMTiles exist
ls -lh tiles/
```

### 4. Start frontend

```bash
cd map-fe
npm start
```

Open http://localhost:4200

## Frontend features

- **4 basemaps** — LINZ Aerial (raster), OSM (raster), CARTO Dark (vector), CARTO Positron (vector)
- **Layer toggles** — Meshblocks, TA Boundaries, Contours, Suburbs, Parcels, Buildings, Flood Plains, Census SA2
- **3D mode** — toggle button tilts the camera to 52°, enables AWS terrain elevation (1.5× exaggeration), swaps flat buildings for fill-extrusion with real OSM heights where available
- **Address geocoder** — debounced search backed by `postgisftw.address_search` (pg_trgm on 2.4M LINZ addresses, fully self-hosted)
- **Parcel click popup** — shows street address, appellation, title reference, title type/status/issue date/owner count from the LINZ title register
- **Parcel hover highlight** — persistent selection with teal highlight
- **Subject property** — click "Set as Subject Property" on a parcel to mark it with a distinct highlight
- **Map zone tool** — draw a polygon on the map; all parcel popups within the zone are listed in a side panel (client-side point-in-polygon, no server round-trip)
- **Census choropleth** — SA2 polygons colored by dwelling density, home ownership rate, or mould/damp rate (2023 Census); includes legend
- **Auckland flood plains** — color-coded by return period (10yr → 500yr+)
- **Contours** — Topo50 1:50k contours with 100m index contours from z8, minor contours from z11, elevation labels from z12
- **Suburbs** — NZ suburbs and localities boundaries with name labels
- **Stack info panel** — shows which serving path (PMTiles, Martin, pg_featureserv, GeoJSON, Terrain DEM) each layer uses

## Key scripts

| Script                                  | Purpose                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `scripts/load-data.sh`                  | Download, load, index all datasets; enrich heights; build PMTiles; pg functions  |
| `scripts/generate-pmtiles.sh`           | (Re)generate PMTiles for meshblocks, contours, suburbs, buildings from PostGIS   |
| `scripts/add_osm_heights.sh`            | Fetch OSM heights via Overpass API and spatial-join onto `nz_buildings.height_m` |
| `scripts/derive-ta-from-meshblocks.sql` | Build TA boundaries via ST_Union of meshblocks                                   |
| `scripts/address-search.sql`            | pg_trgm index + `postgisftw.address_search` function                             |
| `scripts/parcel-addresses.sql`          | Pre-compute parcel→address join + `postgisftw.parcel_addresses` function         |

> **After regenerating PMTiles**, restart Martin so it re-reads the files:
> `docker compose restart martin`

## Frontend structure

```
map-fe/src/app/
  config/
    basemaps.config.ts       # basemap definitions + RASTER_BASE_STYLE
  services/
    layer.service.ts         # addSourcesAndLayers, applyVisibility, updateCensusMetric
    parcel-selection.service.ts  # parcel highlight + two-phase popup (parcel → title + address)
    features.service.ts      # pg_featureserv HTTP calls (geocode, title, addresses)
    map.service.ts           # MapLibre Map instance singleton
  components/
    map/                     # main orchestrator component
    layer-control/           # layer toggles + basemap switcher + census metric selector + legend
    geocoder/                # debounced address search input + dropdown
    feature-panel/           # clicked feature attribute panel
    stack-info/              # serving path reference panel
```

## Stack components

| Component            | Version  | Role                                                |
| -------------------- | -------- | --------------------------------------------------- |
| PostgreSQL + PostGIS | 16 + 3.4 | Spatial data store, spatial joins, pg_trgm search   |
| Martin               | latest   | MVT tiles from PostGIS tables; serves PMTiles files |
| pg_featureserv       | latest   | OGC Features API + custom SQL functions             |
| Tippecanoe           | latest   | Builds PMTiles archives from GeoJSON                |
| Angular              | 22       | Frontend — standalone components, signals           |
| MapLibre GL JS       | v5       | WebGL map renderer                                  |

## Links

- [Martin docs](https://maplibre.org/martin/)
- [pg_featureserv docs](https://access.crunchydata.com/documentation/pg_featureserv/latest/)
- [MapLibre GL JS docs](https://maplibre.org/maplibre-gl-js/docs/)
- [PMTiles spec](https://github.com/protomaps/PMTiles)
- [Tippecanoe](https://github.com/felt/tippecanoe)
- [Stats NZ datafinder](https://datafinder.stats.govt.nz)
- [LINZ Data Service](https://data.linz.govt.nz)
