"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { useEffect, useRef } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/cart", label: "Cart" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const pathname = usePathname();
  const { count } = useCart();
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    // Publishes the nav's real (responsive) height as a CSS variable, so any
    // sticky element that needs to sit flush below it (e.g. the menu page's
    // category tabs) can reference the true value instead of a guessed pixel
    // number — a hardcoded offset drifts at different breakpoints and leaves
    // a gap that scrolled content peeks through.
    const observer = new ResizeObserver(() => {
      // Use the full border-box height (offsetHeight), not contentRect —
      // contentRect excludes padding/border, which would understate the
      // nav's real rendered height and reopen the exact gap this fixes.
      document.documentElement.style.setProperty("--nav-height", `${el.offsetHeight}px`);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={navRef}
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-5 border-b border-mustard/10 bg-bg px-5 py-4 sm:px-8 lg:px-14"
    >
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/images/dcf-logo.png"
          alt="DCF"
          width={200}
          height={141}
          priority
          className="block h-[clamp(48px,6vw,68px)] w-auto"
        />
      </Link>

      <div className="flex flex-wrap gap-5 text-sm font-semibold tracking-wide sm:gap-8 lg:gap-10">
        {links.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className="relative cursor-pointer pb-1 transition-colors"
              style={{
                color: active ? "var(--color-mustard)" : "var(--color-inactive)",
                borderBottom: `2px solid ${active ? "var(--color-mustard)" : "transparent"}`,
              }}
            >
              {link.label}
              {link.href === "/cart" && count > 0 && (
                <span className="absolute -right-4 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-mustard px-1 text-[10px] font-bold text-[#100D0A]">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
