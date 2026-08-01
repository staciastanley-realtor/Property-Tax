// Server-side API route — Blueprint Section 5 ("private API keys are
// never exposed in browser code") and Section 3 (calculation rules).
//
// Pipeline: geocode → GIS jurisdiction lookup → millage match → calculate.
//
// Provider priority — real detection works out of the box with zero
// setup, using free U.S. Census Bureau APIs (no key, no signup):
//   Geocoding: Mapbox (if MAPBOX_ACCESS_TOKEN is set) → Census (default)
//   GIS:       PostGIS (if DATABASE_URL is set)       → Census (default)
// Mapbox/PostGIS remain available as later upgrades (better autocomplete
// UX, faster self-hosted queries) — see README's Milestone 2 section —
// but nothing is gated behind credentials that don't exist yet.

import { NextRequest, NextResponse } from "next/server";
import { MapboxGeocodingAdapter, CensusGeocodingAdapter, GeocodingAdapter } from "@/lib/adapters/geocoding";
import { PostGisAdapter, CensusGisAdapter, GisAdapter } from "@/lib/adapters/gis";
import { findMillageRecord } from "@/lib/millage/lookup";
import { calculateEstimate, selectRate, PropertyUse } from "@/lib/calc";
import { computeConfidence } from "@/lib/confidence";
import { projectFiveYears } from "@/lib/projection";
import { findMyListing } from "@/lib/my-listings";
import { getOrCreateCookieId, upsertVisitor, VISITOR_COOKIE_NAME } from "@/lib/visitor";
import millageDataset from "@/data/millage-2025.json";

function buildGeocoder(): GeocodingAdapter {
  return process.env.MAPBOX_ACCESS_TOKEN ? new MapboxGeocodingAdapter() : new CensusGeocodingAdapter();
}
function buildGis(): GisAdapter {
  return process.env.DATABASE_URL ? new PostGisAdapter() : new CensusGisAdapter();
}

const geocoder = buildGeocoder();
const gis = buildGis();

