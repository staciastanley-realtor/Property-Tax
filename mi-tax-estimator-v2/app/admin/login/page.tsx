"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed.");
        return;
      }
      router.push("/admin/referrals");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="dash-wrap" style={{ maxWidth: 400, paddingTop: 60 }}>
      <div className="card">
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}>Owner Login</h2>
        <label htmlFor="pw">Password</label>
        <input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <div className="error-box" style={{ margin: "12px 0 0" }}>{error}</div>}
        <button className="btn-primary" onClick={submit} disabled={loading || !password}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </div>
    </main>
  );
}
