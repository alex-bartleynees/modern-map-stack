# Modern Map Stack — Best Practices

Practical guidance for working on this stack: **PostGIS → Martin / pg_featureserv / PMTiles → MapLibre (Angular)**. The rules below are specific to the components in this repo and call out the gotchas we have actually hit, not generic GIS advice.

---

## 1. Architecture: pick the right serving path per dataset

This stack deliberately serves data three different ways. Choose based on **size**, **volatility**, and **how the client needs to consume it** — not by habit.

| Path | Use when | In this repo |
| --- | --- | --- |
| **Martin live MVT** (from a PostGIS table) | Data changes, is queried live, or you want a single source of truth in the DB | `nz_parcels`, `nz_territorial_authorities` |
| **PMTiles** (Tippecanoe, pre-tiled, served as a static file) | Large, mostly-static dataset where re-tiling on every request is wasteful | `nz_meshblocks` (~54k features) |
| **pg_featureserv** (OGC Features API → GeoJSON) | You need a *specific feature* by id, a *non-spatial query* (by attribute), or a query independent of what's rendered on screen | "Set Subject Property" feature lookup |
| **Inline GeoJSON** (client-side source) | Ephemeral UI state that never needs to round-trip to the server | `subject-property` highlight overlay |

**Rule of thumb:** tiles are for *rendering many features fast*; pg_featureserv is for *fetching exact data for one/few features*. Don't use tiles when you need a precise geometry, and don't use pg_featureserv to paint a whole layer.

### Tiles vs. a feature API — they are not interchangeable

A vector tile is a **rendering optimization**, not a data API. Tiles are clipped per-tile, simplified at low zoom, may drop attributes to stay small, and only exist within a layer's zoom range. The moment you need *the real row* — exact geometry, full attributes, or data outside the rendered zoom — you need pg_featureserv (or your own API), not the tile.

---

## 2. PostGIS data modelling

### 2.1 Always store a single, known geometry type — linearize curves on import

**The biggest gotcha in this stack.** LINZ parcels ship as `MULTISURFACE` (curved geometry with circular arcs). PostGIS's GeoJSON writer cannot serialize curves:

```
ERROR: lwgeom_to_geojson: 'MultiSurface' geometry type not supported
```

Martin's MVT path tolerates curves, so the map *looks* fine — but pg_featureserv (and anything calling `ST_AsGeoJSON`) breaks. **Linearize on load**:

```bash
ogr2ogr ... \
  -nlt PROMOTE_TO_MULTI \
  -nlt CONVERT_TO_LINEAR \   # <-- converts MultiSurface/CurvePolygon → MultiPolygon
  -t_srs EPSG:4326 \
  -lco GEOMETRY_NAME=geom
```

If a table is already loaded with curves, fix it in place (rewrites the table + rebuilds indexes in one statement):

```sql
ALTER TABLE public.nz_parcels
  ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326)
  USING ST_Multi(ST_CurveToLine(geom));
```

**Principle:** constrain the geometry column to a concrete type (`geometry(MultiPolygon, 4326)`), not bare `geometry`. A typed column makes bad data fail loudly at write time instead of surprising a downstream consumer.

### 2.2 One SRID everywhere: EPSG:4326

Every layer is reprojected to `4326` on import (`-t_srs EPSG:4326`) and Martin is told `srid: 4326`. Keep it that way — MapLibre expects WGS84, and mixing SRIDs forces per-request reprojection and subtle bbox bugs. Reproject **once, at load time**.

### 2.3 Every table needs a stable integer primary key

`nz_parcels` uses `fid` as its PK. This is non-negotiable for two reasons:

- **pg_featureserv** needs a PK to support `/items/{id}` lookups.
- **MapLibre feature-state** (hover/selection) requires a stable feature id (see §4.2). Martin emits it via `id_column: fid` in `martin.yaml`.

Use a real integer id, not a synthesized one — feature-state silently fails if ids aren't stable across tiles.

### 2.4 Index every geometry column with GIST

```sql
CREATE INDEX IF NOT EXISTS idx_nz_parcels_geom ON public.nz_parcels USING GIST(geom);
```

Without it, Martin's per-tile bbox queries and pg_featureserv bbox filters do sequential scans over millions of rows.

> ⚠️ **Avoid duplicate spatial indexes.** `ogr2ogr` auto-creates a GIST index (`<table>_geom_geom_idx`); if the load script *also* runs `CREATE INDEX idx_..._geom`, you end up with two. Pick one (the explicit named one) and drop the other — duplicates double write cost and storage for zero read benefit.

---

## 3. Martin (vector tile) configuration

### 3.1 Declare tables explicitly in `martin.yaml`

Auto-discovery is convenient but unpredictable. This repo pins each table with `schema`, `geometry_column`, `id_column`, `srid`, zoom range, and an explicit `properties` allow-list. Explicit config means:

- **Predictable tile contents** — you ship exactly the attributes you choose.
- **Smaller tiles** — don't serialize columns the client never reads.
- **Stable feature ids** — `id_column` is set deliberately.

### 3.2 Set `minzoom`/`maxzoom` to match the data's scale

Parcels are `minzoom: 12` — there is no point rendering 2.8M parcels at z4. This keeps low-zoom tiles tiny and protects the DB. **But remember the consequence:** below `minzoom` there are *no tiles*, so click/hover/query against the tile won't work there. If you need to interact below the layer's min zoom, that's a pg_featureserv job, not a tile job.

### 3.3 Only bake in attributes you'll display

The client reads attributes straight off the tile feature (`e.features[0].properties`) with **zero network calls**. That's the whole point of putting `appellation`, `parcel_intent`, `titles`, etc. in the `properties` block — it powers the popup for free. Conversely, large/rarely-used columns (long text, blobs) bloat every tile; fetch those on demand via pg_featureserv instead.

