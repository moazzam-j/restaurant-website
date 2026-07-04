"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { BUSINESS_HOURS_LABEL, isWithinBusinessHours } from "@/lib/business-hours";
import { DELIVERY_AREA_LABEL, isAddressInDeliveryArea } from "@/lib/delivery-area";

export default function CartPage() {
  const {
    lines,
    deliveryMode,
    setDeliveryMode,
    inc,
    dec,
    clearCart,
    subtotal,
    total,
  } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(() => isWithinBusinessHours());

  useEffect(() => {
    const id = setInterval(() => setIsOpen(isWithinBusinessHours()), 30_000);
    return () => clearInterval(id);
  }, []);

  const isDelivery = deliveryMode === "delivery";
  const phoneDigits = phone.replace(/\D/g, "");
  const isPhoneValid = phoneDigits.length === 11;
  const isAddressValid = !isDelivery || isAddressInDeliveryArea(address);
  const canPlaceOrder =
    isOpen &&
    lines.length > 0 &&
    name.trim() !== "" &&
    isPhoneValid &&
    (!isDelivery || address.trim() !== "") &&
    isAddressValid;

  async function placeOrder() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          phone,
          address,
          notes,
          deliveryMode,
          items: lines.map((l) => ({ id: l.id, qty: l.qty })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not place order");
      }
      const data = await res.json();
      setOrderNumber(data.orderNumber);
      clearCart();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setSubmitting(false);
    }
  }

  if (orderNumber !== null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
        <div className="font-display mb-3 text-[32px] text-mustard">ORDER PLACED!</div>
        <p className="max-w-[420px] text-[15px] leading-[1.7] text-muted">
          Thanks {name || "there"} — we&apos;ve got your order. We&apos;ll call {phone} to
          confirm and get it {isDelivery ? "on the way" : "ready for pickup"}. Cash on
          Delivery.
        </p>
        <div className="mt-6 rounded-xl border border-mustard/30 bg-mustard/10 px-6 py-4">
          <div className="text-xs uppercase tracking-wide text-muted">Your order number</div>
          <div className="font-display text-3xl text-mustard">#{orderNumber}</div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href={`/track?order=${orderNumber}&phone=${encodeURIComponent(phone)}`}
            className="rounded-xl border border-white/16 px-8 py-4 text-[15px] font-semibold text-text"
          >
            Track Order
          </Link>
          <Link
            href="/menu"
            className="rounded-xl bg-mustard px-8 py-4 text-[15px] font-extrabold text-[#100D0A]"
          >
            BACK TO MENU
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-[clamp(28px,4vw,56px)] px-5 py-[clamp(28px,4vw,56px)] sm:px-8 lg:px-14">
      <div className="min-w-[280px] flex-1 basis-[420px]">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div className="font-display text-[clamp(28px,3.5vw,36px)] tracking-[0.3px] text-text">
            YOUR CART
          </div>
          <Link
            href="/track"
            className="rounded-lg border border-white/16 px-4 py-2 text-[13px] font-semibold text-text transition-colors hover:border-mustard/40 hover:text-mustard"
          >
            Track Your Order
          </Link>
        </div>

        {lines.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/3 p-10 text-center text-muted">
            Your cart is empty.{" "}
            <Link href="/menu" className="text-mustard underline">
              Browse the menu
            </Link>
            .
          </div>
        ) : (
          lines.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-4 border-b border-white/6 py-[18px]"
            >
              <Image
                src={item.image}
                alt={item.name}
                width={68}
                height={68}
                className="block h-[68px] w-[68px] flex-shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-[140px] flex-1">
                <div className="text-[15px] font-bold text-text">{item.name}</div>
                <div className="mt-1 text-[13.5px] font-bold text-mustard">
                  Rs {item.price} each
                </div>
              </div>
              <div className="flex items-center gap-3.5 rounded-[10px] border border-white/8 bg-white/4 px-3.5 py-2">
                <button
                  type="button"
                  onClick={() => dec(item.id)}
                  className="cursor-pointer select-none text-base text-text"
                  aria-label={`Decrease ${item.name}`}
                >
                  −
                </button>
                <span className="text-sm font-bold text-text">{item.qty}</span>
                <button
                  type="button"
                  onClick={() => inc(item.id)}
                  className="cursor-pointer select-none text-base text-text"
                  aria-label={`Increase ${item.name}`}
                >
                  +
                </button>
              </div>
              <div className="w-20 text-right text-[15px] font-extrabold text-text">
                Rs {item.price * item.qty}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="h-fit min-w-[280px] max-w-[440px] flex-1 basis-[340px] rounded-[20px] border border-white/8 bg-gradient-to-b from-white/3 to-white/1 p-7">
        {!isOpen && (
          <div className="mb-6 rounded-xl border border-mustard/25 bg-mustard/10 px-4 py-3.5 text-center text-[13.5px] font-semibold text-mustard">
            We&apos;re closed right now. Orders are open daily {BUSINESS_HOURS_LABEL}.
          </div>
        )}

        <div className="mb-6 flex rounded-xl bg-white/4 p-[5px]">
          <button
            type="button"
            onClick={() => setDeliveryMode("delivery")}
            className="flex-1 cursor-pointer rounded-[9px] py-[13px] text-center text-sm font-extrabold transition-colors"
            style={{
              background: isDelivery ? "var(--color-mustard)" : "transparent",
              color: isDelivery ? "#100D0A" : "var(--color-muted)",
            }}
          >
            Delivery
          </button>
          <button
            type="button"
            onClick={() => setDeliveryMode("pickup")}
            className="flex-1 cursor-pointer rounded-[9px] py-[13px] text-center text-sm font-bold transition-colors"
            style={{
              background: !isDelivery ? "var(--color-mustard)" : "transparent",
              color: !isDelivery ? "#100D0A" : "var(--color-muted)",
            }}
          >
            Pickup
          </button>
        </div>

        <form
          className="mb-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (canPlaceOrder && !submitting) placeOrder();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="rounded-[10px] border border-white/9 bg-white/3 px-4 py-3.5 text-sm text-text placeholder:text-muted focus:border-mustard/50 focus:outline-none"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number (11 digits)"
            type="tel"
            inputMode="numeric"
            maxLength={15}
            className="rounded-[10px] border border-white/9 bg-white/3 px-4 py-3.5 text-sm text-text placeholder:text-muted focus:border-mustard/50 focus:outline-none"
          />
          {phone.trim() !== "" && !isPhoneValid && (
            <div className="-mt-1.5 text-xs text-red-400">
              Enter an 11-digit phone number ({phoneDigits.length}/11)
            </div>
          )}
          {isDelivery && (
            <>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Delivery address (include Bahria Town)"
                className="rounded-[10px] border border-white/9 bg-white/3 px-4 py-3.5 text-sm text-text placeholder:text-muted focus:border-mustard/50 focus:outline-none"
              />
              {address.trim() !== "" && !isAddressValid && (
                <div className="-mt-1.5 text-xs text-red-400">
                  We only deliver within {DELIVERY_AREA_LABEL}. Please mention &quot;Bahria
                  Town&quot; in your address, or switch to Pickup.
                </div>
              )}
            </>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Order notes (optional)"
            rows={2}
            className="resize-none rounded-[10px] border border-white/9 bg-white/3 px-4 py-3.5 text-sm text-text placeholder:text-muted focus:border-mustard/50 focus:outline-none"
          />

          <div className="mb-2 mt-3 border-t border-white/7 pt-5">
            <div className="mb-4 flex justify-between text-sm text-muted">
              <span>Subtotal</span>
              <span>Rs {subtotal}</span>
            </div>
            <div className="flex justify-between text-[19px] font-extrabold text-text">
              <span>Total</span>
              <span className="text-mustard">Rs {total}</span>
            </div>
          </div>

          {submitError && <div className="text-sm text-red-400">{submitError}</div>}

          <button
            type="submit"
            disabled={!canPlaceOrder || submitting}
            className="rounded-xl bg-mustard py-[18px] text-center text-[15.5px] font-extrabold text-[#100D0A] shadow-[0_12px_30px_-10px_rgba(242,169,58,0.5)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {!isOpen
              ? "CLOSED · OPENS 4:00 PM"
              : submitting
                ? "PLACING ORDER…"
                : "PLACE ORDER · CASH ON DELIVERY"}
          </button>
        </form>
      </div>
    </div>
  );
}
