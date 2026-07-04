import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/order-status";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { items: true },
    orderBy: { orderNumber: "asc" },
  });

  const header = [
    "Order #",
    "Placed At",
    "Status",
    "Customer",
    "Phone",
    "Mode",
    "Address",
    "Items",
    "Subtotal",
    "Delivery Fee",
    "Total",
    "Notes",
  ];

  const rows = orders.map((o) => [
    String(o.orderNumber),
    o.createdAt.toISOString(),
    statusLabel(o.status),
    o.customerName,
    o.phone,
    o.deliveryMode,
    o.address ?? "",
    o.items.map((i) => `${i.qty}x ${i.name}`).join("; "),
    String(o.subtotal),
    String(o.deliveryFee),
    String(o.total),
    o.notes ?? "",
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dcf-orders-${date}.csv"`,
    },
  });
}
