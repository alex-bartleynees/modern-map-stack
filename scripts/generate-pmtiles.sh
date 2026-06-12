#!/bin/bash
set -e

DB_HOST="${DB_HOST:-localhost}"
DB_NAME="${DB_NAME:-nz_map}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"

TILES_DIR="$(dirname "$0")/../tiles"
mkdir -p "$TILES_DIR"

PG_CONN="PG:host=$DB_HOST dbname=$DB_NAME user=$DB_USER password=$DB_PASS"

# Stream a PostGIS query straight into tippecanoe → PMTiles.
# Martin auto-serves each file in /tiles by its basename (e.g. nz-buildings).
pmtiles_from_sql() {
  local out_name="$1" layer="$2" minz="$3" maxz="$4" sql="$5"

  echo "Generating $out_name.pmtiles (layer $layer, z$minz-$maxz)..."
  PGPASSWORD="$DB_PASS" ogr2ogr \
    -f GeoJSON /vsistdout/ \
    "$PG_CONN" \
    -sql "$sql" \
    | tippecanoe \
      --output="$TILES_DIR/$out_name.pmtiles" \
      --layer="$layer" \
      --minimum-zoom="$minz" \
      --maximum-zoom="$maxz" \
      --coalesce-densest-as-needed \
      --force
  ls -lh "$TILES_DIR/$out_name.pmtiles"
}

pmtiles_from_sql "nz-meshblocks" "nz_meshblocks" 6 14 \
  "SELECT mb2019_v1_00, ta2019_v1_00, ta2019_v1_00_name, land_area_sq_km, geom FROM nz_meshblocks"

# Building footprints only matter when zoomed in, so tile from z14.
pmtiles_from_sql "nz-buildings" "nz_buildings" 14 17 \
  "SELECT building_id, suburb_locality, town_city, territorial_authority, geom FROM nz_buildings"
