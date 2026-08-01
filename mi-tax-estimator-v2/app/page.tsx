"use client";

import { useState, useEffect, useRef } from "react";
import { MillageDonut } from "./components/MillageDonut";
import { ProjectionChart } from "./components/ProjectionChart";
import { FirstVisitPopup } from "./components/FirstVisitPopup";

type PropertyUse = "principal_residence" | "non_homestead";

interface Jurisdiction {
  county: string;
  municipality: string;
  village: string | null;
  schoolDistrict: string;
  matchStatus: "matched" | "ambiguous" | "unmatched";
}

interface Scenario {
  millageRate: number;
  estimatedTaxableValue: number;
  estimatedAnnualTaxes: number;
  estimatedMonthlyTaxes: number;
}

interface ConfidenceResult {
  level: "verified" | "confirmed" | "needs_review";
  label: string;
  checks: { label: string; passed: boolean }[];
}

interface ProjectionYear {
  year: number;
  estimatedTaxableValue: number;
  estimatedAnnualTaxes: number;
}

interface MyListing {
  addressMatch: string;
  city: string;
  kwUrl: string;
}

interface CalcResponse {
  normalizedAddress: string;
  jurisdiction: Jurisdiction;
  millageRate: number;
  taxYear: number;
  sourceReference: string;
  estimatedTaxableValue: number;
  estimatedAnnualTaxes: number;
  estimatedMonthlyTaxes: number;
  scenarios: { principalResidence: Scenario; nonHomestead: Scenario };
  confidence: ConfidenceResult;
  projection: ProjectionYear[];
  myListing: MyListing | null;
  disclaimer: string;
}

interface JurisdictionIndex {
  counties: string[];
  municipalitiesByCounty: Record<string, string[]>;
  villagesByCountyMuni: Record<string, string[]>;
  schoolsByCountyMuniVillage: Record<string, string[]>;
}

interface AddressSuggestion {
  id: string;
  text: string;
}

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const NO_VILLAGE = "__none__";
const EMPTY_OVERRIDE = { county: "", municipality: "", village: NO_VILLAGE, schoolDistrict: "" };

