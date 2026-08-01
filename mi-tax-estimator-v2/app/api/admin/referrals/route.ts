// Owner-only (protected by middleware.ts). Lists referral leads and
// partner agents together so the admin UI can populate the "assign to"
// dropdown without a second round trip.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not set — no database to read from yet." }, { status: 503 });
  }
  const pool = getPool();
  const leads = await pool.query(`SELECT * FROM referral_leads ORDER BY created_at DESC`);
  const agents = await pool.query(`SELECT * FROM partner_agents WHERE active ORDER BY name`);
  return NextResponse.json({ leads: leads.rows, agents: agents.rows });
}
