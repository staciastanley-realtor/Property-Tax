// Public — published posts only, never drafts.
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ posts: [] });
  }
  const pool = getPool();
  const result = await pool.query(
    `SELECT slug, title, excerpt, category, published_at FROM blog_posts WHERE published ORDER BY published_at DESC`
  );
  return NextResponse.json({ posts: result.rows });
}
