// Matches a full, real school district name (from a real GIS/geocoding
// provider, e.g. "Clarkston Community Schools") against the millage
// report's truncated, abbreviated names (e.g. "CLARKSTON COMM SCH") —
// Blueprint Section 7's crosswalk problem, solved with a deterministic
// abbreviation + truncation model rather than fuzzy/similarity scoring.
//
// The report's names appear to be the state's own house-style
// abbreviation (Community → COMM, Schools → SCH, District → DIST, etc.)
// hard-truncated to ~21 characters — confirmed by checking the length
// distribution of data/millage-2025.json's school_district field
// (clusters at 19–21 chars). This function reproduces that
// transformation on a real full name and checks for an exact or
// prefix match against the known candidates for the buyer's detected
// county/municipality/village — never a broader fuzzy search, and
// never a match against a candidate outside that narrowed list.
//
// Returns null (not a guess) when nothing lines up — callers must fall
// back to the manual-correction dropdown (already built) rather than
// accept an unreviewed match, per Section 7 and 11.

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bCOMMUNITY\b/g, "COMM"],
  [/\bCONSOLIDATED\b/g, "CONSOL"],
  [/\bDISTRICT\b/g, "DIST"],
  [/\bTOWNSHIP\b/g, "TWP"],
  [/\bSCHOOLS\b/g, "SCH"],
  [/\bSCHOOL\b/g, "SCH"],
  [/\bPUBLIC\b/g, "PUB"],
  [/\bINTERMEDIATE\b/g, "INTER"],
];

function plainUpper(fullName: string): string {
  return fullName.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function toReportStyle(fullName: string): string {
  let s = plainUpper(fullName);
  for (const [pattern, replacement] of ABBREVIATIONS) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

/**
 * @param fullName Real school district name from a geocoding/GIS provider.
 * @param candidates The known-valid school district names for the
 *   buyer's already-detected county/municipality/village — from
 *   lib/millage/index.ts, never the full statewide list. Narrowing the
 *   candidate pool first is what makes an exact match here safe rather
 *   than a coincidence.
 */
export function matchSchoolDistrictName(fullName: string, candidates: string[]): string | null {
  // The report's truncation turns out to be inconsistent: some entries
  // abbreviate words first ("Clarkston Community Schools" →
  // "CLARKSTON COMM SCH"), others just hard-truncate the full name with
  // no abbreviation ("Waterford School District" →
  // "WATERFORD SCHOOL DIS"). Rather than guess which style applies, try
  // both, truncated to each candidate's own exact length — a real match
  // only happens when the shortened guess equals that specific
  // candidate string, not a fuzzy proximity score.
  const plain = plainUpper(fullName);
  const abbreviated = toReportStyle(fullName);

  for (const candidate of candidates) {
    const c = candidate.trim();
    if (plain.slice(0, c.length) === c) return candidate;
    if (abbreviated.slice(0, c.length) === c) return candidate;
  }
  return null;
}
