import { describe, it, expect } from "vitest";
import { projectFiveYears } from "@/lib/projection";

describe("projectFiveYears", () => {
  it("returns 5 years starting after startYear", () => {
    const years = projectFiveYears({ startYear: 2025, currentTaxableValue: 200000, millageRate: 40 });
    expect(years).toHaveLength(5);
    expect(years[0].year).toBe(2026);
    expect(years[4].year).toBe(2030);
  });

  it("compounds at the 5% statutory cap by default", () => {
    const years = projectFiveYears({ startYear: 2025, currentTaxableValue: 100000, millageRate: 40 });
    expect(years[0].estimatedTaxableValue).toBeCloseTo(105000, 0);
  });
});
