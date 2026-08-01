"use client";

import { useEffect, useState } from "react";

interface Lead {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string;
  contact_preference: string;
  intent: string;
  preferred_location: string;
  timeframe: string | null;
  wants_lender_intro: boolean;
  searched_address: string | null;
  searched_county: string | null;
  searched_municipality: string | null;
  entered_purchase_price: string | null;
  estimated_annual_taxes: string | null;
  status: string;
  assigned_partner_agent_id: string | null;
  contact_date: string | null;
  referral_agreement_status: string;
  transaction_stage: string | null;
  expected_referral_fee: string | null;
  closed_date: string | null;
  paid_referral_fee: string | null;
}

interface Agent {
  id: string;
  name: string;
}

const currency = (n: string | number | null) =>
  n == null ? "—" : Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function ReferralsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/referrals");
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load.");
        return;
      }
      const data = await res.json();
      setLeads(data.leads);
      setAgents(data.agents);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateLead(id: string, field: string, value: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
    await fetch(`/api/admin/referrals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }

  if (loading) return <p>Loading…</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}>Referral Leads</h1>
      <p style={{ color: "var(--charcoal-soft)", fontSize: 14 }}>{leads.length} total leads</p>

      {leads.length === 0 && <p>No referral submissions yet.</p>}

      {leads.map((lead) => (
        <div key={lead.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}>
            <div>
              <strong>{lead.full_name}</strong> — {lead.intent} — {lead.preferred_location}
              {lead.wants_lender_intro && <span className="status-pill status-signed" style={{ marginLeft: 8 }}>Wants Lender Intro</span>}
              <div style={{ fontSize: 12, color: "var(--charcoal-soft)" }}>
                {new Date(lead.created_at).toLocaleDateString()} · {lead.email} · {lead.phone}
              </div>
            </div>
            <span className={`status-pill status-${lead.status}`}>{lead.status}</span>
          </div>

          {expanded === lead.id && (
            <div className="lead-detail">
              <div className="lead-detail-grid">
                <div><strong>Searched property:</strong> {lead.searched_address || "—"}</div>
                <div><strong>Requested market:</strong> {lead.searched_county ? `${lead.searched_municipality}, ${lead.searched_county} County` : "—"}</div>
                <div><strong>Purchase price entered:</strong> {currency(lead.entered_purchase_price)}</div>
                <div><strong>Estimated taxes:</strong> {currency(lead.estimated_annual_taxes)}</div>
                <div><strong>Timeframe:</strong> {lead.timeframe || "—"}</div>
                <div><strong>Preferred contact:</strong> {lead.contact_preference}</div>
                <div><strong>Wants lender intro:</strong> {lead.wants_lender_intro ? "Yes" : "No"}</div>
              </div>

              <div className="lead-edit-grid">
                <label>
                  Status
                  <select value={lead.status} onChange={(e) => updateLead(lead.id, "status", e.target.value)}>
                    {["new", "contacted", "assigned", "inactive"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label>
                  Assigned Partner
                  <select value={lead.assigned_partner_agent_id ?? ""} onChange={(e) => updateLead(lead.id, "assigned_partner_agent_id", e.target.value)}>
                    <option value="">— unassigned —</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <label>
                  Contact Date
                  <input type="date" value={lead.contact_date ?? ""} onChange={(e) => updateLead(lead.id, "contact_date", e.target.value)} />
                </label>
                <label>
                  Agreement Status
                  <select value={lead.referral_agreement_status} onChange={(e) => updateLead(lead.id, "referral_agreement_status", e.target.value)}>
                    {["not_sent", "sent", "signed", "declined"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </label>
                <label>
                  Transaction Stage
                  <select value={lead.transaction_stage ?? ""} onChange={(e) => updateLead(lead.id, "transaction_stage", e.target.value)}>
                    <option value="">— none —</option>
                    {["assigned", "client_contacted", "under_contract", "closed", "fell_through"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </label>
                <label>
                  Expected Fee ($)
                  <input type="number" value={lead.expected_referral_fee ?? ""} onChange={(e) => updateLead(lead.id, "expected_referral_fee", e.target.value)} />
                </label>
                <label>
                  Closed Date
                  <input type="date" value={lead.closed_date ?? ""} onChange={(e) => updateLead(lead.id, "closed_date", e.target.value)} />
                </label>
                <label>
                  Paid Fee ($)
                  <input type="number" value={lead.paid_referral_fee ?? ""} onChange={(e) => updateLead(lead.id, "paid_referral_fee", e.target.value)} />
                </label>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