interface RequestBody {
  address: string;
  purchasePrice: number;
  propertyUse: PropertyUse;
  manualOverride?: {
    county?: string;
    municipality?: string;
    village?: string | null;
    schoolDistrict?: string;
  };
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { address, purchasePrice, propertyUse, manualOverride } = body;

  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "Please select a validated Michigan address." }, { status: 400 });
  }
  if (!purchasePrice || purchasePrice <= 0) {
    return NextResponse.json({ error: "Please enter a purchase price greater than $0." }, { status: 400 });
  }
  if (propertyUse !== "principal_residence" && propertyUse !== "non_homestead") {
    return NextResponse.json({ error: "Please select principal residence or non-homestead." }, { status: 400 });
  }

  // 1. Geocode
  const geocoded = await geocoder.geocode(address);
  if (!geocoded) {
    return NextResponse.json({ error: "We couldn't validate that address. Please try again." }, { status: 422 });
  }
  if (!geocoded.isMichigan) {
    return NextResponse.json({ error: "This calculator only supports Michigan addresses." }, { status: 422 });
  }

  // 2. GIS jurisdiction lookup
  let jurisdiction = await gis.lookup(geocoded.latitude, geocoded.longitude);

  // Manual correction path (Section 4 / Section 7)
  if (manualOverride) {
    jurisdiction = {
      county: manualOverride.county ?? jurisdiction.county,
      municipality: manualOverride.municipality ?? jurisdiction.municipality,
      village: manualOverride.village !== undefined ? manualOverride.village : jurisdiction.village,
      schoolDistrict: manualOverride.schoolDistrict ?? jurisdiction.schoolDistrict,
      matchStatus: "matched",
    };
  }

  if (jurisdiction.matchStatus === "unmatched") {
    return NextResponse.json(
      {
        error: "We couldn't fully determine the taxing jurisdictions for this address. Please confirm them below.",
        detectedJurisdiction: jurisdiction,
      },
      { status: 422 }
    );
  }
  if (jurisdiction.matchStatus === "ambiguous") {
    return NextResponse.json(
      {
        error:
          "This address falls on or near a jurisdiction boundary and matched more than one taxing area. Please confirm the correct jurisdictions manually.",
        detectedJurisdiction: jurisdiction,
      },
      { status: 422 }
    );
  }

  // 3. Millage match — never silently guess (Section 7 / Section 11)
  const { record, status, candidates } = findMillageRecord(jurisdiction);
  if (status === "unmatched") {
    return NextResponse.json(
      {
        error: "No millage record was found for the detected jurisdictions. This result cannot be estimated yet.",
        detectedJurisdiction: jurisdiction,
      },
      { status: 422 }
    );
  }
  if (status === "ambiguous" || !record) {
    return NextResponse.json(
      {
        error:
          "More than one valid millage rate exists for these jurisdictions (community college district variation). Please correct the jurisdictions or contact support to resolve manually.",
        detectedJurisdiction: jurisdiction,
        candidateCount: candidates?.length,
      },
      { status: 422 }
    );
  }

  // 4. Calculate — both scenarios, since V2's comparison card shows
  // Principal Residence vs. Non-Homestead side by side (a real,
  // honest comparison we can compute) rather than a "current owner's
  // actual bill" comparison, which would require real parcel/assessor
  // data this app doesn't have access to (see README).
  const millageRate = selectRate(propertyUse, record);
  const result = calculateEstimate({ purchasePrice, millageRate });

  const prRate = selectRate("principal_residence", record);
  const nhRate = selectRate("non_homestead", record);
  const prResult = calculateEstimate({ purchasePrice, millageRate: prRate });
  const nhResult = calculateEstimate({ purchasePrice, millageRate: nhRate });

  const confidence = computeConfidence({
    geocodeSucceeded: true,
    jurisdictionMatchStatus: jurisdiction.matchStatus,
    manuallyCorrected: !!manualOverride,
    taxYear: millageDataset.metadata.tax_year,
  });

  const projection = projectFiveYears({
    startYear: millageDataset.metadata.tax_year,
    currentTaxableValue: result.estimatedTaxableValue,
    millageRate,
  });

  const myListing = findMyListing(geocoded.normalizedAddress);

  // Anonymous analytics — county/municipality/price only, no address
  // or contact info stored here. Silently skipped if no database is
  // configured; never blocks the actual response to the buyer.
  if (process.env.DATABASE_URL) {
    try {
      const { cookieId } = getOrCreateCookieId(req);
      const visitorId = await upsertVisitor(cookieId);
      const { getPool } = await import("@/lib/db/pool");
      await getPool().query(
        `INSERT INTO search_events (visitor_id, county, municipality, purchase_price, property_use, match_status)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [visitorId, jurisdiction.county, jurisdiction.municipality, purchasePrice, propertyUse, jurisdiction.matchStatus]
      );
    } catch (err) {
      console.error("[analytics] failed to log search event:", err);
    }
  }

  const response = NextResponse.json({
    normalizedAddress: geocoded.normalizedAddress,
    jurisdiction,
    taxYear: millageDataset.metadata.tax_year,
    millageRate,
    sourceReference: millageDataset.metadata.source_document,
    ...result,
    scenarios: {
      principalResidence: { millageRate: prRate, ...prResult },
      nonHomestead: { millageRate: nhRate, ...nhResult },
    },
    confidence,
    projection,
    myListing,
    disclaimer:
      "Estimate only. This calculator assumes an estimated taxable value equal to 50% of the purchase price. The local assessor determines actual SEV and taxable value. Actual bills may differ due to assessment timing, exemptions, special assessments, parcel-specific charges, millage changes and other factors. Verify the municipality and school district before relying on the estimate.",
  });

  const { cookieId, isNew } = getOrCreateCookieId(req);
  if (isNew) {
    response.cookies.set(VISITOR_COOKIE_NAME, cookieId, { maxAge: 60 * 60 * 24 * 365, path: "/" });
  }
  return response;
}
