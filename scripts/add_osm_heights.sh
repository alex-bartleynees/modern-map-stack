#!/usr/bin/env bash
set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nz_map}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"

export PGPASSWORD="$DB_PASS"

echo "Adding height_m column to nz_buildings..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
  ALTER TABLE nz_buildings ADD COLUMN IF NOT EXISTS height_m FLOAT;
"

echo "Fetching NZ building heights from Overpass API (this may take a minute)..."
cat > /tmp/overpass_query.txt << 'QUERY'
data=[out:json][timeout:150];
area["ISO3166-1"="NZ"][admin_level="2"]->.nz;
(
  way["building"]["height"](area.nz);
  way["building"]["building:levels"](area.nz);
  relation["building"]["height"](area.nz);
);
out center tags;
QUERY

curl -fsSL --max-time 180 \
  "https://overpass-api.de/api/interpreter" \
  --data @/tmp/overpass_query.txt \
  -o /tmp/osm_building_heights.json

echo "Importing heights and spatial-joining to nz_buildings..."
python3 - <<'PY'
import json, os, sys

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 not found. Install with: pip install psycopg2-binary")
    sys.exit(1)

with open('/tmp/osm_building_heights.json') as f:
    data = json.load(f)

conn = psycopg2.connect(
    host=os.getenv("DB_HOST", "localhost"),
    port=os.getenv("DB_PORT", "5432"),
    dbname=os.getenv("DB_NAME", "nz_map"),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASS", "postgres"),
)
cur = conn.cursor()

cur.execute("""
    CREATE TEMP TABLE _osm_heights (
        lat  DOUBLE PRECISION,
        lon  DOUBLE PRECISION,
        h    FLOAT,
        geom geometry(Point, 4326)
    )
""")

rows = []
for el in data.get("elements", []):
    tags   = el.get("tags", {})
    center = el.get("center") or {}
    if not center:
        continue
    h = None
    raw = tags.get("height", "")
    try:
        h = float(raw.split()[0])
    except (ValueError, IndexError):
        pass
    if h is None:
        lvl = tags.get("building:levels", "")
        try:
            h = int(lvl) * 3.5
        except (ValueError, TypeError):
            pass
    if h and h > 0:
        rows.append((center["lat"], center["lon"], h))

cur.executemany(
    "INSERT INTO _osm_heights(lat,lon,h,geom) VALUES (%s,%s,%s,ST_SetSRID(ST_MakePoint(%s,%s),4326))",
    [(lat, lon, h, lon, lat) for lat, lon, h in rows],
)
# Index the temp table so the spatial join uses the nz_buildings GIST index efficiently
cur.execute("CREATE INDEX ON _osm_heights USING GIST(geom)")
conn.commit()
print(f"  Loaded {len(rows)} OSM height records")

# 0.0003 degrees ≈ 25m at NZ latitude — geometry ops are much faster than geography
cur.execute("""
    UPDATE nz_buildings nb
    SET    height_m = o.h
    FROM (
        SELECT DISTINCT ON (o.lat, o.lon)
               o.lat, o.lon, o.h,
               nb2.fid AS matched_fid
        FROM   _osm_heights o
        JOIN   nz_buildings nb2
               ON ST_DWithin(nb2.geom, o.geom, 0.0003)
        ORDER  BY o.lat, o.lon,
                  ST_Distance(nb2.geom, o.geom)
    ) o
    WHERE nb.fid = o.matched_fid
""")
updated = cur.rowcount
conn.commit()
print(f"  Updated {updated} buildings with real heights")

# Quick sanity check — top 5 tallest
cur.execute("""
    SELECT COALESCE(name, '(unnamed)'), height_m
    FROM   nz_buildings
    WHERE  height_m IS NOT NULL
    ORDER  BY height_m DESC
    LIMIT  5
""")
print("  Top 5 tallest buildings:")
for name, h in cur.fetchall():
    print(f"    {name}: {h}m")

conn.close()
PY

echo "OSM height enrichment complete."
