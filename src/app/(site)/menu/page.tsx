import Image from "next/image";
import Link from "next/link";
import { getMenu } from "@/lib/menu-data";
import AddToCartButton from "@/components/AddToCartButton";

export const metadata = {
  title: "Menu — DCF",
};

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryParam } = await searchParams;
  const menu = (await getMenu()).filter((category) => category.items.length > 0);
  const activeSlug = menu.some((c) => c.slug === categoryParam) ? categoryParam : menu[0]?.slug;
  const activeCategory = menu.find((c) => c.slug === activeSlug);

  return (
    <div className="px-5 py-[clamp(28px,4vw,56px)] sm:px-8 lg:px-14">
      <div className="font-display mb-2 text-center text-[clamp(30px,4vw,44px)] tracking-[0.3px] text-text">
        MENU
      </div>
      <div className="mb-8 text-center text-[14.5px] text-muted">
        Flame-fried classics, made fresh to order.
      </div>

      {/* category tabs — wraps onto multiple rows instead of scrolling, so nothing hides off-screen */}
      <div className="sticky top-[var(--nav-height)] z-40 -mx-5 mb-10 flex flex-wrap justify-center gap-2.5 border-b border-white/6 bg-bg px-5 py-4 sm:-mx-8 sm:px-8 lg:-mx-14 lg:px-14">
        {menu.map((category) => {
          const active = category.slug === activeSlug;
          return (
            <Link
              key={category.id}
              href={`/menu?category=${category.slug}`}
              scroll={false}
              className={`whitespace-nowrap rounded-full border px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wide transition-all ${
                active
                  ? "scale-[1.04] border-transparent bg-mustard text-[#100D0A] shadow-[0_8px_20px_-6px_rgba(242,169,58,0.6)]"
                  : "border-white/14 bg-white/5 text-text hover:border-mustard/40 hover:bg-white/8 hover:text-mustard"
              }`}
            >
              {category.label}
            </Link>
          );
        })}
      </div>

      {activeCategory && (
        <div>
          <div className="font-display mb-4 text-[19px] tracking-[1.5px] text-mustard">
            {activeCategory.label.toUpperCase()}
          </div>
          <div className="mb-12 grid grid-cols-3 gap-2 sm:gap-5 lg:grid-cols-4">
            {activeCategory.items.map((item) => (
              <div
                key={item.id}
                className="group overflow-hidden rounded-2xl border border-white/8 bg-white/3 transition-[transform,border-color] duration-250 hover:-translate-y-1 hover:border-mustard/35"
              >
                <div className="overflow-hidden">
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={300}
                    height={300}
                    quality={90}
                    sizes="(max-width: 640px) 33vw, (max-width: 1024px) 33vw, 20vw"
                    className={`block aspect-square h-auto w-full object-cover transition-transform duration-300 group-hover:scale-110 ${
                      item.available ? "" : "opacity-40 grayscale"
                    }`}
                  />
                </div>
                <div className="p-1.5 sm:p-3">
                  <div className="min-h-[26px] text-[11px] leading-[1.25] font-bold text-text sm:min-h-[34px] sm:text-[13px]">
                    {item.name}
                  </div>
                  <div className="mt-0.5 text-[11px] font-extrabold text-mustard sm:mt-1 sm:text-[13px]">
                    Rs {item.price}
                  </div>
                  {item.available ? (
                    <AddToCartButton
                      item={item}
                      className="mt-1.5 w-full px-1 py-1.5 text-[10px] sm:mt-2.5 sm:py-2 sm:text-[12px]"
                    />
                  ) : (
                    <div className="mt-1.5 w-full rounded-[10px] border border-white/8 bg-white/3 px-1 py-1.5 text-center text-[10px] font-bold text-muted sm:mt-2.5 sm:py-2 sm:text-[11.5px]">
                      Unavailable
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
