import { describe, it, expect } from "vitest";
import { findMillageRecord } from "@/lib/millage/lookup";

describe("findMillageRecord — against the real 2025 dataset", () => {
  it("matches Independence Twp / Clarkston Comm Sch with the verified rate", () => {
    const { record, status } = findMillageRecord({
      county: "Oakland",
      municipality: "Independence Twp",
      village: null,
      schoolDistrict: "CLARKSTON COMM SCH",
      matchStatus: "matched",
    });
    expect(status).toBe("matched");
    expect(record?.principal_residence_rate).toBeCloseTo(32.7266, 4);
    expect(record?.nonhomestead_rate).toBeCloseTo(50.7266, 4);
  });

  it("returns unmatched for a jurisdiction combo that doesn't exist in the report", () => {
    const { status } = findMillageRecord({
      county: "Oakland",
      municipality: "Independence Twp",
      village: "City of the Village of Clarkston", // not a real overlay in the source data
      schoolDistrict: "CLARKSTON COMM SCH",
      matchStatus: "matched",
    });
    expect(status).toBe("unmatched");
  });

  it("normalizes Twp/Township so name variants still match", () => {
    const { status } = findMillageRecord({
      county: "oakland",
      municipality: "Independence Township",
      village: null,
      schoolDistrict: "clarkston comm sch",
      matchStatus: "matched",
    });
    expect(status).toBe("matched");
  });
});
