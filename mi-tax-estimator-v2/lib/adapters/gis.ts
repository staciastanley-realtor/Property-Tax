// GIS jurisdiction-lookup adapter interface — Blueprint Section 5 & 7.
// Real implementation should run PostGIS point-in-polygon queries against
// the jurisdictions/school_districts tables (see db/schema.sql).

export interface JurisdictionMatch {
  county: string;
  municipality: string;
  village: string | null;
  schoolDistrict: string;
  matchStatus: "matched" | "ambiguous" | "unmatched";
}

export interface GisAdapter {
  lookup(latitude: number, longitude: number): Promise<JurisdictionMatch>;
}

/**
 * Mock adapter. Always resolves to one real jurisdiction combination
 * from the verified 2025 millage data (data/millage-2025.json) — Oakland
 * County / Independence Twp / Clarkston Comm Sch, no village — so
 * Milestone 1 is testable end-to-end with a REAL rate, without a real
 * GIS engine or database. (An earlier draft of this mock invented a
 * "City of the Village of Clarkston" overlay that doesn't appear in the
 * source report; Clarkston is its own separate municipality there, not
 * a village nested in Independence Township. Fixed once the real data
 * arrived — don't reintroduce jurisdiction combos that aren't in
 * data/millage-2025.json.)
 *
 * DO NOT use in production. Replace with a PostGIS-backed adapter.
 */
export class MockGisAdapter implements GisAdapter {
  async lookup(_latitude: number, _longitude: number): Promise<JurisdictionMatch> {
    return {
      county: "Oakland",
      municipality: "Independence Twp",
      village: null,
      schoolDistrict: "CLARKSTON COMM SCH",
      matchStatus: "matched",
    };
  }
}

/**
 * Real GIS adapter — PostGIS point-in-polygon lookup against the
 * jurisdictions and school_districts tables (db/schema.sql). Requires
 * DATABASE_URL in the server environment and a database populated via
 * scripts/import-boundaries.md — see that file for where to get
 * Michigan's boundary data (free, from the state) and how to load it.
 *
 * Runs four independent point-in-polygon queries (county, municipality,
 * village, school district) rather than one big join, so each layer can
 * report its own match count. A layer returning 0 rows means the point
 * fell outside all polygons for that layer (unmatched); more than 1 row
 * means overlapping/duplicate geometry data (ambiguous) — both are
 * surfaced rather than guessed at, per Blueprint Section 7 and 11.
 */
export class PostGisAdapter implements GisAdapter {
  async lookup(latitude: number, longitude: number): Promise<JurisdictionMatch> {
    // Imported lazily so this file can still be imported by code paths
    // that never construct a PostGisAdapter without requiring `pg` or a
    // DATABASE_URL to be present (e.g. when only the Mock adapter runs).
    const { getPool } = await import("@/lib/db/pool");
    const pool = getPool();

    const point = "ST_SetSRID(ST_MakePoint($2, $1), 4326)"; // note: (lng, lat) order for MakePoint

    const countyRes = await pool.query(
      `SELECT canonical_name FROM jurisdictions
       WHERE type = 'county' AND active AND ST_Contains(geometry, ${point})`,
      [latitude, longitude]
    );
    const muniRes = await pool.query(
      `SELECT canonical_name FROM jurisdictions
       WHERE type IN ('city', 'township') AND active AND ST_Contains(geometry, ${point})`,
      [latitude, longitude]
    );
    const villageRes = await pool.query(
      `SELECT canonical_name FROM jurisdictions
       WHERE type = 'village' AND active AND ST_Contains(geometry, ${point})`,
      [latitude, longitude]
    );
    const schoolRes = await pool.query(
      `SELECT canonical_name FROM school_districts
       WHERE active AND ST_Contains(geometry, ${point})`,
      [latitude, longitude]
    );

    // Village is the one layer where 0 matches is the NORMAL case (most
    // points aren't inside a village overlay) — only >1 is a problem.
    const layersOk =
      countyRes.rowCount === 1 && muniRes.rowCount === 1 && schoolRes.rowCount === 1 && villageRes.rowCount! <= 1;
    const anyAmbiguous =
      countyRes.rowCount! > 1 || muniRes.rowCount! > 1 || schoolRes.rowCount! > 1 || villageRes.rowCount! > 1;
    const anyUnmatched = countyRes.rowCount === 0 || muniRes.rowCount === 0 || schoolRes.rowCount === 0;

    const matchStatus: JurisdictionMatch["matchStatus"] = layersOk
      ? "matched"
      : anyAmbiguous
      ? "ambiguous"
      : anyUnmatched
      ? "unmatched"
      : "ambiguous";

    return {
      county: countyRes.rows[0]?.canonical_name ?? "",
      municipality: muniRes.rows[0]?.canonical_name ?? "",
      village: villageRes.rows[0]?.canonical_name ?? null,
      schoolDistrict: schoolRes.rows[0]?.canonical_name ?? "",
      matchStatus,
    };
  }
}

