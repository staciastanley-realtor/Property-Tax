# Importing Michigan's boundary data (Milestone 2)

This loads the actual polygon geometry into `jurisdictions.geometry` and
`school_districts.geometry` so `PostGisAdapter` can do point-in-polygon
lookups. `scripts/import-millage.ts` must run first — it creates the
`jurisdictions`/`school_districts` rows (by name, geometry NULL) that
this step attaches geometry to.

This machine has no network access, so these steps need to run on yours.

## 1. Download the data (free, from the State of Michigan)

Michigan's Geographic Framework publishes both layers on the state's
open data portal at **gis-michigan.opendata.arcgis.com**:

- **Minor Civil Divisions** (cities & townships — search "Minor Civil
  Divisions" or "MCDs and School Districts") — covers county and
  municipality boundaries.
- **School Districts** — search "School Districts (v17a)" or similar;
  the state maintains the canonical Local Education Agency boundaries.

Download each as **GeoJSON** or **Shapefile** (either works with the
command below). Confirm the current dataset names/URLs on the portal
before downloading — open-data catalogs get renamed and re-versioned,
so don't rely on this file's file names being current.

## 2. Load into PostGIS with ogr2ogr

`ogr2ogr` (part of GDAL) can load a shapefile/GeoJSON directly into an
existing Postgres table. Load into a staging table first, then update
the real tables by matching on name — this avoids overwriting the rows
`import-millage.ts` already created.

```bash
# Stage the municipal boundaries
ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" MinorCivilDivisions.shp \
  -nln staging_mcd -overwrite

# Stage the school district boundaries
ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" SchoolDistricts.shp \
  -nln staging_school_districts -overwrite
```

## 3. Attach geometry to the real tables by name

The exact column name for the MCD/school district name in the state's
export may differ (check with `\d staging_mcd` in psql first — common
names are `NAME`, `MCD_NAME`, `LSAD_NAME`, or similar). Adjust the
column name below accordingly:

```sql
UPDATE jurisdictions j
SET geometry = ST_Multi(s.wkb_geometry)
FROM staging_mcd s
WHERE j.type IN ('city', 'township')
  AND lower(j.canonical_name) = lower(s.name); -- adjust column name

UPDATE school_districts sd
SET geometry = ST_Multi(s.wkb_geometry)
FROM staging_school_districts s
WHERE lower(sd.canonical_name) = lower(s.name); -- adjust column name
```

## 4. Check what didn't match

Because the millage report's school district names are truncated (see
main README), a straight name match will miss many rows. After running
the UPDATE above:

```sql
SELECT canonical_name FROM jurisdictions WHERE geometry IS NULL;
SELECT canonical_name FROM school_districts WHERE geometry IS NULL;
```

Anything listed needs a manual alias — insert a row into
`school_district_aliases` (or `jurisdiction_aliases`) mapping the full
GIS name to the truncated report name, with `approved = true` only
after you've verified it's correct, per Section 7 ("never unreviewed
fuzzy matching"). This is expected to be manual, one-time work per
truncated name — there are a few hundred distinct school district names
in the report, not thousands.

## 5. Verify

```sql
SELECT count(*) FROM jurisdictions WHERE geometry IS NOT NULL;
SELECT count(*) FROM school_districts WHERE geometry IS NOT NULL;
```

Once these are non-zero and cover your target market, `PostGisAdapter`
is live — no code changes needed, since `app/api/calculate/route.ts`
already switches to it automatically once `DATABASE_URL` is set.
