// 5-year tax projection. Michigan's Proposal A caps annual taxable-value
// growth at the LESSER of 5% or the rate of inflation (MCL 211.34d) —
// so 5%/year is the real statutory ceiling, not an arbitrary guess. The
// actual inflation rate multiplier varies year to year (published by
// MI Treasury annually and is usually lower than 5%), so this is a
// worst-case-style estimate, clearly labeled as such — never presented
// as a prediction.

export interface ProjectionYear {
  year: number;
  estimatedTaxableValue: number;
  estimatedAnnualTaxes: number;
}

export function projectFiveYears(params: {
  startYear: number;
  currentTaxableValue: number;
  millageRate: number;
  annualGrowthRate?: number; // defaults to Proposal A's 5% statutory cap
}): ProjectionYear[] {
  const { startYear, currentTaxableValue, millageRate, annualGrowthRate = 0.05 } = params;

  const years: ProjectionYear[] = [];
  let taxableValue = currentTaxableValue;

  for (let i = 1; i <= 5; i++) {
    taxableValue = taxableValue * (1 + annualGrowthRate);
    years.push({
      year: startYear + i,
      estimatedTaxableValue: Math.round(taxableValue * 100) / 100,
      estimatedAnnualTaxes: Math.round(((taxableValue * millageRate) / 1000) * 100) / 100,
    });
  }

  return years;
}
