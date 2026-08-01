// Records the first-visit "Realtor / Lender / Homebuyer" popup answer,
// tied to the visitor's anonymous cookie — never guessed, only ever
// set when someone actually answers.

import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCookieId, upsertVisitor, VISITOR_COOKIE_NAME } from "@/lib/visitor";
import { getPool } from "@/lib/db/pool";

export async function POST(req: NextRequest) {
  const { cookieId, isNew } = getOrCreateCookieId(req);
  const body = await req.json().catch(() => ({}));

  const res = NextResponse.json({ ok: true });
  if (isNew) {
    res.cookies.set(VISITOR_COOKIE_NAME, cookieId, { maxAge: 60 * 60 * 24 * 365, path: "/" });
  }

  if (!process.env.DATABASE_URL) return res;

  await upsertVisitor(cookieId);
  if (body.userType && ["realtor", "lender", "consumer"].includes(body.userType)) {
    const pool = getPool();
    await pool.query(`UPDATE visitors SET user_type = $2 WHERE cookie_id = $1`, [cookieId, body.userType]);
  }

  return res;
}
