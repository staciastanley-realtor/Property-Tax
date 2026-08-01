import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 503 });
  }
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM partner_agents ORDER BY name`);
  return NextResponse.json({ agents: result.rows });
}

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body.name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO partner_agents (name, brokerage, email, phone, counties_served)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [body.name, body.brokerage ?? null, body.email ?? null, body.phone ?? null, body.countiesServed ?? []]
  );
  return NextResponse.json({ agent: result.rows[0] });
}
