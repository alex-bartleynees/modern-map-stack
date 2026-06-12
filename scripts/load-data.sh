#!/bin/bash
set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nz_map}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"
KOORDINATES_KEY="${KOORDINATES_KEY:-}"
LINZ_KEY="${LINZ_KEY:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../data"
mkdir -p "$DATA_DIR"

export PGPASSWORD="$DB_PASS"

wait_for_pg() {
  echo "Waiting for PostgreSQL..."
  until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" 2>/dev/null; do
    sleep 2
  done
  echo "PostgreSQL is ready."
}

download_statsnz_layer() {
  local layer_id="$1"
  local output_file="$2"
  local label="$3"

  if [ -f "$output_file" ] && [ -s "$output_file" ]; then
    echo "$label already downloaded, skipping."
    return 0
  fi

  if [ -z "$KOORDINATES_KEY" ]; then
    cat <<EOF
ERROR: $label not found at $output_file.

To download it:
  1. Create a free account at https://datafinder.stats.govt.nz
  2. Generate an API key at https://datafinder.stats.govt.nz/my/api/
  3. Re-run with: KOORDINATES_KEY=your_key_here ./scripts/load-data.sh

Or manually download the GeoPackage from:
  https://datafinder.stats.govt.nz/layer/$layer_id/
and save it to: $output_file
EOF
    exit 1
  fi

  echo "Downloading $label..."
  curl -fsSL \
    -H "Authorization: key $KOORDINATES_KEY" \
    "https://datafinder.stats.govt.nz/services;key=$KOORDINATES_KEY/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=layer-$layer_id&outputFormat=json" \
    -o "$output_file"
}

download_linz_layer() {
  local layer_id="$1"
  local output_file="$2"
  local table="$3"
  local label="$4"

  if [ -f "$output_file" ] && [ -s "$output_file" ]; then
    echo "$label already downloaded, skipping." >&2
    return 0
  fi

  if [ -z "$LINZ_KEY" ]; then
    cat >&2 <<EOF
ERROR: LINZ_KEY not set. Cannot download $label (LINZ layer $layer_id).

Re-run with: LINZ_KEY=your_key ./scripts/load-data.sh

Get a free key at https://data.linz.govt.nz (sign in → API Keys).
EOF
    exit 1
  fi

  echo "Downloading $label from LINZ (layer-$layer_id, large dataset — this will take a while)..." >&2

  # ogr2ogr reads LINZ WFS directly, handling pagination automatically.
  # Writing to GeoPackage first avoids holding the full dataset in memory.
  ogr2ogr \
    -f GPKG "$output_file" \
    "WFS:https://data.linz.govt.nz/services;key=$LINZ_KEY/wfs" \
    "layer-$layer_id" \
    -nln "$table" \
    -t_srs EPSG:4326 \
    -progress >&2
}

load_table() {
  local file="$1"
  local table="$2"
  local label="$3"

  echo "Loading $label into $table..."
  ogr2ogr \
    -f PostgreSQL \
    "PG:host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER password=$DB_PASS" \
    "$file" \
    -nln "$table" \
    -nlt PROMOTE_TO_MULTI \
    -nlt CONVERT_TO_LINEAR \
    -t_srs EPSG:4326 \
    -lco GEOMETRY_NAME=geom \
    -overwrite
}

main() {
  wait_for_pg

  echo "Enabling PostGIS..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "CREATE EXTENSION IF NOT EXISTS postgis;"

  # Meshblocks (Stats NZ layer 98971)
  download_statsnz_layer "98971" "$DATA_DIR/nz_meshblocks.geojson" "NZ Meshblocks 2023"
  load_table "$DATA_DIR/nz_meshblocks.geojson" "nz_meshblocks" "NZ Meshblocks"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "CREATE INDEX IF NOT EXISTS idx_nz_meshblocks_geom ON public.nz_meshblocks USING GIST(geom);"

  # Territorial Authorities (derived from meshblocks — see derive-ta-from-meshblocks.sql)
  if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      -c "SELECT 1 FROM nz_territorial_authorities LIMIT 1;" &>/dev/null; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      -f "$SCRIPT_DIR/derive-ta-from-meshblocks.sql"
  else
    echo "nz_territorial_authorities already exists, skipping."
  fi

  # NZ Parcels (LINZ layer 50772)
  download_linz_layer "50772" "$DATA_DIR/nz_parcels.gpkg" "nz_parcels" "NZ Primary Land Parcels"
  load_table "$DATA_DIR/nz_parcels.gpkg" "nz_parcels" "NZ Parcels"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "CREATE INDEX IF NOT EXISTS idx_nz_parcels_geom ON public.nz_parcels USING GIST(geom);"

  # NZ Building Outlines (LINZ layer 101290)
  download_linz_layer "101290" "$DATA_DIR/nz_buildings.gpkg" "nz_buildings" "NZ Building Outlines"
  load_table "$DATA_DIR/nz_buildings.gpkg" "nz_buildings" "NZ Buildings"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "CREATE INDEX IF NOT EXISTS idx_nz_buildings_geom ON public.nz_buildings USING GIST(geom);"

  # NZ Property Titles (LINZ layer 50804) — excludes ownership; freely distributed
  download_linz_layer "50804" "$DATA_DIR/nz_titles.gpkg" "nz_titles" "NZ Property Titles"
  load_table "$DATA_DIR/nz_titles.gpkg" "nz_titles" "NZ Property Titles"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "CREATE INDEX IF NOT EXISTS idx_nz_titles_geom ON public.nz_titles USING GIST(geom);"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "CREATE INDEX IF NOT EXISTS idx_nz_titles_title_no ON public.nz_titles (title_no);"

  # NZ Addresses (LINZ layer 123113)
  download_linz_layer "123113" "$DATA_DIR/nz_addresses.gpkg" "nz_addresses" "NZ Addresses"
  load_table "$DATA_DIR/nz_addresses.gpkg" "nz_addresses" "NZ Addresses"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "CREATE INDEX IF NOT EXISTS idx_nz_addresses_geom ON public.nz_addresses USING GIST(geom);"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$SCRIPT_DIR/address-search.sql"

  echo ""
  echo "=== Record counts ==="
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<'SQL'
SELECT 'nz_meshblocks'             AS table_name, COUNT(*) FROM public.nz_meshblocks
UNION ALL
SELECT 'nz_territorial_authorities',              COUNT(*) FROM public.nz_territorial_authorities
UNION ALL
SELECT 'nz_parcels',                              COUNT(*) FROM public.nz_parcels
UNION ALL
SELECT 'nz_buildings',                            COUNT(*) FROM public.nz_buildings
UNION ALL
SELECT 'nz_titles',                              COUNT(*) FROM public.nz_titles
UNION ALL
SELECT 'nz_addresses',                            COUNT(*) FROM public.nz_addresses;
SQL

  echo ""
  echo "Generating PMTiles..."
  bash "$SCRIPT_DIR/generate-pmtiles.sh"

  echo ""
  echo "Data load complete."
}

main "$@"
