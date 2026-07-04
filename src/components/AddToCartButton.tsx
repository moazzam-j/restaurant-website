"use client";

import { useState } from "react";
import { useCart, type CartLine } from "@/lib/cart-context";

export default function AddToCartButton({
  item,
  className = "",
}: {
  item: Pick<CartLine, "id" | "name" | "price" | "image">;
  className?: string;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        addItem(item);
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
      className={`cursor-pointer rounded-[10px] border border-mustard/30 bg-mustard/10 px-4 py-2.5 text-[13px] font-bold tracking-wide text-mustard transition-colors hover:bg-mustard hover:text-[#100D0A] ${className}`}
    >
      {added ? "Added ✓" : "Add to Cart"}
    </button>
  );
}
