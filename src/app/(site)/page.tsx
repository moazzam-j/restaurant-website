import Link from "next/link";
import Image from "next/image";
import Footer from "@/components/Footer";
import { getFeatured } from "@/lib/menu-data";
import AddToCartButton from "@/components/AddToCartButton";

export default async function HomePage() {
  const featured = await getFeatured();

  return (
    <div>
      {/* hero */}
      <div
        className="relative flex flex-col items-center gap-[clamp(32px,5vw,64px)] overflow-hidden px-5 pt-[clamp(48px,7vw,96px)] pb-[clamp(40px,5vw,72px)] sm:px-8 md:flex-row lg:px-14"
        style={{
          background:
            "radial-gradient(820px 520px at 88% 8%, rgba(242,169,58,0.16) 0%, rgba(242,169,58,0) 62%), radial-gradient(600px 420px at 6% 92%, rgba(111,168,90,0.10) 0%, rgba(111,168,90,0) 65%)",
        }}
      >
        <div className="w-full md:flex-1">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="h-[7px] w-[7px] rounded-full bg-green" />
            <div className="text-[12.5px] font-bold uppercase tracking-[2px] text-green-soft">
              100% Fresh · Made to Order
            </div>
          </div>
          <h1 className="font-display whitespace-nowrap text-[clamp(20px,6vw,32px)] leading-[1.02] tracking-[0.5px] text-text-bright md:max-w-[588px] md:whitespace-normal md:text-[57px]">
            DCF — Organic Hai Yaar!
          </h1>
          <p className="mt-6 max-w-[440px] text-[clamp(15.5px,1.5vw,18px)] leading-[1.7] font-normal text-mustard-soft">
            We don&apos;t just serve food — we serve moments. At DCF, every bite is
            crafted with 100% organic ingredients, bold flavors, and zero
            compromises. Because you deserve better than ordinary
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/menu"
              className="rounded-xl bg-mustard px-[34px] py-[17px] text-[15.5px] font-extrabold tracking-wide text-[#100D0A] shadow-[0_12px_30px_-10px_rgba(242,169,58,0.5)] transition-transform hover:-translate-y-0.5"
            >
              ORDER NOW
            </Link>
            <Link
              href="/menu"
              className="rounded-xl border border-white/16 px-[34px] py-[17px] text-[15.5px] font-semibold text-text transition-colors hover:border-white/30"
            >
              View Menu
            </Link>
          </div>
        </div>
        <div className="w-full md:flex-1">
          <Image
            src="/images/hero-photo.webp"
            alt="Burger, fries and fried chicken"
            width={800}
            height={640}
            priority
            sizes="(max-width: 768px) 100vw, 45vw"
            className="block aspect-[5/4] h-auto w-full rounded-[22px] object-cover"
          />
        </div>
      </div>

      {/* delivery strip */}
      <div className="mx-5 mb-[clamp(40px,6vw,64px)] flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-white/8 bg-gradient-to-b from-white/[0.035] to-white/[0.015] px-[clamp(20px,3vw,34px)] py-6 sm:mx-8 lg:mx-14">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-mustard/25 bg-mustard/10 text-[19px]">
            🛵
          </div>
          <div>
            <div className="text-[15.5px] font-bold text-text">
              Delivery across Bahria Town Lahore
            </div>
            <div className="mt-[3px] text-[13.5px] text-muted">
              Open daily 4:00 PM – 2:00 AM · Min order Rs 1000 · Pickup available
            </div>
          </div>
        </div>
      </div>

      {/* featured */}
      <div className="px-5 pb-[clamp(56px,7vw,80px)] sm:px-8 lg:px-14">
        <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3">
          <div className="font-display text-[clamp(26px,3vw,34px)] tracking-[0.3px] text-text">
            MOST LOVED
          </div>
          <Link href="/menu" className="text-[13.5px] text-muted hover:text-mustard">
            See full menu →
          </Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
          {featured.map((item) => (
            <div
              key={item.id}
              className="group overflow-hidden rounded-[18px] border border-white/8 bg-gradient-to-b from-white/[0.035] to-white/[0.01] transition-[transform,border-color] duration-250 hover:-translate-y-1.5 hover:border-mustard/35"
            >
              <Image
                src={item.image}
                alt={item.name}
                width={400}
                height={300}
                sizes="(max-width: 640px) 50vw, 25vw"
                className="block aspect-[4/3] h-auto w-full border-b border-white/6 object-cover"
              />
              <div className="p-[18px]">
                <div className="text-[15px] font-bold text-text">{item.name}</div>
                <div className="mt-2.5 text-sm font-extrabold text-mustard">
                  Rs {item.price}
                </div>
                <AddToCartButton item={item} className="mt-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
