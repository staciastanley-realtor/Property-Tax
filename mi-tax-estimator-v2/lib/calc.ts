// Core calculation rules — Blueprint Section 3.
// Kept pure and dependency-free so it's trivially unit-testable.

export type PropertyUse = "principal_residence" | "non_homestead";

export interface CalcInput {
  purchasePrice: number;   // dollars
  millageRate: number;     // mills (e.g. 38.5), already selected for the correct use type
}

export interface CalcResult {
  estimatedTaxableValue: number;
  estimatedAnnualTaxes: number;
  estimatedMonthlyTaxes: number;
}

export function calculateEstimate({ purchasePrice, millageRate }: CalcInput): CalcResult {
  if (purchasePrice <= 0) {
    throw new Error("purchasePrice must be greater than 0");
  }
  if (millageRate < 0) {
    throw new Error("millageRate cannot be negative");
  }

  const estimatedTaxableValue = purchasePrice / 2;
  const estimatedAnnualTaxes = (estimatedTaxableValue * millageRate) / 1000;
  const estimatedMonthlyTaxes = estimatedAnnualTaxes / 12;

  return {
    estimatedTaxableValue: round2(estimatedTaxableValue),
    estimatedAnnualTaxes: round2(estimatedAnnualTaxes),
    estimatedMonthlyTaxes: round2(estimatedMonthlyTaxes),
  };
}

export function selectRate(
  use: PropertyUse,
  rates: { principal_residence_rate: number; nonhomestead_rate: number }
): number {
  return use === "principal_residence" ? rates.principal_residence_rate : rates.nonhomestead_rate;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
