import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_RESULTS = 10;

export async function GET(req: NextRequest) {
  const phoneDigits = (req.nextUrl.searchParams.get("phone") ?? "").replace(/\D/g, "");

  if (phoneDigits.length !== 11) {
    return NextResponse.json({ error: "Enter the 11-digit phone number used for your orders" }, { status: 400 });
  }

  // Phone numbers aren't stored in a normalized column, so matching happens
  // in application code — fine at this restaurant's order volume. Only a
  // lightweight summary is returned per order (no address/notes), same
  // privacy stance as the single-order lookup: the phone number itself is
  // the shared secret that gates access.
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  const matches = orders
    .filter((o) => o.phone.replace(/\D/g, "") === phoneDigits)
    .slice(0, MAX_RESULTS)
    .map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      deliveryMode: o.deliveryMode,
      createdAt: o.createdAt,
      total: o.total,
      items: o.items.map((i) => ({ name: i.name, qty: i.qty })),
    }));

  return NextResponse.json({ orders: matches });
}
