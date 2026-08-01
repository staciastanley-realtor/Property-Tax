import { describe, it, expect } from "vitest";
import { matchSchoolDistrictName } from "@/lib/millage/schoolMatch";

describe("matchSchoolDistrictName", () => {
  it("matches an abbreviated full name (Community -> COMM, Schools -> SCH)", () => {
    expect(
      matchSchoolDistrictName("Clarkston Community Schools", [
        "CLARKSTON COMM SCH",
        "LAKE ORION COMMUNITY",
        "WATERFORD SCHOOL DIS",
      ])
    ).toBe("CLARKSTON COMM SCH");
  });

  it("matches a plainly-truncated full name (no word abbreviation)", () => {
    expect(matchSchoolDistrictName("Waterford School District", ["WATERFORD SCHOOL DIS"])).toBe(
      "WATERFORD SCHOOL DIS"
    );
  });

  it("matches a mid-word truncation", () => {
    expect(matchSchoolDistrictName("Thornapple Kellogg School District", ["THORNAPPLE KELLOGG S"])).toBe(
      "THORNAPPLE KELLOGG S"
    );
  });

  it("returns null instead of guessing when nothing lines up", () => {
    expect(matchSchoolDistrictName("Some Totally Unrelated District", ["CLARKSTON COMM SCH"])).toBeNull();
  });

  it("returns null against an empty candidate list", () => {
    expect(matchSchoolDistrictName("Clarkston Community Schools", [])).toBeNull();
  });
});
