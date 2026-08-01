"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditBlogPostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/blog")
      .then((r) => r.json())
      .then((d) => setPost(d.posts?.find((p: any) => p.id === params.id)));
  }, [params.id]);

  async function save(publish?: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/blog/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: post.title,
          excerpt: post.excerpt,
          bodyMarkdown: post.body_markdown,
          category: post.category,
          published: publish ?? post.published,
        }),
      });
      const data = await res.json();
      setPost(data.post);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this post? This can't be undone.")) return;
    await fetch(`/api/admin/blog/${params.id}`, { method: "DELETE" });
    router.push("/admin/blog");
  }

  if (!post) return <p>Loading…</p>;

  return (
    <div className="card">
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}>Edit Post</h1>
      <label htmlFor="title">Title</label>
      <input id="title" type="text" value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} />

      <label htmlFor="category">Category</label>
      <select id="category" value={post.category ?? ""} onChange={(e) => setPost({ ...post, category: e.target.value })}>
        <option>Market News</option>
        <option>Law &amp; Regulation</option>
        <option>Buyer Tips</option>
        <option>Seller Tips</option>
        <option>Community</option>
      </select>

      <label htmlFor="excerpt">Excerpt</label>
      <input id="excerpt" type="text" value={post.excerpt ?? ""} onChange={(e) => setPost({ ...post, excerpt: e.target.value })} />

      <label htmlFor="body">Body (Markdown supported)</label>
      <textarea id="body" rows={16} style={{ width: "100%", fontFamily: "var(--font-body)", fontSize: 15, padding: 12, border: "1px solid var(--line)", borderRadius: "var(--radius)" }} value={post.body_markdown} onChange={(e) => setPost({ ...post, body_markdown: e.target.value })} />

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button className="btn-primary" style={{ marginTop: 0 }} disabled={saving} onClick={() => save()}>Save</button>
        {!post.published && (
          <button className="btn-primary" style={{ marginTop: 0, background: "var(--clay-dark)" }} disabled={saving} onClick={() => save(true)}>Publish</button>
        )}
        {post.published && (
          <button className="btn-link" disabled={saving} onClick={() => save(false)}>Unpublish</button>
        )}
        <button className="btn-link" style={{ color: "var(--danger)" }} onClick={remove}>Delete</button>
      </div>
    </div>
  );
}
