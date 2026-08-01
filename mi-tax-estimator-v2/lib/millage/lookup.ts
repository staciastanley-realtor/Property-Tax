// Millage matching — Blueprint Section 7 (name-matching & crosswalk rules).
// Loads the verified 2025 statewide millage dataset (data/millage-2025.json,
// parsed from the Michigan Dept. of Treasury's 2025_Total_Rates.PDF) and
// matches on normalized names. A production version replaces this with a
// database query against millage_rates + jurisdiction_aliases/
// school_district_aliases, using stable IDs first and an approved alias
// table as fallback — never unreviewed fuzzy matching.
//
// IMPORTANT — school district names in the source report are truncated
// to a fixed column width (e.g. "CLARKSTON COMM SCH", not the full legal
// name). A real GIS adapter will return full school district names, so
// Milestone 2 needs an alias/crosswalk table mapping full GIS names to
// these truncated source names before this matching logic can be trusted
// against real GIS output — see Blueprint Section 7.

import millageData from "@/data/millage-2025.json";
import type { JurisdictionMatch } from "@/lib/adapters/gis";

export interface MillageRecord {
  county: string;
  municipality: string;
  municipality_code: string | null;
  village: string | null;
  school_district: string;
  principal_residence_rate: number;
  nonhomestead_rate: number;
  industrial_personal_rate: number;
  commercial_personal_rate: number;
  principal_residence_rate_w_special_assessment: number;
  nonhomestead_rate_w_special_assessment: number;
}

export interface MillageLookupResult {
  record: MillageRecord | null;
  status: "matched" | "ambiguous" | "unmatched";
  candidates?: MillageRecord[]; // populated when status === "ambiguous"
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\btwp\b/g, "township")
    .replace(/\bcharter\b/g, "") // Census MCD names sometimes say "Charter Township";
    // the millage report never does — drop the word so both sides align.
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findMillageRecord(match: JurisdictionMatch): MillageLookupResult {
  const records = (millageData as { records: MillageRecord[] }).records || [];

  const found = records.filter((r) => {
    const countyMatch = normalize(r.county) === normalize(match.county);
    const muniMatch = normalize(r.municipality) === normalize(match.municipality);
    const schoolMatch = normalize(r.school_district) === normalize(match.schoolDistrict);
    const villageMatch =
      (r.village === null && match.village === null) ||
      (r.village !== null && match.village !== null && normalize(r.village) === normalize(match.village));

    return countyMatch && muniMatch && schoolMatch && villageMatch;
  });

  if (found.length === 0) return { record: null, status: "unmatched" };

  // The source report legitimately contains more than one rate row for the
  // same (county, municipality, village, school district) combination in a
  // small number of cases — community college district variation or
  // transfer properties (see millage-2025.json metadata.disclaimers).
  // Never silently pick one; surface it for manual correction instead.
  if (found.length > 1) return { record: null, status: "ambiguous", candidates: found };

  return { record: found[0], status: "matched" };
}

/**
 * Returns the real, valid school district names for a given
 * county/municipality/village combination — used by a real GIS
 * adapter to narrow the candidate pool BEFORE attempting to crosswalk
 * a full school district name against the report's truncated one
 * (lib/millage/schoolMatch.ts). Matching against this narrowed list,
 * rather than every school district in the state, is what makes an
 * exact/prefix match trustworthy instead of coincidental.
 */
export function candidateSchoolsFor(county: string, municipality: string, village: string | null): string[] {
  const records = (millageData as { records: MillageRecord[] }).records || [];
  return records
    .filter((r) => {
      const countyMatch = normalize(r.county) === normalize(county);
      const muniMatch = normalize(r.municipality) === normalize(municipality);
      const villageMatch =
        (r.village === null && village === null) ||
        (r.village !== null && village !== null && normalize(r.village) === normalize(village));
      return countyMatch && muniMatch && villageMatch;
    })
    .map((r) => r.school_district);
}
