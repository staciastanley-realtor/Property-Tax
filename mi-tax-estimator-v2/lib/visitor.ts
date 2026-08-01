// Anonymous visitor tracking for return-visits and (optional) self-
// reported user type. Identified only by a random cookie ID — no name,
// email, or IP stored here. Used by both the calculate route (to log
// search_events) and the first-visit-type popup.

import { NextRequest } from "next/server";
import { getPool } from "@/lib/db/pool";
import crypto from "crypto";

export const VISITOR_COOKIE_NAME = "visitor_id";

export function getOrCreateCookieId(req: NextRequest): { cookieId: string; isNew: boolean } {
  const existing = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
  if (existing) return { cookieId: existing, isNew: false };
  return { cookieId: crypto.randomUUID(), isNew: true };
}

export async function upsertVisitor(cookieId: string): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO visitors (cookie_id) VALUES ($1)
     ON CONFLICT (cookie_id) DO UPDATE SET last_seen_at = now(), visit_count = visitors.visit_count + 1
     RETURNING id`,
    [cookieId]
  );
  return result.rows[0]?.id ?? null;
}
