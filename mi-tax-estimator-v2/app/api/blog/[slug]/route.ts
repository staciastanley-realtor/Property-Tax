import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM blog_posts WHERE slug = $1 AND published`, [params.slug]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ post: result.rows[0] });
}
