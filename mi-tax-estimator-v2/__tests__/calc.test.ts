import { describe, it, expect } from "vitest";
import { calculateEstimate, selectRate } from "@/lib/calc";

describe("calculateEstimate", () => {
  it("computes taxable value as half of purchase price", () => {
    const r = calculateEstimate({ purchasePrice: 400000, millageRate: 40 });
    expect(r.estimatedTaxableValue).toBe(200000);
  });

  it("computes annual taxes as taxable value * millage / 1000", () => {
    const r = calculateEstimate({ purchasePrice: 400000, millageRate: 40 });
    // 200000 * 40 / 1000 = 8000
    expect(r.estimatedAnnualTaxes).toBe(8000);
  });

  it("computes monthly taxes as annual / 12", () => {
    const r = calculateEstimate({ purchasePrice: 400000, millageRate: 40 });
    expect(r.estimatedMonthlyTaxes).toBeCloseTo(666.67, 2);
  });

  it("rejects zero or negative purchase price", () => {
    expect(() => calculateEstimate({ purchasePrice: 0, millageRate: 40 })).toThrow();
    expect(() => calculateEstimate({ purchasePrice: -100, millageRate: 40 })).toThrow();
  });

  it("rejects negative millage rate", () => {
    expect(() => calculateEstimate({ purchasePrice: 100000, millageRate: -1 })).toThrow();
  });
});

describe("selectRate", () => {
  const rates = { principal_residence_rate: 30, nonhomestead_rate: 48 };

  it("selects principal residence rate", () => {
    expect(selectRate("principal_residence", rates)).toBe(30);
  });

  it("selects non-homestead rate", () => {
    expect(selectRate("non_homestead", rates)).toBe(48);
  });
});
