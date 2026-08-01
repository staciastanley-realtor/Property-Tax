"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewBlogPostPage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Market News");
  const [excerpt, setExcerpt] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save(publish: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, excerpt, bodyMarkdown, published: publish }),
      });
      const data = await res.json();
      if (data.post) router.push(`/admin/blog/${data.post.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}>New Post</h1>
      <label htmlFor="title">Title</label>
      <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />

      <label htmlFor="category">Category</label>
      <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
        <option>Market News</option>
        <option>Law &amp; Regulation</option>
        <option>Buyer Tips</option>
        <option>Seller Tips</option>
        <option>Community</option>
      </select>

      <label htmlFor="excerpt">Excerpt (shown in the blog list)</label>
      <input id="excerpt" type="text" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />

      <label htmlFor="body">Body (Markdown supported)</label>
      <textarea id="body" rows={16} style={{ width: "100%", fontFamily: "var(--font-body)", fontSize: 15, padding: 12, border: "1px solid var(--line)", borderRadius: "var(--radius)" }} value={bodyMarkdown} onChange={(e) => setBodyMarkdown(e.target.value)} />

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="btn-primary" style={{ marginTop: 0 }} disabled={saving || !title || !bodyMarkdown} onClick={() => save(false)}>
          Save Draft
        </button>
        <button className="btn-primary" style={{ marginTop: 0, background: "var(--clay-dark)" }} disabled={saving || !title || !bodyMarkdown} onClick={() => save(true)}>
          Publish
        </button>
      </div>
    </div>
  );
}
