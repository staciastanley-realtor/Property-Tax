"use client";

interface ProjectionYear {
  year: number;
  estimatedTaxableValue: number;
  estimatedAnnualTaxes: number;
}

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ProjectionChart({ years, startYear, startAmount }: { years: ProjectionYear[]; startYear: number; startAmount: number }) {
  const all = [{ year: startYear, estimatedAnnualTaxes: startAmount }, ...years];
  const max = Math.max(...all.map((y) => y.estimatedAnnualTaxes));
  const barWidth = 44;
  const gap = 16;
  const chartHeight = 140;
  const width = all.length * (barWidth + gap);

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${chartHeight + 30}`} preserveAspectRatio="xMidYMid meet">
        {all.map((y, i) => {
          const h = (y.estimatedAnnualTaxes / max) * chartHeight;
          const x = i * (barWidth + gap) + gap / 2;
          return (
            <g key={y.year}>
              <rect
                x={x}
                y={chartHeight - h}
                width={barWidth}
                height={h}
                fill={i === 0 ? "var(--line)" : "var(--clay)"}
                rx="3"
              />
              <text x={x + barWidth / 2} y={chartHeight + 16} textAnchor="middle" fontSize="11" fill="var(--charcoal-soft)">
                {y.year}
              </text>
              <text x={x + barWidth / 2} y={chartHeight - h - 6} textAnchor="middle" fontSize="10" fill="var(--charcoal)">
                {currency(y.estimatedAnnualTaxes)}
              </text>
            </g>
          );
        })}
      </svg>
      <p style={{ fontSize: 11.5, color: "var(--charcoal-soft)", marginTop: 8 }}>
        Assumes taxable value grows 5% per year — the maximum allowed under Michigan's
        Proposal A cap. Actual growth is capped at the lesser of 5% or inflation, so this
        is a worst-case-style estimate, not a prediction. Millage rate held constant.
      </p>
    </div>
  );
}
