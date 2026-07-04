"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartLine = {
  id: string;
  name: string;
  price: number;
  image: string;
  qty: number;
};

type DeliveryMode = "delivery" | "pickup";

type CartContextValue = {
  lines: CartLine[];
  deliveryMode: DeliveryMode;
  setDeliveryMode: (mode: DeliveryMode) => void;
  addItem: (item: Pick<CartLine, "id" | "name" | "price" | "image">) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clearCart: () => void;
  count: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
};

const STORAGE_KEY = "dcf-cart";
const DELIVERY_FEE = 0; // delivery is free

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("delivery");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // One-time hydration from localStorage after mount, so the client's
        // first render matches the server (empty cart) and avoids a hydration mismatch.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Array.isArray(parsed.lines)) setLines(parsed.lines);
        if (parsed.deliveryMode === "pickup") setDeliveryMode("pickup");
      }
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lines, deliveryMode })
    );
  }, [lines, deliveryMode, hydrated]);

  const addItem = useCallback((item: Pick<CartLine, "id" | "name" | "price" | "image">) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.id === item.id);
      if (existing) {
        return prev.map((l) => (l.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const inc = useCallback((id: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, qty: l.qty + 1 } : l)));
  }, []);

  const dec = useCallback((id: string) => {
    setLines((prev) =>
      prev
        .map((l) => (l.id === id ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0)
    );
  }, []);

  const remove = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, l) => sum + l.qty, 0);
    const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
    const deliveryFee = lines.length > 0 && deliveryMode === "delivery" ? DELIVERY_FEE : 0;
    return {
      lines,
      deliveryMode,
      setDeliveryMode,
      addItem,
      inc,
      dec,
      remove,
      clearCart,
      count,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
    };
  }, [lines, deliveryMode, addItem, inc, dec, remove, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
