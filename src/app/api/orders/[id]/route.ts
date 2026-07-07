import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isTerminalStatus, isValidStatus, statusLabel } from "@/lib/order-status";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status : "";

  if (!isValidStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  // Delivered/cancelled are final — locked here at the API, not just in the
  // UI, so no request (dropdown, direct API call, anything) can change them.
  if (isTerminalStatus(existing.status)) {
    return NextResponse.json(
      {
        error: `This order is ${statusLabel(existing.status).toLowerCase()} — its status is locked and can't be changed.`,
      },
      { status: 409 }
    );
  }

  try {
    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.order.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}
