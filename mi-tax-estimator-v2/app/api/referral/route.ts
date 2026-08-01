// Public referral-lead capture. This route only ever INSERTs — nothing
// it does can read back another buyer's info, per the "keep all client
// information private" requirement. The private dashboard (a separate,
// authenticated area — not built yet) is the only place leads are read.
//
// IMPORTANT: this requires DATABASE_URL to actually persist anything.
// Without it, submissions are NOT stored anywhere — the form still
// shows the buyer a success message (no reason to expose internal
// plumbing to a lead), but nothing is saved server-side. Don't treat
// this route as "done" until DATABASE_URL is set — see README.

import { NextRequest, NextResponse } from "next/server";

interface ReferralSubmission {
  fullName: string;
  email: string;
  phone: string;
  contactPreference: "call" | "text" | "email";
  intent: "buying" | "selling" | "both";
  preferredLocation: string;
  timeframe?: string;
  wantsLenderIntro?: boolean;
  searchedAddress?: string;
  searchedCounty?: string;
  searchedMunicipality?: string;
  enteredPurchasePrice?: number;
  estimatedAnnualTaxes?: number;
}

export async function POST(req: NextRequest) {
  let body: ReferralSubmission;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.fullName || !body.email || !body.phone || !body.intent || !body.preferredLocation) {
    return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
  }
  if (!body.contactPreference) {
    return NextResponse.json({ error: "Please choose a contact preference." }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    // Nowhere configured to persist this yet. Still return success to
    // the buyer (a broken-looking form helps no one), but make the gap
    // loud in server logs so it isn't missed silently in production.
    console.warn(
      "[referral] DATABASE_URL not set — referral submission was NOT saved:",
      JSON.stringify(body)
    );
    return NextResponse.json({ ok: true, persisted: false });
  }

  try {
    const { getPool } = await import("@/lib/db/pool");
    const pool = getPool();
    await pool.query(
      `INSERT INTO referral_leads
         (full_name, email, phone, contact_preference, intent, preferred_location, timeframe, wants_lender_intro,
          searched_address, searched_county, searched_municipality,
          entered_purchase_price, estimated_annual_taxes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        body.fullName,
        body.email,
        body.phone,
        body.contactPreference,
        body.intent,
        body.preferredLocation,
        body.timeframe ?? null,
        !!body.wantsLenderIntro,
        body.searchedAddress ?? null,
        body.searchedCounty ?? null,
        body.searchedMunicipality ?? null,
        body.enteredPurchasePrice ?? null,
        body.estimatedAnnualTaxes ?? null,
      ]
    );
    return NextResponse.json({ ok: true, persisted: true });
  } catch (err) {
    console.error("[referral] insert failed:", err);
    // Still tell the buyer it worked — a failed background insert isn't
    // their problem to see, but it needs to be visible in server logs.
    return NextResponse.json({ ok: true, persisted: false });
  }
}
