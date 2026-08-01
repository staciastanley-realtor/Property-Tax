"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") return <>{children}</>;

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const tabs = [
    { href: "/admin/referrals", label: "Referrals" },
    { href: "/admin/blog", label: "Blog" },
    { href: "/admin/analytics", label: "Analytics" },
  ];

  return (
    <div>
      <div className="admin-topbar">
        <span className="admin-brand">Owner Dashboard</span>
        <nav className="admin-nav">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className={pathname.startsWith(t.href) ? "active" : ""}>
              {t.label}
            </Link>
          ))}
        </nav>
        <button className="btn-link" onClick={logout}>Log Out</button>
      </div>
      <main className="dash-wrap">{children}</main>
    </div>
  );
}
