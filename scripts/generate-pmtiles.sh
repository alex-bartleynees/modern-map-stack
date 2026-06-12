#!/bin/bash
set -e

DB_HOST="${DB_HOST:-localhost}"
DB_NAME="${DB_NAME:-nz_map}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"

TILES_DIR="$(dirname "$0")/../tiles"
mkdir -p "$TILES_DIR"

echo "Exporting nz_meshblocks from PostGIS and generating PMTiles..."

PGPASSWORD="$DB_PASS" ogr2ogr \
  -f GeoJSON /vsistdout/ \
  "PG:host=$DB_HOST dbname=$DB_NAME user=$DB_USER password=$DB_PASS" \
  -sql "SELECT mb2019_v1_00, ta2019_v1_00, ta2019_v1_00_name, land_area_sq_km, geom FROM nz_meshblocks" \
  | tippecanoe \
    --output="$TILES_DIR/nz-meshblocks.pmtiles" \
    --layer=nz_meshblocks \
    --minimum-zoom=6 \
    --maximum-zoom=14 \
    --coalesce-densest-as-needed \
    --force

echo "PMTiles generated at $TILES_DIR/nz-meshblocks.pmtiles"
ls -lh "$TILES_DIR/nz-meshblocks.pmtiles"
