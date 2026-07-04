import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrderWithNumber } from "@/lib/order-number";
import { findMenuItem } from "@/lib/menu-data";
import { BUSINESS_HOURS_LABEL, isWithinBusinessHours } from "@/lib/business-hours";
import { DELIVERY_AREA_LABEL, isAddressInDeliveryArea } from "@/lib/delivery-area";

const DELIVERY_FEE = 0; // delivery is free

type IncomingItem = { id: unknown; qty: unknown };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  if (!isWithinBusinessHours()) {
    return NextResponse.json(
      { error: `We're closed right now. Orders are open daily ${BUSINESS_HOURS_LABEL}.` },
      { status: 403 }
    );
  }

  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const deliveryMode = body.deliveryMode === "pickup" ? "pickup" : "delivery";
  const rawItems: IncomingItem[] = Array.isArray(body.items) ? body.items : [];

  if (!customerName || !phone) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }
  if (phone.replace(/\D/g, "").length !== 11) {
    return NextResponse.json({ error: "Phone number must be 11 digits" }, { status: 400 });
  }
  if (deliveryMode === "delivery" && !address) {
    return NextResponse.json({ error: "Delivery address is required" }, { status: 400 });
  }
  if (deliveryMode === "delivery" && !isAddressInDeliveryArea(address)) {
    return NextResponse.json(
      {
        error: `We only deliver within ${DELIVERY_AREA_LABEL}. Please update your address to include "Bahria Town", or choose Pickup.`,
      },
      { status: 400 }
    );
  }

  // Prices and item names are looked up server-side from the menu catalog rather
  // than trusted from the client, so a tampered request can't under-charge an order.
  // Sold-out items are also rejected here, not just hidden client-side.
  const lookups = await Promise.all(
    rawItems.map(async (raw) => {
      const id = typeof raw.id === "string" ? raw.id : "";
      const qty = Number.isFinite(raw.qty) ? Math.max(1, Math.floor(Number(raw.qty))) : 0;
      const menuItem = await findMenuItem(id);
      if (!menuItem || !menuItem.available || qty <= 0) return null;
      return { menuItemId: menuItem.id, name: menuItem.name, price: menuItem.price, qty };
    })
  );
  const items = lookups.filter((item): item is NonNullable<typeof item> => item !== null);

  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const deliveryFee = deliveryMode === "delivery" ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;

  const order = await createOrderWithNumber<{ orderNumber: number; id: string }>(
    prisma,
    (orderNumber) => ({
      data: {
        orderNumber,
        customerName,
        phone,
        address: deliveryMode === "delivery" ? address : null,
        notes: notes || null,
        deliveryMode,
        subtotal,
        deliveryFee,
        total,
        items: { create: items },
      },
      select: { orderNumber: true, id: true },
    })
  );

  return NextResponse.json({ orderNumber: order.orderNumber, id: order.id }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status")?.trim();
  const date = searchParams.get("date")?.trim(); // YYYY-MM-DD, local restaurant day

  const where: Record<string, unknown> = {};

  if (status && status !== "all") {
    where.status = status;
  }

  if (q) {
    const asNumber = Number(q);
    where.OR = [
      ...(Number.isFinite(asNumber) ? [{ orderNumber: asNumber }] : []),
      { customerName: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  if (date) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59.999`);
    if (!Number.isNaN(start.getTime())) {
      where.createdAt = { gte: start, lte: end };
    }
  }

  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}