---

## 4. MapLibre / Angular client

### 4.1 Layer visibility ≠ data availability — use a transparent hit layer

**Lesson learned in this repo.** Click and hover handlers bind to a *layer*, and `visibility: none` removes that layer from all queries (`on('click', layer)`, `queryRenderedFeatures`). So toggling a layer off also kills interaction with it.

Pattern: keep an **always-visible transparent hit layer** for interaction, separate from the visual layers that the toggle controls.

```
parcels-fill / parcels-outline   → toggled on/off (the "show all parcels" visuals)
parcels-hit (fill-opacity 0)     → ALWAYS visible — carries clicks, hover, and the
                                    selected-feature highlight
parcels-hit-outline              → ALWAYS visible — selected outline
```

A fill with `fill-opacity: 0` is still rendered and therefore still queryable — only `visibility: none` removes it. This lets you click/highlight a parcel whether or not the visual layer is shown. Drive the highlight from the always-on layer so it looks identical in both states.

### 4.2 Use `feature-state` for hover/selection, never separate sources

Hover and selection are styled with `['feature-state', 'selected']` / `['feature-state', 'hover']` expressions and `setFeatureState({ source, sourceLayer, id }, …)`. This is GPU-side and instant — no source data is mutated, no re-fetch. It only works if features have stable ids (§2.3). Feature-state is shared across every layer on the same source, so one `setFeatureState` call updates the fill, the hit layer, and the outline together.

### 4.3 Keep popups tile-driven; reserve server calls for exact geometry

The popup renders entirely from tile `properties` — fast, offline-capable, no server dependency. The *only* reason this stack calls pg_featureserv is to fetch a parcel's **un-simplified geometry** for the subject-property highlight (tile geometry is clipped/simplified per tile). Match that split in new features: render from tiles, fetch from the API only when you genuinely need precise geometry or attributes not in the tile.

### 4.4 Guard server lookups against missing ids

Tile features don't always carry an id (e.g. outside the configured `id_column`, or at the wrong zoom). Always guard before building a request — sending `String(undefined)` produces `/items/undefined` and a 500. Check `feature.id != null` first.

### 4.5 Clean up map resources

The map component removes popups and calls `mapService.destroy()` in `ngOnDestroy`. Always tear down map instances, popups, and event handlers on component destroy — leaked WebGL contexts and listeners accumulate fast in an SPA.

---

## 5. PMTiles / Tippecanoe

- **Pre-tile large static layers**, then serve the single `.pmtiles` file (Martin serves it from `/tiles`, or the client reads it directly via the `pmtiles` protocol). Re-run Tippecanoe only when the source data changes.
- **Match zoom range to use** — meshblocks are `--minimum-zoom=6 --maximum-zoom=14`. Don't over-tile.
- **Manage tile size deliberately** — `--coalesce-densest-as-needed` (and friends like `--drop-densest-as-needed`) keep dense areas under the tile-size limit. Know that these *drop or merge features at low zoom*, so don't rely on every feature being present or fully attributed at every zoom.
- **PMTiles is immutable** — there is no "update one feature." Editable data belongs in PostGIS behind Martin, not in PMTiles.

---

## 6. Operations & reproducibility

- **Idempotent loaders.** `load-data.sh` skips already-downloaded files and uses `-overwrite` / `CREATE … IF NOT EXISTS`, so re-running is safe. Keep new load steps idempotent.
- **Wait on health, not on `sleep`.** Compose gates Martin and pg_featureserv on `postgis` `service_healthy`, and the loader has `wait_for_pg`. Depend on real readiness checks, not arbitrary delays.
- **Pin image versions for anything reproducible.** `postgis:16-3.4` is pinned — good. `martin:latest` and `pg_featureserv:latest` are **not**; pin them to explicit tags before relying on this for anything beyond a local demo, so an upstream change can't silently break you.
- **Keep derived data as code.** Territorial authorities are derived from meshblocks via `derive-ta-from-meshblocks.sql` rather than imported separately — the derivation is version-controlled and repeatable. Prefer this over manual one-off SQL.

---

## 7. Security & configuration (before this leaves localhost)

This stack is wired for **local development**. Harden these before any shared/production deployment:

- **Credentials.** `postgres/postgres` and the connection string is repeated across `docker-compose.yml`, `martin.yaml`, and the loader. Move to secrets / env injection; never ship default creds.
- **CORS.** pg_featureserv runs `CORS Allowed Origins: *`. Lock to known origins.
- **No public write path.** Martin and pg_featureserv connect as the DB superuser. For exposed deployments, connect through a **read-only role** so a serving layer can never mutate data.
- **Front the serving layers.** Don't expose Martin/pg_featureserv/Postgres ports directly; put them behind a reverse proxy with TLS, caching, and rate limiting.
- **API keys don't belong in source.** The LINZ basemap key is hardcoded in `map.component.ts`. Move client keys to build-time config/environment and use a domain-restricted key.

---

## 8. Quick decision guide

```
Need to render many features on the map?
  └─ Large + static?            → PMTiles (Tippecanoe)
  └─ Dynamic / live from DB?    → Martin MVT
Need the exact data for a specific feature (precise geometry / full attributes)?
  └─ pg_featureserv /items/{id}
Need to search/filter by attribute, or query outside the rendered zoom?
  └─ pg_featureserv /items?filter=…  (or your own API)
Just ephemeral UI state (a highlight, a draft)?
  └─ Inline client-side GeoJSON source
Need click/hover to work even when a layer is toggled off?
  └─ Always-visible transparent hit layer + feature-state
```
