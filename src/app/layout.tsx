import type { Metadata } from "next";
import { Anton, Work_Sans } from "next/font/google";
import "./globals.css";

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const SITE_NAME = "Delite Chicken Food";
const DEFAULT_TITLE = "Delite Chicken Food (DCF) — Bahria Town Lahore";
const DEFAULT_DESCRIPTION =
  "Premium fried chicken, burgers & more in Bahria Town Lahore. 100% fresh, made to order — delivery and pickup, cash on delivery. Open daily 4 PM – 2 AM.";

export const metadata: Metadata = {
  metadataBase: new URL("https://delitechickenfood.com"),
  applicationName: SITE_NAME,
  title: {
    default: DEFAULT_TITLE,
    // Subpages render as e.g. "Menu — Delite Chicken Food": the consistent
    // brand suffix is one of the signals Google's Site Name feature reads.
    template: `%s — ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "Delite Chicken Food",
    "DCF",
    "fried chicken",
    "burgers",
    "Bahria Town Lahore",
    "food delivery Lahore",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: "/images/hero-photo.webp",
        width: 1146,
        height: 756,
        alt: "Delite Chicken Food — burgers, fries and fried chicken",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/images/hero-photo.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${anton.variable} ${workSans.variable}`}>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
