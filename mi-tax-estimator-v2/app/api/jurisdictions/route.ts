// Serves the cascading-dropdown index for the manual-correction UI.
// Built from data/millage-2025.json (same file the calculate route
// matches against), not a separate copy — see lib/millage/index.ts.
// Cached in memory after the first request per server instance.

import { NextResponse } from "next/server";
import { buildJurisdictionIndex } from "@/lib/millage/index";

export async function GET() {
  return NextResponse.json(buildJurisdictionIndex());
}
