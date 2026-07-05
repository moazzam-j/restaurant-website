"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ORDER_STAGES, stageIndex, statusLabel } from "@/lib/order-status";

type TrackedOrder = {
  orderNumber: number;
  status: string;
  deliveryMode: string;
  createdAt: string;
  updatedAt?: string;
  total: number;
  items: { name: string; qty: number }[];
};

function OrderDetail({ order }: { order: TrackedOrder }) {
  const currentStage = stageIndex(order.status);
  const cancelled = order.status === "cancelled";

  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-b from-white/3 to-white/1 p-7">
      <div className="mb-6 flex items-center justify-between">
        <div className="text-lg font-bold text-text">Order #{order.orderNumber}</div>
        <div
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{
            background: cancelled ? "rgba(239,68,68,0.12)" : "rgba(242,169,58,0.12)",
            color: cancelled ? "#f87171" : "var(--color-mustard)",
          }}
        >
          {statusLabel(order.status)}
        </div>
      </div>

      {!cancelled && (
        <div className="mb-7 flex items-center">
          {ORDER_STAGES.map((stage, i) => (
            <div key={stage.value} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: i <= currentStage ? "var(--color-mustard)" : "rgba(255,255,255,0.06)",
                    color: i <= currentStage ? "#100D0A" : "var(--color-muted)",
                    border: i <= currentStage ? "none" : "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {i + 1}
                </div>
                <div className="whitespace-nowrap text-[11px] text-muted">{stage.label}</div>
              </div>
              {i < ORDER_STAGES.length - 1 && (
                <div
                  className="mx-1 mb-5 h-[2px] flex-1"
                  style={{
                    background: i < currentStage ? "var(--color-mustard)" : "rgba(255,255,255,0.08)",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mb-5 border-t border-white/7 pt-5">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between py-1 text-sm text-muted">
            <span>
              {item.qty}× {item.name}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-between border-t border-white/7 pt-4 text-base font-extrabold text-text">
        <span>Total</span>
        <span className="text-mustard">Rs {order.total}</span>
      </div>
      <div className="mt-4 text-xs text-muted">
        {order.deliveryMode === "delivery" ? "Delivery" : "Pickup"} · placed{" "}
        {new Date(order.createdAt).toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
          hour12: true,
        })}
      </div>
    </div>
  );
}

function TrackForm() {
  const searchParams = useSearchParams();
  const initialOrder = searchParams.get("order") ?? "";
  const initialPhone = searchParams.get("phone") ?? "";

  const [input, setInput] = useState(initialOrder);
  const [phone, setPhone] = useState(initialPhone);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [results, setResults] = useState<TrackedOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const phoneDigits = phone.replace(/\D/g, "");
  const isPhoneValid = phoneDigits.length === 11;

  async function lookupSingle(orderNumberRaw: string, phoneRaw: string) {
    const trimmed = orderNumberRaw.trim().replace(/^#/, "");
    const digits = phoneRaw.replace(/\D/g, "");
    if (!trimmed || digits.length !== 11) return;

    setLoading(true);
    setError(null);
    setOrder(null);
    setResults(null);

    const res = await fetch(
      `/api/track/${encodeURIComponent(trimmed)}?phone=${encodeURIComponent(digits)}`
    );
    setLoading(false);

    if (!res.ok) {
      setError(
        res.status === 404
          ? "No order found with that number and phone combination."
          : "Something went wrong."
      );
      return;
    }
    setOrder(await res.json());
  }

  async function lookupByPhone(phoneRaw: string) {
    const digits = phoneRaw.replace(/\D/g, "");
    if (digits.length !== 11) return;

    setLoading(true);
    setError(null);
    setOrder(null);
    setResults(null);

    const res = await fetch(`/api/track/by-phone?phone=${encodeURIComponent(digits)}`);
    setLoading(false);

    if (!res.ok) {
      setError("Something went wrong.");
      return;
    }
    const data = await res.json();
    const orders: TrackedOrder[] = data.orders;

    if (orders.length === 0) {
      setError("No orders found for that phone number.");
    } else if (orders.length === 1) {
      setOrder(orders[0]);
    } else {
      setResults(orders);
    }
  }

  useEffect(() => {
    // Auto-lookup when arriving from the order-confirmation screen's "Track Order" link.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialOrder && initialPhone) lookupSingle(initialOrder, initialPhone);
  }, [initialOrder, initialPhone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedOrder = input.trim().replace(/^#/, "");
    if (trimmedOrder) {
      lookupSingle(trimmedOrder, phone);
    } else {
      lookupByPhone(phone);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-[clamp(28px,4vw,56px)]">
      <div className="font-display mb-2 text-center text-[clamp(28px,3.5vw,36px)] tracking-[0.3px] text-text">
        TRACK YOUR ORDER
      </div>
      <p className="mb-8 text-center text-[14.5px] text-muted">
        Know your order number? Enter it below. Forgot it? Just enter your phone
        number and we&apos;ll pull up your recent orders.
      </p>

      <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Order number (optional)"
            inputMode="numeric"
            className="flex-1 rounded-[10px] border border-white/9 bg-white/3 px-4 py-3.5 text-sm text-text placeholder:text-muted focus:border-mustard/50 focus:outline-none"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number (11 digits)"
            inputMode="numeric"
            type="tel"
            className="flex-1 rounded-[10px] border border-white/9 bg-white/3 px-4 py-3.5 text-sm text-text placeholder:text-muted focus:border-mustard/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !isPhoneValid}
          className="rounded-[10px] bg-mustard px-6 py-3.5 text-sm font-extrabold text-[#100D0A] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Checking…" : input.trim() ? "Track Order" : "Find My Orders"}
        </button>
      </form>

      {error && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6 text-center text-sm text-muted">
          {error}
        </div>
      )}

      {results && (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-muted">
            Found {results.length} order{results.length === 1 ? "" : "s"} for that phone number —
            tap one to see details.
          </div>
          {results.map((o) => (
            <button
              key={o.orderNumber}
              onClick={() => {
                setOrder(o);
                setResults(null);
                setInput(String(o.orderNumber));
              }}
              className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/3 px-5 py-4 text-left transition-colors hover:border-mustard/35"
            >
              <div>
                <div className="text-sm font-bold text-text">Order #{o.orderNumber}</div>
                <div className="mt-1 text-xs text-muted">
                  {new Date(o.createdAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                    hour12: true,
                  })}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm font-extrabold text-mustard">Rs {o.total}</div>
                <div
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    background: o.status === "cancelled" ? "rgba(239,68,68,0.12)" : "rgba(242,169,58,0.12)",
                    color: o.status === "cancelled" ? "#f87171" : "var(--color-mustard)",
                  }}
                >
                  {statusLabel(o.status)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {order && <OrderDetail order={order} />}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={null}>
      <TrackForm />
    </Suspense>
  );
}
