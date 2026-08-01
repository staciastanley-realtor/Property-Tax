import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const pool = getPool();

  const wasPublished = await pool.query(`SELECT published, published_at FROM blog_posts WHERE id = $1`, [params.id]);
  const nowPublishing = body.published && !wasPublished.rows[0]?.published;

  const result = await pool.query(
    `UPDATE blog_posts
     SET title = COALESCE($2, title),
         excerpt = COALESCE($3, excerpt),
         body_markdown = COALESCE($4, body_markdown),
         category = COALESCE($5, category),
         published = COALESCE($6, published),
         published_at = CASE WHEN $7 THEN now() ELSE published_at END,
         updated_at = now()
     WHERE id = $1 RETURNING *`,
    [params.id, body.title, body.excerpt, body.bodyMarkdown, body.category, body.published, nowPublishing]
  );
  return NextResponse.json({ post: result.rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 503 });
  }
  const pool = getPool();
  await pool.query(`DELETE FROM blog_posts WHERE id = $1`, [params.id]);
  return NextResponse.json({ ok: true });
}
