import Image from "next/image";
import Link from "next/link";
import SocialLinks from "@/components/SocialLinks";

const quickLinks = [
  { label: "Menu", href: "/menu" },
  { label: "Track Your Order", href: "/track" },
  { label: "Contact", href: "/contact" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <div className="border-t border-white/6 bg-bg-elevated">
      <div className="grid grid-cols-1 gap-9 px-5 py-[clamp(32px,4vw,48px)] sm:grid-cols-3 sm:gap-8 sm:px-8 lg:px-14">
        <div>
          <Image
            src="/images/dcf-logo.png"
            alt="DCF"
            width={140}
            height={99}
            className="mb-4 h-10 w-auto"
          />
          <div className="text-[13.5px] leading-[1.9] text-muted">
            Shop # 09 E, Gardinia Market, Bahria Town Lahore
            <br />
            0300-8025248 · 4PM – 2AM daily
          </div>
        </div>

        <div>
          <div className="mb-4 text-[12.5px] font-bold uppercase tracking-wide text-text">
            Quick Links
          </div>
          <div className="flex flex-col gap-2.5">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13.5px] text-muted transition-colors hover:text-mustard"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="sm:text-right">
          <div className="mb-4 text-[12.5px] font-bold uppercase tracking-wide text-text">
            Follow Us
          </div>
          <div className="sm:flex sm:justify-end">
            <SocialLinks size={40} />
          </div>
        </div>
      </div>

      <div className="border-t border-white/6 px-5 py-5 text-center text-[12px] text-muted sm:px-8 lg:px-14">
        © {year} DCF — Delite Chicken Food. All rights reserved.
      </div>
    </div>
  );
}
