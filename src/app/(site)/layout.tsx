import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { CartProvider } from "@/lib/cart-context";
import FloatingCartButton from "@/components/FloatingCartButton";

const SITE_URL = "https://delitechickenfood.com";

// Schema.org structured data for Google. Every value below is taken from what
// the site itself already publishes (footer, contact page, business-hours lib,
// SocialLinks) — nothing invented. Restaurant is a subtype of Organization/
// LocalBusiness, so a single node covers business identity + logo; the WebSite
// node (name + alternateName) is what Google's Site Name feature reads.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Restaurant",
      "@id": `${SITE_URL}/#restaurant`,
      name: "Delite Chicken Food",
      alternateName: "DCF",
      url: SITE_URL,
      logo: `${SITE_URL}/images/dcf-logo.png`,
      image: [`${SITE_URL}/images/hero-photo.webp`, `${SITE_URL}/images/dcf-logo.png`],
      telephone: "+92-300-8025248",
      servesCuisine: ["Fried Chicken", "Burgers", "Fast Food"],
      address: {
        "@type": "PostalAddress",
        streetAddress: "Shop # 09 E, Gardinia Market, Bahria Town",
        addressLocality: "Lahore",
        addressRegion: "Punjab",
        addressCountry: "PK",
      },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
          // closes < opens is Google's documented format for hours that run
          // past midnight (open daily 4:00 PM – 2:00 AM).
          opens: "16:00",
          closes: "02:00",
        },
      ],
      menu: `${SITE_URL}/menu`,
      sameAs: [
        "https://www.instagram.com/delitechickenfood.pk/",
        "https://www.tiktok.com/@delitechickenfood.pk",
        "https://www.facebook.com/profile.php?id=61591479907661",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Delite Chicken Food",
      alternateName: "DCF",
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#restaurant` },
    },
  ],
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
      <FloatingCartButton />
    </CartProvider>
  );
}
