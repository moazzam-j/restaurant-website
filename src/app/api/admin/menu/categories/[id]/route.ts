import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateMenuPages } from "@/lib/revalidate-menu";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : undefined;
  if (label !== undefined && !label) {
    return NextResponse.json({ error: "Category name can't be empty" }, { status: 400 });
  }

  try {
    const category = await prisma.menuCategory.update({
      where: { id },
      data: { ...(label !== undefined && { label }) },
      include: { items: true },
    });
    revalidateMenuPages();
    return NextResponse.json({ category });
  } catch {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.menuCategory.delete({ where: { id } });
    revalidateMenuPages();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
}
