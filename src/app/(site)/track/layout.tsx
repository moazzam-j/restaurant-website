// The track page is a client component ("use client"), which can't export
// metadata itself — this passthrough layout exists solely to carry it.
export const metadata = {
  title: "Track Your Order",
  description:
    "Track your Delite Chicken Food order in real time — enter your order number or phone number to see its status, from preparing to delivered.",
  alternates: { canonical: "/track" },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
