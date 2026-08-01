import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 503 });
  }
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM blog_posts ORDER BY created_at DESC`);
  return NextResponse.json({ posts: result.rows });
}

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body.title || !body.bodyMarkdown) {
    return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  }

  const slug = body.slug?.trim() || slugify(body.title);
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO blog_posts (slug, title, excerpt, body_markdown, category, published, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      slug,
      body.title,
      body.excerpt ?? null,
      body.bodyMarkdown,
      body.category ?? null,
      !!body.published,
      body.published ? new Date().toISOString() : null,
    ]
  );
  return NextResponse.json({ post: result.rows[0] });
}
