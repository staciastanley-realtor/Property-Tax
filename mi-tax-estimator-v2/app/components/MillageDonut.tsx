"use client";

// "Where Your Taxes Go" — a real, honest 2-slice breakdown, not the
// mockup's 5-category one. Our millage data only gives a single
// combined total rate per jurisdiction, not a category-by-category
// breakdown (school operating vs. county vs. township, etc.) — that
// data doesn't exist in the state's report. The one piece we CAN
// attribute for certain is the State Education Tax: a flat 6 mills on
// all property statewide, fixed by Michigan law since Proposal A
// (1994). Everything else is grouped honestly as "local, county &
// school millage" rather than broken into categories we can't verify.

export function MillageDonut({ totalMillage }: { totalMillage: number }) {
  const SET_MILLS = 6;
  const localMills = Math.max(totalMillage - SET_MILLS, 0);
  const setPct = (SET_MILLS / totalMillage) * 100;
  const localPct = 100 - setPct;

  const r = 54;
  const circumference = 2 * Math.PI * r;
  const setLength = (setPct / 100) * circumference;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line)" strokeWidth="18" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="var(--clay)"
          strokeWidth="18"
          strokeDasharray={`${setLength} ${circumference - setLength}`}
          strokeDashoffset={circumference * 0.25}
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="66" textAnchor="middle" fontSize="20" fontFamily="var(--font-display)" fill="var(--charcoal)">
          {totalMillage.toFixed(2)}
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="10" fill="var(--charcoal-soft)">
          total mills
        </text>
      </svg>
      <div style={{ fontSize: 13, lineHeight: 1.8 }}>
        <div>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "var(--clay)", borderRadius: 2, marginRight: 6 }} />
          State Education Tax — {SET_MILLS.toFixed(1)} mills ({setPct.toFixed(1)}%)
        </div>
        <div>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "var(--line)", borderRadius: 2, marginRight: 6 }} />
          Local, county &amp; school millage — {localMills.toFixed(2)} mills ({localPct.toFixed(1)}%)
        </div>
        <p style={{ fontSize: 11.5, color: "var(--charcoal-soft)", marginTop: 6, maxWidth: 320 }}>
          The State Education Tax is a fixed statewide rate under Michigan's Proposal A.
          A category-by-category breakdown of the remaining local millage (school operating,
          county, township, etc.) isn't available in the state's published rate data.
        </p>
      </div>
    </div>
  );
}
