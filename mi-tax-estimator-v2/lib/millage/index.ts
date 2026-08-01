// Builds a compact cascading-dropdown index (county → municipality →
// village → school district) from the same data/millage-2025.json used
// by lib/millage/lookup.ts — one source of truth, no separate dataset
// to keep in sync (V1's calculator embedded its own copy of the whole
// dataset in the page; this reads the same file the server already
// uses for matching).

import millageDataset from "@/data/millage-2025.json";
import type { MillageRecord } from "@/lib/millage/lookup";

export interface JurisdictionIndex {
  counties: string[];
  municipalitiesByCounty: Record<string, string[]>;
  villagesByCountyMuni: Record<string, string[]>; // key: `${county}::${municipality}`
  schoolsByCountyMuniVillage: Record<string, string[]>; // key: `${county}::${municipality}::${village ?? ""}`
}

let cached: JurisdictionIndex | null = null;

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function buildJurisdictionIndex(): JurisdictionIndex {
  if (cached) return cached;

  const records = millageDataset.records as MillageRecord[];

  const counties = sortedUnique(records.map((r) => r.county));

  const municipalitiesByCounty: Record<string, string[]> = {};
  const villagesByCountyMuni: Record<string, string[]> = {};
  const schoolsByCountyMuniVillage: Record<string, string[]> = {};

  for (const county of counties) {
    municipalitiesByCounty[county] = sortedUnique(
      records.filter((r) => r.county === county).map((r) => r.municipality)
    );
  }

  const muniKeys = sortedUnique(records.map((r) => `${r.county}::${r.municipality}`));
  for (const muniKey of muniKeys) {
    const [county, municipality] = muniKey.split("::");
    villagesByCountyMuni[muniKey] = sortedUnique(
      records
        .filter((r) => r.county === county && r.municipality === municipality && r.village)
        .map((r) => r.village as string)
    );
  }

  const leafKeys = sortedUnique(
    records.map((r) => `${r.county}::${r.municipality}::${r.village ?? ""}`)
  );
  for (const leafKey of leafKeys) {
    const [county, municipality, village] = leafKey.split("::");
    schoolsByCountyMuniVillage[leafKey] = sortedUnique(
      records
        .filter(
          (r) =>
            r.county === county &&
            r.municipality === municipality &&
            (r.village ?? "") === village
        )
        .map((r) => r.school_district)
    );
  }

  cached = { counties, municipalitiesByCounty, villagesByCountyMuni, schoolsByCountyMuniVillage };
  return cached;
}
