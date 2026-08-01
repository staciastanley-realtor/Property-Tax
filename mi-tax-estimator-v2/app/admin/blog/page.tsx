"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Post {
  id: string;
  title: string;
  category: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
}

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/blog")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setPosts(d.posts)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}>Blog Posts</h1>
        <Link href="/admin/blog/new" className="btn-primary" style={{ textDecoration: "none", padding: "10px 18px" }}>
          + New Post
        </Link>
      </div>

      {loading && <p>Loading…</p>}
      {error && <div className="error-box">{error}</div>}
      {!loading && posts.length === 0 && <p>No posts yet.</p>}

      {posts.map((p) => (
        <Link key={p.id} href={`/admin/blog/${p.id}`} className="card" style={{ display: "block", marginBottom: 10, textDecoration: "none", color: "inherit" }}>
          <strong>{p.title}</strong>{" "}
          <span className={`status-pill ${p.published ? "status-signed" : "status-not_sent"}`}>
            {p.published ? "Published" : "Draft"}
          </span>
          <div style={{ fontSize: 12, color: "var(--charcoal-soft)" }}>
            {p.category || "Uncategorized"} · {new Date(p.created_at).toLocaleDateString()}
          </div>
        </Link>
      ))}
    </div>
  );
}
