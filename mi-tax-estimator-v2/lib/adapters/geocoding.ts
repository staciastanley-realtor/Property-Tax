// Geocoding adapter interface — Blueprint Section 5.
// Swap the mock implementation for Google Places/Geocoding or Mapbox
// without touching any calling code. Real credentials stay server-side only.

export interface GeocodeResult {
  normalizedAddress: string;
  latitude: number;
  longitude: number;
  isMichigan: boolean;
}

export interface GeocodingAdapter {
  geocode(rawAddress: string): Promise<GeocodeResult | null>;
}

/**
 * Real geocoding adapter — Mapbox Geocoding API v6 (forward geocoding).
 * Requires MAPBOX_ACCESS_TOKEN in the server environment (see
 * .env.example). Never called from client code — this class is only
 * ever instantiated inside app/api routes, so the token never reaches
 * the browser.
 *
 * Restricted to Michigan addresses: requests are biased toward MI, and
 * results outside Michigan are rejected (isMichigan: false) rather than
 * silently accepted, per Blueprint Section 3.
 */
export class MapboxGeocodingAdapter implements GeocodingAdapter {
  private readonly token: string;

  constructor(token?: string) {
    const resolved = token ?? process.env.MAPBOX_ACCESS_TOKEN;
    if (!resolved) {
      throw new Error(
        "MAPBOX_ACCESS_TOKEN is not set. Set it in your server environment (see .env.example) before using MapboxGeocodingAdapter."
      );
    }
    this.token = resolved;
  }

  async geocode(rawAddress: string): Promise<GeocodeResult | null> {
    const trimmed = rawAddress.trim();
    if (trimmed.length < 5) return null;

    const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("country", "us");
    url.searchParams.set("region", "Michigan");
    url.searchParams.set("limit", "1");
    url.searchParams.set("access_token", this.token);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Mapbox geocoding request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature) return null;

    const [longitude, latitude] = feature.geometry.coordinates as [number, number];
    const region = feature.properties?.context?.region?.name as string | undefined;
    const isMichigan = region === "Michigan";

    return {
      normalizedAddress: feature.properties?.full_address ?? trimmed,
      latitude,
      longitude,
      isMichigan,
    };
  }
}

/**
 * Mock adapter for local development. Returns a fixed coordinate inside
 * Independence Township, MI, regardless of input, so the rest of the
 * pipeline (GIS lookup → millage match → calculation) can be exercised
 * without any credentials. Used automatically when MAPBOX_ACCESS_TOKEN
 * is not set — see app/api/calculate/route.ts.
 *
 * DO NOT use in production.
 */
export class MockGeocodingAdapter implements GeocodingAdapter {
  async geocode(rawAddress: string): Promise<GeocodeResult | null> {
    if (!rawAddress || rawAddress.trim().length < 5) return null;
    return {
      normalizedAddress: rawAddress.trim(),
      latitude: 42.7739,
      longitude: -83.4199,
      isMichigan: true,
    };
  }
}

/**
 * Real geocoding adapter — U.S. Census Bureau Geocoding Services API.
 * Free, no API key, no signup, no rate-limit credentials to manage —
 * genuinely zero setup, which is why this is the default adapter
 * rather than something gated behind an env var like Mapbox. Nationwide
 * TIGER/Line address data; restricted here to Michigan by rejecting any
 * match whose returned state isn't "Michigan".
 *
 * Trade-off vs. Mapbox: no live autocomplete-as-you-type suggestions,
 * and TIGER address-range matching is sometimes less precise on very
 * new subdivisions than a commercial provider. Both are real geocoders,
 * not mocks — either is fine for turning a submitted address into
 * coordinates.
 */
export class CensusGeocodingAdapter implements GeocodingAdapter {
  async geocode(rawAddress: string): Promise<GeocodeResult | null> {
    const trimmed = rawAddress.trim();
    if (trimmed.length < 5) return null;

    const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
    url.searchParams.set("address", trimmed);
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Census geocoding request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;

    const state = match.addressComponents?.state as string | undefined;
    const isMichigan = state === "MI";

    return {
      normalizedAddress: match.matchedAddress ?? trimmed,
      latitude: match.coordinates?.y,
      longitude: match.coordinates?.x,
      isMichigan,
    };
  }
}
