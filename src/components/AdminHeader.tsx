"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/menu", label: "Menu" },
];

export default function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="print:hidden flex items-center justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-8">
      <div className="flex items-center gap-6">
        <Link href="/admin" className="font-display text-lg tracking-wide text-mustard">
          DCF ADMIN
        </Link>
        {!isLogin && (
          <div className="flex items-center gap-4">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="pb-0.5 text-sm font-semibold transition-colors"
                  style={{
                    color: active ? "var(--color-mustard)" : "var(--color-muted)",
                    borderBottom: active ? "2px solid var(--color-mustard)" : "2px solid transparent",
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
      {!isLogin && (
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs text-muted hover:text-text">
            View site
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-muted hover:text-text"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
