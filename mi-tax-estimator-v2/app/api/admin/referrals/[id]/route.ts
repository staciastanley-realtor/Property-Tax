import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";

const EDITABLE_FIELDS = [
  "status",
  "assigned_partner_agent_id",
  "contact_date",
  "referral_agreement_status",
  "transaction_stage",
  "expected_referral_fee",
  "closed_date",
  "paid_referral_fee",
];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const updates = Object.entries(body).filter(([k]) => EDITABLE_FIELDS.includes(k));
  if (updates.length === 0) {
    return NextResponse.json({ error: "No editable fields provided." }, { status: 400 });
  }

  const setClauses = updates.map(([k], i) => `${k} = $${i + 2}`).join(", ");
  const values = updates.map(([, v]) => (v === "" ? null : v));

  const pool = getPool();
  const result = await pool.query(
    `UPDATE referral_leads SET ${setClauses} WHERE id = $1 RETURNING *`,
    [params.id, ...values]
  );
  return NextResponse.json({ lead: result.rows[0] });
}
