import { describe, it, expect } from "vitest";
import { computeConfidence } from "@/lib/confidence";

describe("computeConfidence", () => {
  it("is Verified when everything auto-matched cleanly", () => {
    const r = computeConfidence({ geocodeSucceeded: true, jurisdictionMatchStatus: "matched", manuallyCorrected: false, taxYear: 2025 });
    expect(r.level).toBe("verified");
  });

  it("is Confirmed by You when the buyer manually corrected jurisdictions", () => {
    const r = computeConfidence({ geocodeSucceeded: true, jurisdictionMatchStatus: "matched", manuallyCorrected: true, taxYear: 2025 });
    expect(r.level).toBe("confirmed");
  });

  it("is Needs Review when jurisdiction match failed and wasn't corrected", () => {
    const r = computeConfidence({ geocodeSucceeded: true, jurisdictionMatchStatus: "unmatched", manuallyCorrected: false, taxYear: 2025 });
    expect(r.level).toBe("needs_review");
  });
});
