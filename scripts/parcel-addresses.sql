-- Pre-compute parcel_fid on nz_addresses for fast index-scan lookups.
-- Run after both nz_addresses and nz_parcels are loaded.
ALTER TABLE nz_addresses ADD COLUMN IF NOT EXISTS parcel_fid integer;

UPDATE nz_addresses a
SET parcel_fid = p.fid
FROM nz_parcels p
WHERE ST_Within(ST_GeometryN(a.geom, 1), p.geom);

CREATE INDEX IF NOT EXISTS idx_nz_addresses_parcel_fid ON nz_addresses (parcel_fid);

-- Simple index-scan lookup — replaces the live spatial join.
CREATE OR REPLACE FUNCTION postgisftw.parcel_addresses(parcel_fid integer DEFAULT 0)
RETURNS TABLE(full_address text)
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  SELECT full_address
  FROM nz_addresses
  WHERE nz_addresses.parcel_fid = $1
  ORDER BY full_address
  LIMIT 10;
$$;
