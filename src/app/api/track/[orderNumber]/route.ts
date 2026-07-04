import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber: raw } = await params;
  const orderNumber = Number(raw);
  const phoneDigits = (req.nextUrl.searchParams.get("phone") ?? "").replace(/\D/g, "");

  if (!Number.isFinite(orderNumber)) {
    return NextResponse.json({ error: "Invalid order number" }, { status: 400 });
  }
  if (phoneDigits.length !== 11) {
    return NextResponse.json({ error: "Enter the 11-digit phone number used for this order" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });

  // Order numbers are sequential and easy to guess, so the phone number used
  // to place the order acts as a shared secret — without it (or with the
  // wrong one) this returns the same "not found" response as a bad order
  // number, so it doesn't reveal whether the order exists.
  if (!order || order.phone.replace(/\D/g, "") !== phoneDigits) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Even once verified, name/address/notes stay out of the response — the
  // customer already has them, nothing else needs to fetch them here.
  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    deliveryMode: order.deliveryMode,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    total: order.total,
    items: order.items.map((i) => ({ name: i.name, qty: i.qty })),
  });
}
