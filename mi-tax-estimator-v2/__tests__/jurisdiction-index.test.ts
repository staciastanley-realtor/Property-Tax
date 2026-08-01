import { describe, it, expect } from "vitest";
import { buildJurisdictionIndex } from "@/lib/millage/index";

describe("buildJurisdictionIndex", () => {
  const index = buildJurisdictionIndex();

  it("includes Oakland county with Independence Twp", () => {
    expect(index.counties).toContain("Oakland");
    expect(index.municipalitiesByCounty["Oakland"]).toContain("Independence Twp");
  });

  it("lists the real school districts for Independence Twp with no village", () => {
    const schools = index.schoolsByCountyMuniVillage["Oakland::Independence Twp::"];
    expect(schools).toContain("CLARKSTON COMM SCH");
    expect(schools).toContain("LAKE ORION COMMUNITY");
    expect(schools).toContain("WATERFORD SCHOOL DIS");
  });

  it("does not invent a village for Independence Twp", () => {
    expect(index.villagesByCountyMuni["Oakland::Independence Twp"]).toEqual([]);
  });

  it("finds a real village overlay elsewhere in the data (Village of Lincoln, Alcona)", () => {
    const villages = index.villagesByCountyMuni["Alcona::Gustin Twp"];
    expect(villages).toContain("VILLAGE OF LINCOLN");
  });
});
