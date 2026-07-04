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

  const all = await prisma.menuCategory.findMany({ orderBy: { sortOrder: "asc" } });
  const index = all.findIndex((c) => c.id === id);
  if (index === -1) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= all.length) {
    return NextResponse.json({ ok: true }); // already at the edge, no-op
  }

  const a = all[index];
  const b = all[swapIndex];
  await prisma.$transaction([
    prisma.menuCategory.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.menuCategory.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidateMenuPages();
  return NextResponse.json({ ok: true });
}
