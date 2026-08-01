// Live address autocomplete — Mapbox Search Box API's /suggest endpoint,
// the interactive-as-you-type companion to the one-shot geocoding used
// at calculate time. Requires MAPBOX_ACCESS_TOKEN (server-side only —
// the token never reaches the browser, per Blueprint Section 5).
//
// Design choice: this only calls /suggest, never Mapbox's paired
// /retrieve endpoint. We don't need coordinates from Mapbox here — the
// buyer just picks a formatted address string, and the EXISTING
// /api/calculate route re-geocodes that string when they hit
// "Calculate" (via whichever geocoder is active — Mapbox or the free
// Census fallback). That keeps this endpoint simple and keeps billable
// Mapbox "sessions" to one /suggest call per keystroke pause rather
// than a full suggest+retrieve session for every autocomplete pick.
//
// If MAPBOX_ACCESS_TOKEN isn't set, this returns an empty suggestion
// list rather than an error — the address field just falls back to
// plain typing, no dropdown. Nothing breaks without the token.

import { NextRequest, NextResponse } from "next/server";

// Rough Michigan bounding box (lon/lat), used to keep suggestions
// relevant to this calculator's only supported state.
const MICHIGAN_BBOX = "-90.5,41.5,-82.0,48.4";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const session = req.nextUrl.searchParams.get("session")?.trim() ?? "";

  if (!process.env.MAPBOX_ACCESS_TOKEN || q.length < 3 || !session) {
    return NextResponse.json({ suggestions: [] });
  }

  const url = new URL("https://api.mapbox.com/search/searchbox/v1/suggest");
  url.searchParams.set("q", q);
  url.searchParams.set("access_token", process.env.MAPBOX_ACCESS_TOKEN);
  url.searchParams.set("session_token", session);
  url.searchParams.set("country", "us");
  url.searchParams.set("bbox", MICHIGAN_BBOX);
  url.searchParams.set("types", "address");
  url.searchParams.set("limit", "5");

  const res = await fetch(url.toString());
  if (!res.ok) {
    // Autocomplete is a nice-to-have — fail quietly rather than
    // breaking the form if Mapbox has a hiccup.
    return NextResponse.json({ suggestions: [] });
  }

  const data = await res.json();
  const suggestions = (data?.suggestions ?? []).map((s: any) => ({
    id: s.mapbox_id,
    text: s.full_address ?? s.place_formatted ?? s.name,
  }));

  return NextResponse.json({ suggestions });
}
