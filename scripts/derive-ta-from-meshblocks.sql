-- Derive territorial authority boundaries by dissolving meshblocks.
-- Handles both 2019 and 2023 Stats NZ column name vintages.

DO $$
DECLARE
  ta_code_col  text;
  ta_name_col  text;
BEGIN
  -- Pick whichever vintage is present
  SELECT column_name INTO ta_code_col
    FROM information_schema.columns
   WHERE table_name = 'nz_meshblocks'
     AND column_name IN ('ta2023_v1_00', 'ta2019_v1_00')
   ORDER BY column_name DESC  -- prefer 2023 if both exist
   LIMIT 1;

  SELECT column_name INTO ta_name_col
    FROM information_schema.columns
   WHERE table_name = 'nz_meshblocks'
     AND column_name IN ('ta2023_v1_00_name', 'ta2019_v1_00_name')
   ORDER BY column_name DESC
   LIMIT 1;

  IF ta_code_col IS NULL THEN
    RAISE EXCEPTION 'No TA code column found in nz_meshblocks. '
      'Expected ta2023_v1_00 or ta2019_v1_00.';
  END IF;

  RAISE NOTICE 'Using columns: %, %', ta_code_col, ta_name_col;

  DROP TABLE IF EXISTS nz_territorial_authorities;

  EXECUTE format(
    $sql$
    CREATE TABLE nz_territorial_authorities AS
    SELECT
      %I                           AS ta_code,
      %I                           AS ta_name,
      SUM(land_area_sq_km)         AS land_area_sq_km,
      ST_Multi(ST_Union(geom))::geometry(MultiPolygon, 4326)  AS geom
    FROM nz_meshblocks
    WHERE %I IS NOT NULL
      AND %I NOT IN ('', 'Area Outside Territorial Authority')
    GROUP BY %I, %I
    $sql$,
    ta_code_col, ta_name_col,
    ta_code_col, ta_code_col,
    ta_code_col, ta_name_col
  );

  CREATE INDEX idx_nz_ta_geom ON nz_territorial_authorities USING GIST(geom);

  -- Single interior label point per TA, so symbol labels render once
  -- instead of repeating in every vector tile the polygon spans.
  ALTER TABLE nz_territorial_authorities
    ADD COLUMN label_point geometry(Point, 4326);
  UPDATE nz_territorial_authorities SET label_point = ST_PointOnSurface(geom);
  CREATE INDEX idx_nz_ta_label_point
    ON nz_territorial_authorities USING GIST(label_point);

  RAISE NOTICE 'Created nz_territorial_authorities with % rows.',
    (SELECT COUNT(*) FROM nz_territorial_authorities);
END;
$$;
