"use client";

import { useEffect, useMemo, useState } from "react";
import { ALL_STATUSES, statusLabel, type OrderStatus } from "@/lib/order-status";
import StatusSelect from "@/components/StatusSelect";
import Dropdown from "@/components/Dropdown";

const STATUS_FILTER_OPTIONS = [{ value: "all", label: "All statuses" }, ...ALL_STATUSES];

type OrderItem = { id: string; name: string; price: number; qty: number };
type Order = {
  id: string;
  orderNumber: number;
  customerName: string;
  phone: string;
  address: string | null;
  notes: string | null;
  deliveryMode: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

function todayLocal(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export default function AdminOrdersPage() {
  const [date, setDate] = useState(todayLocal());
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (status !== "all") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());

      try {
        const res = await fetch(`/api/orders?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to load orders");
        const data = await res.json();
        setOrders(data.orders);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError("Could not load orders.");
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [date, status, q]);

  async function updateStatus(id: string, newStatus: OrderStatus) {
    setUpdatingId(id);
    const prev = orders;
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: newStatus } : o)));

    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) setOrders(prev);
    setUpdatingId(null);
  }

  async function deleteOrder(id: string, orderNumber: number) {
    if (!window.confirm(`Delete order #${orderNumber}? This can't be undone.`)) return;
    setUpdatingId(id);
    const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      setOrders((os) => os.filter((o) => o.id !== id));
    }
    setUpdatingId(null);
  }

  const totalToday = useMemo(
    () => orders.reduce((sum, o) => (o.status === "cancelled" ? sum : sum + o.total), 0),
    [orders]
  );

  return (
    <div className="px-5 py-6 sm:px-8">
      <div className="print:hidden mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-display text-2xl text-text">ORDERS</div>
          <div className="mt-1 text-xs text-muted">
            {orders.length} order{orders.length === 1 ? "" : "s"} · Rs {totalToday} total
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-bold text-text hover:border-mustard/40"
          >
            Print
          </button>
          <a
            href={`/api/orders/export?date=${date}`}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-bold text-text hover:border-mustard/40"
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="print:hidden mb-6 flex flex-wrap gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-white/9 bg-white/3 px-3 py-2 text-sm text-text focus:border-mustard/50 focus:outline-none"
        />
        <Dropdown value={status} options={STATUS_FILTER_OPTIONS} onChange={setStatus} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search order #, name or phone"
          className="min-w-[220px] flex-1 rounded-lg border border-white/9 bg-white/3 px-3 py-2 text-sm text-text placeholder:text-muted focus:border-mustard/50 focus:outline-none"
        />
      </div>

      {error && <div className="mb-4 text-sm text-red-400">{error}</div>}
      {loading && orders.length === 0 && <div className="text-sm text-muted">Loading…</div>}
      {!loading && orders.length === 0 && !error && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-8 text-center text-sm text-muted">
          No orders for this filter.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {orders.map((o) => (
          <div
            key={o.id}
            className="break-inside-avoid rounded-2xl border border-white/8 bg-gradient-to-b from-white/3 to-white/1 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-extrabold text-text">#{o.orderNumber}</span>
                  <span className="text-xs text-muted">
                    {new Date(o.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
                    {o.deliveryMode}
                  </span>
                </div>
                <div className="mt-1 text-sm text-text">
                  {o.customerName} · {o.phone}
                </div>
                {o.address && <div className="mt-0.5 text-xs text-muted">{o.address}</div>}
                {o.notes && <div className="mt-0.5 text-xs italic text-muted">“{o.notes}”</div>}
              </div>

              <div className="flex items-center gap-2">
                <StatusSelect
                  value={o.status}
                  disabled={updatingId === o.id}
                  onChange={(newStatus) => updateStatus(o.id, newStatus)}
                />
                <button
                  onClick={() => deleteOrder(o.id, o.orderNumber)}
                  disabled={updatingId === o.id}
                  className="print:hidden rounded-lg border border-red-500/25 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
              <span className="hidden print:inline text-xs font-bold text-text">
                {statusLabel(o.status)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/6 pt-3 text-xs text-muted">
              {o.items.map((item) => (
                <span key={item.id}>
                  {item.qty}× {item.name}
                </span>
              ))}
            </div>

            <div className="mt-2 text-sm font-extrabold text-mustard">Rs {o.total}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