/**
 * Real GIS adapter — U.S. Census Bureau Geographies API. Free, no API
 * key, no database to run — genuinely zero setup, which is why this is
 * the default GIS adapter rather than something gated behind
 * DATABASE_URL like PostGisAdapter. Uses the same free federal
 * boundary data (County Subdivisions, Incorporated Places, School
 * Districts) that scripts/import-boundaries.md has you load into
 * Postgres — this adapter just queries it live over the API instead of
 * a local database.
 *
 * The school district crosswalk is the one genuinely hard part: the
 * millage report's names are truncated/abbreviated (see
 * lib/millage/schoolMatch.ts), so a real full name from the Census API
 * doesn't always resolve automatically. When it can't, this returns
 * matchStatus "unmatched" WITH whatever county/municipality/village it
 * did resolve — the caller can pre-fill the manual-correction dropdown
 * with that partial result rather than making the buyer start from
 * scratch. Never guesses the school district.
 */
export class CensusGisAdapter implements GisAdapter {
  async lookup(latitude: number, longitude: number): Promise<JurisdictionMatch> {
    const { candidateSchoolsFor } = await import("@/lib/millage/lookup");
    const { matchSchoolDistrictName } = await import("@/lib/millage/schoolMatch");

    const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
    url.searchParams.set("x", String(longitude));
    url.searchParams.set("y", String(latitude));
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("vintage", "Current_Current");
    url.searchParams.set(
      "layers",
      "Counties,County Subdivisions,Incorporated Places,Unified School Districts,Elementary School Districts,Secondary School Districts"
    );
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Census geographies request failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const geographies = data?.result?.geographies ?? {};

    const countyRaw = geographies["Counties"]?.[0]?.NAME as string | undefined;
    const county = countyRaw?.replace(/\s+County$/i, "").trim() ?? "";

    const municipality = (geographies["County Subdivisions"]?.[0]?.NAME as string | undefined) ?? "";

    // A village overlay shows up as its own Incorporated Place, distinct
    // from the township/city County Subdivision it sits inside. A city
    // whose Incorporated Place matches its own County Subdivision isn't
    // a separate village — only report one when the names genuinely differ
    // and the place is specifically a "village".
    const placeRaw = geographies["Incorporated Places"]?.[0]?.NAME as string | undefined;
    let village: string | null = null;
    if (placeRaw && /\bvillage\b/i.test(placeRaw)) {
      const placeName = placeRaw.replace(/\s+village.*$/i, "").trim();
      const muniName = municipality.replace(/\s+(charter\s+)?township$/i, "").trim();
      if (placeName && placeName.toLowerCase() !== muniName.toLowerCase()) {
        village = `VILLAGE OF ${placeName.toUpperCase()}`;
      }
    }

    if (!county || !municipality) {
      return { county, municipality, village, schoolDistrict: "", matchStatus: "unmatched" };
    }

    const schoolFullName =
      (geographies["Unified School Districts"]?.[0]?.NAME as string | undefined) ??
      (geographies["Secondary School Districts"]?.[0]?.NAME as string | undefined) ??
      (geographies["Elementary School Districts"]?.[0]?.NAME as string | undefined) ??
      "";

    const candidates = candidateSchoolsFor(county, municipality, village);
    if (candidates.length === 0) {
      // County/municipality/village combo itself isn't in the millage
      // data under this name — a naming mismatch we haven't seen before,
      // not something to guess through.
      return { county, municipality, village, schoolDistrict: "", matchStatus: "unmatched" };
    }

    const matchedSchool = schoolFullName ? matchSchoolDistrictName(schoolFullName, candidates) : null;
    if (!matchedSchool) {
      return { county, municipality, village, schoolDistrict: "", matchStatus: "unmatched" };
    }

    return { county, municipality, village, schoolDistrict: matchedSchool, matchStatus: "matched" };
  }
}
