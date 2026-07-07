// The cart page is a client component ("use client"), which can't export
// metadata itself — this passthrough layout exists solely to carry it.
// Cart/checkout pages are user-specific with no search value, so it's
// noindexed (per Google's guidance) — matching its exclusion from the sitemap.
// follow: true keeps links from it crawlable.
export const metadata = {
  title: "Your Cart",
  description: "Review your Delite Chicken Food order and check out — cash on delivery.",
  alternates: { canonical: "/cart" },
  robots: { index: false, follow: true },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
