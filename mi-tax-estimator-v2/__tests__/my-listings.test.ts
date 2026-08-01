import { describe, it, expect } from "vitest";
import { findMyListing } from "@/lib/my-listings";

describe("findMyListing", () => {
  it("matches the seeded listing by normalized address", () => {
    const l = findMyListing("9567 Susin Lane, Springfield Charter Township, MI 48348");
    expect(l).not.toBeNull();
    expect(l?.kwUrl).toContain("staciastanley.kw.com");
  });

  it("returns null for an address that isn't a current listing", () => {
    expect(findMyListing("123 Random Street, Detroit, MI")).toBeNull();
  });
});
