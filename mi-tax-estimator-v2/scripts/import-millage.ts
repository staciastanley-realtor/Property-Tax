// Milestone 2 — imports data/millage-2025.json into Postgres.
//
// Usage:
//   DATABASE_URL=postgres://... npx tsx scripts/import-millage.ts
//
// What this does (Blueprint Section 9 — admin data import):
//   1. Upserts every distinct county as a `jurisdictions` row (type='county').
//   2. Upserts every distinct municipality as a `jurisdictions` row
//      (type inferred as 'city' or 'township' from the name), linked to
//      its county.
//   3. Upserts every distinct village overlay as a `jurisdictions` row
//      (type='village'), linked to its county.
//   4. Upserts every distinct school district as a `school_districts` row.
//   5. Inserts one `millage_rates` row per source record.
//
// IMPORTANT — this script does NOT set any `geometry` column. Rows are
// created with geometry = NULL. The PostGisAdapter (lib/adapters/gis.ts)
// can't match anything until boundaries are loaded separately — see
// scripts/import-boundaries.md. Millage-by-name matching works
// immediately after this script runs; point-in-polygon lookup doesn't
// until boundaries are loaded on top of these same rows (matched by
// canonical_name).
//
// The 27 jurisdiction combinations flagged in
// data/millage-2025-ambiguous-combos.json will hit the millage_rates
// UNIQUE constraint on the second row for the same combo — that's
// intentional, not a bug. This script catches those conflicts, skips
// them, and writes scripts/output/import-skipped.json listing exactly
// which rows need a human to pick the right one, instead of guessing.

import { Pool } from "pg";
import millageDataset from "../data/millage-2025.json";
import fs from "fs";
import path from "path";

type Rec = (typeof millageDataset.records)[number];

function inferMuniType(name: string): "city" | "township" {
  const n = name.trim();
  if (/city$/i.test(n) || /\bcit$/i.test(n)) return "city"; // handles a truncated
  // source-data name: "Grosse Pointe Shores Village Cit" (a home-rule city,
  // legally distinct from its historical "village" name) — see README.
  if (/twp$/i.test(n) || /township$/i.test(n)) return "township";
  console.warn(`Could not infer city/township for "${n}" — defaulting to township. Review manually.`);
  return "township";
}

async function upsertJurisdiction(
  pool: Pool,
  type: "county" | "city" | "township" | "village",
  name: string,
  countyId: string | null
): Promise<string> {
  const existing = await pool.query(
    `SELECT id FROM jurisdictions WHERE type = $1 AND canonical_name = $2 AND (county_id = $3 OR ($3 IS NULL AND county_id IS NULL))`,
    [type, name, countyId]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const inserted = await pool.query(
    `INSERT INTO jurisdictions (type, canonical_name, county_id) VALUES ($1, $2, $3) RETURNING id`,
    [type, name, countyId]
  );
  return inserted.rows[0].id;
}

async function upsertSchoolDistrict(pool: Pool, name: string): Promise<string> {
  const existing = await pool.query(`SELECT id FROM school_districts WHERE canonical_name = $1`, [name]);
  if (existing.rows[0]) return existing.rows[0].id;

  const inserted = await pool.query(
    `INSERT INTO school_districts (canonical_name) VALUES ($1) RETURNING id`,
    [name]
  );
  return inserted.rows[0].id;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. See .env.example.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const records = millageDataset.records as Rec[];
  const taxYear = millageDataset.metadata.tax_year;
  const sourceReference = millageDataset.metadata.source_document;

  const countyIds = new Map<string, string>();
  const muniIds = new Map<string, string>(); // key: `${county}::${municipality}`
  const villageIds = new Map<string, string>(); // key: `${county}::${village}`
  const schoolIds = new Map<string, string>();

  let inserted = 0;
  const skipped: Rec[] = [];

  for (const r of records) {
    if (!countyIds.has(r.county)) {
      countyIds.set(r.county, await upsertJurisdiction(pool, "county", r.county, null));
    }
    const countyId = countyIds.get(r.county)!;

    const muniKey = `${r.county}::${r.municipality}`;
    if (!muniIds.has(muniKey)) {
      muniIds.set(muniKey, await upsertJurisdiction(pool, inferMuniType(r.municipality), r.municipality, countyId));
    }
    const municipalityId = muniIds.get(muniKey)!;

    let villageId: string | null = null;
    if (r.village) {
      const villageKey = `${r.county}::${r.village}`;
      if (!villageIds.has(villageKey)) {
        villageIds.set(villageKey, await upsertJurisdiction(pool, "village", r.village, countyId));
      }
      villageId = villageIds.get(villageKey)!;
    }

    if (!schoolIds.has(r.school_district)) {
      schoolIds.set(r.school_district, await upsertSchoolDistrict(pool, r.school_district));
    }
    const schoolDistrictId = schoolIds.get(r.school_district)!;

    try {
      const res = await pool.query(
        `INSERT INTO millage_rates
           (tax_year, county_id, municipality_id, village_id, school_district_id,
            principal_residence_rate, nonhomestead_rate, source_reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (tax_year, county_id, municipality_id, village_id, school_district_id) DO NOTHING
         RETURNING id`,
        [
          taxYear,
          countyId,
          municipalityId,
          villageId,
          schoolDistrictId,
          r.principal_residence_rate,
          r.nonhomestead_rate,
          sourceReference,
        ]
      );
      if (res.rowCount === 0) {
        skipped.push(r);
      } else {
        inserted++;
      }
    } catch (err) {
      console.error(`Failed on ${r.county}/${r.municipality}/${r.school_district}:`, err);
      skipped.push(r);
    }
  }

  const outDir = path.join(__dirname, "output");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "import-skipped.json"), JSON.stringify(skipped, null, 2));

  console.log(`Inserted ${inserted} millage_rates rows.`);
  console.log(`Skipped ${skipped.length} rows (duplicate jurisdiction combo — needs manual pick).`);
  console.log(`See scripts/output/import-skipped.json for the skipped rows.`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
