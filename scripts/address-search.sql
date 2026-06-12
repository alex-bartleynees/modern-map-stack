-- Trigram index for fast prefix/substring address search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_nz_addresses_full_address_trgm
  ON nz_addresses USING GIN (full_address gin_trgm_ops);

-- pg_featureserv exposes functions in the postgisftw schema as GeoJSON endpoints.
-- GET /functions/postgisftw.address_search/items?q=<text>&limit=<n>
CREATE SCHEMA IF NOT EXISTS postgisftw;

CREATE OR REPLACE FUNCTION postgisftw.address_search(
  q     text    DEFAULT '',
  lim   integer DEFAULT 8
)
RETURNS TABLE(
  address_id   bigint,
  full_address text,
  geom         geometry(Point, 4326)
)
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  SELECT
    fid::bigint                       AS address_id,
    full_address,
    ST_GeometryN(geom, 1)::geometry(Point, 4326) AS geom
  FROM nz_addresses
  WHERE full_address ILIKE '%' || q || '%'
  ORDER BY full_address
  LIMIT lim;
$$;
