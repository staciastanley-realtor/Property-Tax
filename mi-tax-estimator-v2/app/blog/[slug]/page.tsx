"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { markdownToHtml } from "@/lib/markdown";

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const [post, setPost] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/blog/${params.slug}`)
      .then((r) => r.json())
      .then((d) => (d.post ? setPost(d.post) : setNotFound(true)));
  }, [params.slug]);

  if (notFound) return <main className="dash-wrap"><p>Post not found.</p></main>;
  if (!post) return <main className="dash-wrap"><p>Loading…</p></main>;

  return (
    <main className="dash-wrap" style={{ maxWidth: 720 }}>
      <div style={{ padding: "32px 4px" }}>
        {post.category && <p className="print-eyebrow">{post.category}</p>}
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 30, color: "var(--charcoal)" }}>{post.title}</h1>
        <p style={{ fontSize: 13, color: "var(--charcoal-soft)" }}>{new Date(post.published_at).toLocaleDateString()}</p>
      </div>
      <div className="card blog-body" dangerouslySetInnerHTML={{ __html: markdownToHtml(post.body_markdown) }} />
    </main>
  );
}
