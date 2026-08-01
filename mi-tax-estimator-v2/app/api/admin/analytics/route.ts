import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not set — no analytics data to read from yet." }, { status: 503 });
  }
  const pool = getPool();

  const [totalSearches, avgPrice, byCounty, returnVisitors, userTypes, referralConversion] = await Promise.all([
    pool.query(`SELECT count(*)::int AS count FROM search_events`),
    pool.query(`SELECT avg(purchase_price)::numeric(12,2) AS avg FROM search_events WHERE purchase_price IS NOT NULL`),
    pool.query(
      `SELECT county, count(*)::int AS count FROM search_events WHERE county IS NOT NULL GROUP BY county ORDER BY count DESC LIMIT 10`
    ),
    pool.query(`SELECT count(*)::int AS count FROM visitors WHERE visit_count > 1`),
    pool.query(`SELECT user_type, count(*)::int AS count FROM visitors WHERE user_type IS NOT NULL GROUP BY user_type`),
    pool.query(
      `SELECT
         (SELECT count(*) FROM search_events)::int AS searches,
         (SELECT count(*) FROM referral_leads)::int AS referrals`
    ),
  ]);

  return NextResponse.json({
    totalSearches: totalSearches.rows[0]?.count ?? 0,
    averagePurchasePrice: avgPrice.rows[0]?.avg ?? null,
    topCounties: byCounty.rows,
    returnVisitorCount: returnVisitors.rows[0]?.count ?? 0,
    userTypeBreakdown: userTypes.rows,
    referralConversion: referralConversion.rows[0],
  });
}