export default function DashboardPage() {
  const [address, setAddress] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [propertyUse, setPropertyUse] = useState<PropertyUse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalcResponse | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [override, setOverride] = useState(EMPTY_OVERRIDE);
  const [jIndex, setJIndex] = useState<JurisdictionIndex | null>(null);
  const [indexLoading, setIndexLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [copyLinkLabel, setCopyLinkLabel] = useState("Copy Share Link");
  const sessionTokenRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function newSearchSession() {
    sessionTokenRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (address.trim().length < 5) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (!sessionTokenRef.current) newSearchSession();
      try {
        const res = await fetch(
          `/api/address-suggest?q=${encodeURIComponent(address)}&session=${sessionTokenRef.current}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {}
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [address]);

  function selectSuggestion(s: AddressSuggestion) {
    setAddress(s.text);
    setSuggestions([]);
    setShowSuggestions(false);
    newSearchSession();
  }

  async function loadJurisdictionIndex() {
    if (jIndex || indexLoading) return;
    setIndexLoading(true);
    try {
      const res = await fetch("/api/jurisdictions");
      if (res.ok) setJIndex(await res.json());
    } finally {
      setIndexLoading(false);
    }
  }

  function openCorrection(detected?: Jurisdiction) {
    setCorrectionOpen(true);
    loadJurisdictionIndex();
    setOverride(
      detected
        ? {
            county: detected.county,
            municipality: detected.municipality,
            village: detected.village ?? NO_VILLAGE,
            schoolDistrict: detected.schoolDistrict || "",
          }
        : EMPTY_OVERRIDE
    );
  }

  async function handleCalculate(useOverride = false) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          purchasePrice: Number(purchasePrice),
          propertyUse,
          manualOverride: useOverride
            ? {
                county: override.county || undefined,
                municipality: override.municipality || undefined,
                village: override.village === NO_VILLAGE || override.village === "" ? null : override.village,
                schoolDistrict: override.schoolDistrict || undefined,
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setResult(null);
        openCorrection(data.detectedJurisdiction);
        return;
      }
      setResult(data);
      setCorrectionOpen(false);
    } catch {
      setError("We couldn't reach the estimator. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function copyShareLink() {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(() => {
      setCopyLinkLabel("Link Copied!");
      setTimeout(() => setCopyLinkLabel("Copy Share Link"), 2000);
    });
  }

  function emailReport() {
    if (!result) return;
    const subject = encodeURIComponent(`Property Tax Estimate — ${result.normalizedAddress}`);
    const body = encodeURIComponent(
      `Property Tax Estimate\n\n` +
        `Address: ${result.normalizedAddress}\n` +
        `County: ${result.jurisdiction.county}\n` +
        `City/Township: ${result.jurisdiction.municipality}\n` +
        `School District: ${result.jurisdiction.schoolDistrict}\n\n` +
        `Estimated Annual Taxes: ${currency(result.estimatedAnnualTaxes)}\n` +
        `Estimated Monthly Taxes: ${currency(result.estimatedMonthlyTaxes)}\n\n` +
        `${result.disclaimer}\n\n` +
        `Prepared by Stacia Stanley, Keller Williams Premier — (586) 651-4614`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  const canSubmit = address.trim().length > 4 && Number(purchasePrice) > 0 && propertyUse !== null && !loading;

  const correctionPanel = correctionOpen && (
    <div className="card no-print">
      <p style={{ fontSize: 13, color: "var(--charcoal-soft)", margin: "0 0 12px" }}>
        {result
          ? "Adjust the detected jurisdictions if anything looks wrong."
          : "Select the correct jurisdictions to get an accurate estimate — this works anywhere in Michigan."}
      </p>
      {indexLoading && <p style={{ fontSize: 13, color: "var(--charcoal-soft)" }}>Loading jurisdiction list…</p>}
      {jIndex && (
        <>
          <label htmlFor="ov-county">County</label>
          <select
            id="ov-county"
            value={override.county}
            onChange={(e) => setOverride({ county: e.target.value, municipality: "", village: NO_VILLAGE, schoolDistrict: "" })}
          >
            <option value="">Select county</option>
            {jIndex.counties.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <label htmlFor="ov-muni">City / township</label>
          <select
            id="ov-muni"
            value={override.municipality}
            disabled={!override.county}
            onChange={(e) => setOverride({ ...override, municipality: e.target.value, village: NO_VILLAGE, schoolDistrict: "" })}
          >
            <option value="">Select city or township</option>
            {(jIndex.municipalitiesByCounty[override.county] ?? []).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {(() => {
            const villages = jIndex.villagesByCountyMuni[`${override.county}::${override.municipality}`] ?? [];
            if (villages.length === 0) return null;
            return (
              <>
                <label htmlFor="ov-village">Village (if applicable)</label>
                <select id="ov-village" value={override.village} onChange={(e) => setOverride({ ...override, village: e.target.value, schoolDistrict: "" })}>
                  <option value={NO_VILLAGE}>No village</option>
                  {villages.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </>
            );
          })()}

          <label htmlFor="ov-school">School district</label>
          <select
            id="ov-school"
            value={override.schoolDistrict}
            disabled={!override.municipality}
            onChange={(e) => setOverride({ ...override, schoolDistrict: e.target.value })}
          >
            <option value="">Select school district</option>
            {(jIndex.schoolsByCountyMuniVillage[`${override.county}::${override.municipality}::${override.village === NO_VILLAGE ? "" : override.village}`] ?? []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <button className="btn-primary" disabled={!override.county || !override.municipality || !override.schoolDistrict || loading} onClick={() => handleCalculate(true)}>
            {loading ? "Calculating…" : result ? "Recalculate with correction" : "Calculate with these jurisdictions"}
          </button>
          {result && (
            <button className="btn-link" onClick={() => setCorrectionOpen(false)}>Cancel</button>
          )}
        </>
      )}
    </div>
  );

  return (
    <main className="dash-wrap">
      <FirstVisitPopup />

      <div className="dash-hero no-print">
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <a href="/blog" style={{ fontSize: 13, color: "var(--cream-soft)", textDecoration: "underline" }}>Market News &amp; Blog →</a>
        </div>
        <p className="greeting">hi there,</p>
        <p className="eyebrow">Sold With Stacia · Keller Williams Premier</p>
        <h1>Michigan Property Tax Intelligence</h1>
        <p>Search any Michigan address for a full tax picture — jurisdiction, PRE comparison, 5-year projection, and more.</p>
      </div>

      <div className="card no-print search-card">
        <label htmlFor="address">Property address</label>
        <div style={{ position: "relative" }}>
          <input
            id="address"
            type="text"
            autoComplete="off"
            placeholder="Start typing a Michigan address"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="suggestion-list">
              {suggestions.map((s) => (
                <li key={s.id}><button type="button" onMouseDown={() => selectSuggestion(s)}>{s.text}</button></li>
              ))}
            </ul>
          )}
        </div>

        <label htmlFor="price">Expected purchase price</label>
        <input id="price" type="number" inputMode="numeric" placeholder="e.g. 425000" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />

        <label>Property use</label>
        <div className="radio-group" role="radiogroup" aria-label="Property use">
          {([
            { value: "principal_residence", label: "Principal residence / homestead" },
            { value: "non_homestead", label: "Non-homestead / investment / second home" },
          ] as const).map((opt) => (
            <label key={opt.value} className={`radio-option ${propertyUse === opt.value ? "selected" : ""}`}>
              <input type="radio" name="propertyUse" value={opt.value} checked={propertyUse === opt.value} onChange={() => setPropertyUse(opt.value)} />
              {opt.label}
            </label>
          ))}
        </div>

        <button className="btn-primary" disabled={!canSubmit} onClick={() => handleCalculate(false)}>
          {loading ? "Calculating…" : "Generate Property Tax Report"}
        </button>
      </div>

      {error && <div className="error-box no-print">{error}</div>}
      {!result && correctionOpen && correctionPanel}

      {result && (
        <div id="report-sheet">
          <div className="print-letterhead">
            <p className="print-eyebrow">Sold With Stacia · Keller Williams Premier</p>
            <p className="print-title">Michigan Property Tax Report</p>
          </div>

          {/* Property summary */}
          <div className="card property-summary">
            <div className="property-summary-main">
              <h2>{result.normalizedAddress}</h2>
              <p className="property-summary-sub">
                {result.jurisdiction.municipality}
                {result.jurisdiction.village ? ` · ${result.jurisdiction.village}` : ""} · {result.jurisdiction.county} County
              </p>
              <p className="property-summary-sub">{result.jurisdiction.schoolDistrict}</p>
              {result.myListing && (
                <a href={result.myListing.kwUrl} target="_blank" rel="noopener noreferrer" className="listing-badge no-print">
                  ★ One of Stacia's listings — View full details →
                </a>
              )}
              <a
                className="btn-link no-print"
                href={`https://maps.google.com/?q=${encodeURIComponent(result.normalizedAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Google Maps →
              </a>
            </div>
            <div className="property-summary-figure">
              <div className="amount">{currency(result.estimatedAnnualTaxes)}</div>
              <div className="label">Estimated annual taxes</div>
              <div className="sub">{currency(result.estimatedMonthlyTaxes)} / month</div>
            </div>
          </div>

          <div className="dash-grid">
            {/* Main column */}
            <div className="dash-main">
              <div className="card">
                <h3>Principal Residence vs. Non-Homestead</h3>
                <p style={{ fontSize: 13, color: "var(--charcoal-soft)", marginTop: -6 }}>
                  Whether this property qualifies for the Principal Residence Exemption
                  makes a real difference — here's both scenarios side by side.
                </p>
                <div className="scenario-grid">
                  <div className={`scenario-card ${propertyUse === "principal_residence" ? "selected" : ""}`}>
                    <p className="scenario-label">Principal Residence</p>
                    <p className="scenario-amount">{currency(result.scenarios.principalResidence.estimatedAnnualTaxes)}</p>
                    <p className="scenario-sub">{currency(result.scenarios.principalResidence.estimatedMonthlyTaxes)}/mo · {result.scenarios.principalResidence.millageRate.toFixed(4)} mills</p>
                  </div>
                  <div className={`scenario-card ${propertyUse === "non_homestead" ? "selected" : ""}`}>
                    <p className="scenario-label">Non-Homestead</p>
                    <p className="scenario-amount">{currency(result.scenarios.nonHomestead.estimatedAnnualTaxes)}</p>
                    <p className="scenario-sub">{currency(result.scenarios.nonHomestead.estimatedMonthlyTaxes)}/mo · {result.scenarios.nonHomestead.millageRate.toFixed(4)} mills</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>Where Your Taxes Go</h3>
                <MillageDonut totalMillage={result.millageRate} />
              </div>

              <div className="card">
                <h3>5-Year Tax Projection</h3>
                <ProjectionChart years={result.projection} startYear={result.taxYear} startAmount={result.estimatedAnnualTaxes} />
              </div>

              <div className="card">
                <h3>About This Estimate</h3>
                <ul className="about-list">
                  <li>Purchase price: {currency(Number(purchasePrice))}</li>
                  <li>Taxable value assumed at 50% of purchase price (Michigan uncapping rule)</li>
                  <li>{result.taxYear} millage rates, {result.millageRate.toFixed(4)} total mills</li>
                  <li>Source: {result.sourceReference}</li>
                </ul>
                <p className="disclaimer" style={{ margin: "12px 0 0" }}>{result.disclaimer}</p>
              </div>
            </div>

            {/* Sidebar */}
            <div className="dash-sidebar no-print">
              <div className="card">
                <h4>Confidence: {result.confidence.label}</h4>
                <ul className="confidence-list">
                  {result.confidence.checks.map((c) => (
                    <li key={c.label} className={c.passed ? "pass" : "fail"}>
                      {c.passed ? "✓" : "•"} {c.label}
                    </li>
                  ))}
                </ul>
                {!correctionOpen && (
                  <button className="btn-link" onClick={() => openCorrection(result.jurisdiction)}>Edit detected jurisdictions</button>
                )}
              </div>

              <div className="card expert-card">
                <img src="/stacia-headshot.jpg" alt="Stacia Stanley" className="expert-photo" />
                <p className="expert-name">Stacia Stanley®</p>
                <p className="expert-meta">Keller Williams Premier</p>
                <p className="expert-meta">MI License #459758</p>
                <a href="tel:+15866514614" className="btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 10 }}>
                  Contact Stacia
                </a>
              </div>

              <div className="card">
                <h4>Helpful Tools</h4>
                <details className="tool-item">
                  <summary>What is Uncapping?</summary>
                  <p>In Michigan, a property's taxable value is capped while owned by the same person — but when it's sold, the taxable value "uncaps" to match the State Equalized Value (roughly half of market value) starting the year after the transfer. That's usually why a buyer's tax bill differs from what the seller was paying.</p>
                </details>
                <details className="tool-item">
                  <summary>Principal Residence Exemption (PRE)</summary>
                  <p>If you'll live in the home as your primary residence, you can file a PRE affidavit with the local assessor to exempt the property from the local school operating millage — typically 18 mills — lowering your bill compared to a non-homestead property.</p>
                </details>
                <details className="tool-item">
                  <summary>How Taxes Are Calculated</summary>
                  <p>Estimated taxable value (about 50% of purchase price) × total millage rate ÷ 1,000 = estimated annual taxes. Millage is expressed in mills — $1 of tax per $1,000 of taxable value.</p>
                </details>
              </div>

              <div className="card share-card">
                <h4>Share This Report</h4>
                <button className="btn-link" onClick={copyShareLink}>{copyLinkLabel}</button>
                <button className="btn-link" onClick={emailReport}>Email Report</button>
                <button className="btn-link" onClick={() => window.print()}>Print / Save as PDF</button>
              </div>
            </div>
          </div>

          <div className="print-footer">
            <img src="/stacia-headshot.jpg" alt="Stacia Stanley" className="print-agent-photo" />
            <div>
              <p className="print-agent-name">Stacia Stanley®</p>
              <p className="print-agent-meta">Keller Williams Premier · MI License #459758</p>
              <p className="print-agent-meta">(586) 651-4614</p>
            </div>
          </div>
        </div>
      )}

      {result && correctionOpen && correctionPanel}

      {result && (
        <ReferralSection
          searchedCounty={result.jurisdiction.county}
          searchedMunicipality={result.jurisdiction.municipality}
          searchedAddress={result.normalizedAddress}
          purchasePrice={Number(purchasePrice) || undefined}
          estimatedAnnualTaxes={result.estimatedAnnualTaxes}
        />
      )}
    </main>
  );
}

function ReferralSection({
  searchedCounty,
  searchedMunicipality,
  searchedAddress,
  purchasePrice,
  estimatedAnnualTaxes,
}: {
  searchedCounty: string;
  searchedMunicipality: string;
  searchedAddress: string;
  purchasePrice?: number;
  estimatedAnnualTaxes: number;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    intent: "buying" as "buying" | "selling" | "both",
    preferredLocation: `${searchedMunicipality}, ${searchedCounty} County`,
    timeframe: "",
    contactPreference: "call" as "call" | "text" | "email",
    wantsLenderIntro: false,
  });

  async function submit() {
    setSubmitting(true);
    try {
      await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          searchedAddress,
          searchedCounty,
          searchedMunicipality,
          enteredPurchasePrice: purchasePrice,
          estimatedAnnualTaxes,
        }),
      });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card referral-card no-print">
      <h3>Find a Trusted Realtor in Your Area</h3>
      <p style={{ fontSize: 14, color: "var(--charcoal-soft)" }}>
        Not in Stacia's primary service area? She'll personally connect you with a
        vetted real estate partner she trusts, anywhere in Michigan — no cost to you.
      </p>
      {submitted ? (
        <p style={{ fontWeight: 600 }}>Thanks — Stacia will be in touch shortly.</p>
      ) : !open ? (
        <button className="btn-primary" onClick={() => setOpen(true)}>Find My Trusted Realtor</button>
      ) : (
        <div>
          <label htmlFor="ref-name">Full name</label>
          <input id="ref-name" type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />

          <label htmlFor="ref-email">Email</label>
          <input id="ref-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

          <label htmlFor="ref-phone">Phone</label>
          <input id="ref-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

          <label>Are you buying, selling, or both?</label>
          <div className="radio-group">
            {(["buying", "selling", "both"] as const).map((v) => (
              <label key={v} className={`radio-option ${form.intent === v ? "selected" : ""}`}>
                <input type="radio" name="intent" checked={form.intent === v} onChange={() => setForm({ ...form, intent: v })} />
                {v[0].toUpperCase() + v.slice(1)}
              </label>
            ))}
          </div>

          <label htmlFor="ref-location">Preferred location</label>
          <input id="ref-location" type="text" value={form.preferredLocation} onChange={(e) => setForm({ ...form, preferredLocation: e.target.value })} />

          <label htmlFor="ref-timeframe">Timeframe</label>
          <input id="ref-timeframe" type="text" placeholder="e.g. 3-6 months" value={form.timeframe} onChange={(e) => setForm({ ...form, timeframe: e.target.value })} />

          <label>Preferred contact method</label>
          <div className="radio-group">
            {(["call", "text", "email"] as const).map((v) => (
              <label key={v} className={`radio-option ${form.contactPreference === v ? "selected" : ""}`}>
                <input type="radio" name="contactPreference" checked={form.contactPreference === v} onChange={() => setForm({ ...form, contactPreference: v })} />
                {v[0].toUpperCase() + v.slice(1)}
              </label>
            ))}
          </div>

          <label className="radio-option" style={{ marginTop: 18 }}>
            <input
              type="checkbox"
              checked={form.wantsLenderIntro}
              onChange={(e) => setForm({ ...form, wantsLenderIntro: e.target.checked })}
            />
            I'd also like an introduction to Stacia's trusted lender
          </label>

          <button
            className="btn-primary"
            disabled={submitting || !form.fullName || !form.email || !form.phone || !form.preferredLocation}
            onClick={submit}
          >
            {submitting ? "Submitting…" : "Connect Me With a Partner"}
          </button>
        </div>
      )}
    </div>
  );
}
