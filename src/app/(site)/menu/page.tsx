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
      <div className="sticky top-[85px] z-40 -mx-5 mb-10 flex flex-wrap justify-center gap-2 border-b border-white/6 bg-bg/90 px-5 py-3 backdrop-blur-lg sm:-mx-8 sm:px-8 lg:-mx-14 lg:px-14">
        {menu.map((category) => {
          const active = category.slug === activeSlug;
          return (
            <Link
              key={category.id}
              href={`/menu?category=${category.slug}`}
              scroll={false}
              className="whitespace-nowrap rounded-full border px-4 py-2 text-[12.5px] font-bold uppercase tracking-wide transition-colors"
              style={{
                borderColor: active ? "var(--color-mustard)" : "rgba(255,255,255,0.1)",
                color: active ? "var(--color-mustard)" : "var(--color-muted)",
                background: active ? "rgba(242,169,58,0.1)" : "transparent",
              }}
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
          <div className="mb-12 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-5">
            {activeCategory.items.map((item) => (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3"
              >
                <Image
                  src={item.image}
                  alt={item.name}
                  width={300}
                  height={300}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  className={`block aspect-square h-auto w-full object-cover ${
                    item.available ? "" : "opacity-40 grayscale"
                  }`}
                />
                {!item.available && (
                  <div className="absolute right-2.5 top-2.5 rounded-full bg-[#100D0A]/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                    Unavailable
                  </div>
                )}
                <div className="p-3.5">
                  <div className="text-[14.5px] font-bold text-text">{item.name}</div>
                  {item.description && (
                    <div className="mt-1 text-xs leading-[1.4] text-muted">
                      {item.description}
                    </div>
                  )}
                  <div className="mt-2 text-[14.5px] font-extrabold text-mustard">
                    Rs {item.price}
                  </div>
                  {item.available ? (
                    <AddToCartButton item={item} className="mt-3 w-full" />
                  ) : (
                    <div className="mt-3 w-full rounded-[10px] border border-white/8 bg-white/3 px-4 py-2.5 text-center text-[13px] font-bold text-muted">
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
