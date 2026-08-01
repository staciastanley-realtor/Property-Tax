import { describe, it, expect } from "vitest";
import { MockGeocodingAdapter, MapboxGeocodingAdapter } from "@/lib/adapters/geocoding";
import { MockGisAdapter } from "@/lib/adapters/gis";

describe("MockGeocodingAdapter", () => {
  it("rejects addresses that are too short", async () => {
    const geocoder = new MockGeocodingAdapter();
    expect(await geocoder.geocode("abc")).toBeNull();
  });

  it("returns a Michigan coordinate for a plausible address", async () => {
    const geocoder = new MockGeocodingAdapter();
    const result = await geocoder.geocode("123 Main St, Clarkston, MI");
    expect(result?.isMichigan).toBe(true);
  });
});

describe("MapboxGeocodingAdapter", () => {
  it("throws a clear error when MAPBOX_ACCESS_TOKEN is missing", () => {
    expect(() => new MapboxGeocodingAdapter(undefined)).toThrow(/MAPBOX_ACCESS_TOKEN/);
  });

  it("does not throw when a token is passed explicitly", () => {
    expect(() => new MapboxGeocodingAdapter("fake-token-for-test")).not.toThrow();
  });
});

describe("MockGisAdapter", () => {
  it("returns the real Independence Twp / Clarkston Comm Sch combo", async () => {
    const gis = new MockGisAdapter();
    const result = await gis.lookup(42.7739, -83.4199);
    expect(result.matchStatus).toBe("matched");
    expect(result.municipality).toBe("Independence Twp");
    expect(result.village).toBeNull();
  });
});
