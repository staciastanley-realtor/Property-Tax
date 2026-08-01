import { describe, it, expect } from "vitest";
import { CensusGeocodingAdapter } from "@/lib/adapters/geocoding";
import { CensusGisAdapter } from "@/lib/adapters/gis";

// These construct without any credentials — that's the point of the
// Census adapters — but don't make live network calls in this suite.
describe("Census adapters require no credentials to construct", () => {
  it("CensusGeocodingAdapter constructs with no arguments", () => {
    expect(() => new CensusGeocodingAdapter()).not.toThrow();
  });

  it("CensusGisAdapter constructs with no arguments", () => {
    expect(() => new CensusGisAdapter()).not.toThrow();
  });

  it("CensusGeocodingAdapter rejects short input without a network call", async () => {
    const geocoder = new CensusGeocodingAdapter();
    expect(await geocoder.geocode("abc")).toBeNull();
  });
});
