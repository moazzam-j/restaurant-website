import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateMenuPages } from "@/lib/revalidate-menu";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const direction = body?.direction === "up" || body?.direction === "down" ? body.direction : null;
  if (!direction) return NextResponse.json({ error: "Invalid direction" }, { status: 400 });

  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const siblings = await prisma.menuItem.findMany({
    where: { categoryId: item.categoryId },
    orderBy: { sortOrder: "asc" },
  });
  const index = siblings.findIndex((i) => i.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) {
    return NextResponse.json({ ok: true }); // already at the edge, no-op
  }

  const a = siblings[index];
  const b = siblings[swapIndex];
  await prisma.$transaction([
    prisma.menuItem.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.menuItem.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidateMenuPages();
  return NextResponse.json({ ok: true });
}
