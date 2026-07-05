"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

export default function FloatingCartButton() {
  const { count } = useCart();

  if (count === 0) return null;

  return (
    <Link
      href="/cart"
      aria-label={`View cart, ${count} item${count === 1 ? "" : "s"}`}
      className="fixed right-4 bottom-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-mustard text-2xl shadow-[0_16px_32px_-10px_rgba(242,169,58,0.6)] transition-transform hover:-translate-y-0.5 sm:right-6 sm:bottom-6"
    >
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
        <path
          d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 8H6"
          stroke="#100D0A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="21" r="1.6" fill="#100D0A" />
        <circle cx="18" cy="21" r="1.6" fill="#100D0A" />
      </svg>
      <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-bg bg-[#100D0A] px-1 text-[12px] font-bold text-mustard">
        {count}
      </span>
    </Link>
  );
}
