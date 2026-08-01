"use client";

import { useEffect, useState } from "react";

interface Analytics {
  totalSearches: number;
  averagePurchasePrice: string | null;
  topCounties: { county: string; count: number }[];
  returnVisitorCount: number;
  userTypeBreakdown: { user_type: string; count: number }[];
  referralConversion: { searches: number; referrals: number };
}

const currency = (n: string | number | null) =>
  n == null ? "—" : Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)));
  }, []);

  if (error) return <div className="error-box">{error}</div>;
  if (!data) return <p>Loading…</p>;

  const conversionRate = data.referralConversion.searches > 0
    ? ((data.referralConversion.referrals / data.referralConversion.searches) * 100).toFixed(1)
    : "0";

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}>Analytics</h1>

      <div className="stat-grid">
        <div className="card stat-card">
          <p className="stat-value">{data.totalSearches}</p>
          <p className="stat-label">Total Searches</p>
        </div>
        <div className="card stat-card">
          <p className="stat-value">{currency(data.averagePurchasePrice)}</p>
          <p className="stat-label">Avg. Purchase Price Searched</p>
        </div>
        <div className="card stat-card">
          <p className="stat-value">{data.returnVisitorCount}</p>
          <p className="stat-label">Return Visitors</p>
        </div>
        <div className="card stat-card">
          <p className="stat-value">{conversionRate}%</p>
          <p className="stat-label">Search → Referral Conversion</p>
        </div>
      </div>

      <div className="card">
        <h3>Top Counties Searched</h3>
        {data.topCounties.length === 0 && <p style={{ color: "var(--charcoal-soft)" }}>No data yet.</p>}
        {data.topCounties.map((c) => (
          <div key={c.county} className="row">
            <span>{c.county}</span>
            <span>{c.count}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Visitor Type Breakdown</h3>
        {data.userTypeBreakdown.length === 0 && <p style={{ color: "var(--charcoal-soft)" }}>No responses yet.</p>}
        {data.userTypeBreakdown.map((t) => (
          <div key={t.user_type} className="row">
            <span style={{ textTransform: "capitalize" }}>{t.user_type}</span>
            <span>{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
