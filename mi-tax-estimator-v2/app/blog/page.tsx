"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PostSummary {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  published_at: string;
}

export default function BlogListPage() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blog").then((r) => r.json()).then((d) => setPosts(d.posts ?? [])).finally(() => setLoading(false));
  }, []);

  return (
    <main className="dash-wrap">
      <div className="dash-hero">
        <p className="eyebrow">Sold With Stacia · Keller Williams Premier</p>
        <h1>Market News &amp; Real Estate Updates</h1>
        <p>Stay current on Michigan real estate law, market trends, and buyer/seller tips.</p>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && posts.length === 0 && <p style={{ color: "var(--charcoal-soft)" }}>No posts published yet — check back soon.</p>}

      {posts.map((p) => (
        <Link key={p.slug} href={`/blog/${p.slug}`} className="card" style={{ display: "block", marginBottom: 16, textDecoration: "none", color: "inherit" }}>
          {p.category && <p className="print-eyebrow" style={{ margin: "0 0 4px" }}>{p.category}</p>}
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 20, margin: "0 0 6px", color: "var(--charcoal)" }}>{p.title}</h2>
          {p.excerpt && <p style={{ color: "var(--charcoal-soft)", fontSize: 14 }}>{p.excerpt}</p>}
          <p style={{ fontSize: 12, color: "var(--charcoal-soft)", marginTop: 8 }}>{new Date(p.published_at).toLocaleDateString()}</p>
        </Link>
      ))}
    </main>
  );
}
