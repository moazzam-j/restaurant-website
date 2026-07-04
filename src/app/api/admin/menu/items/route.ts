import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateMenuPages } from "@/lib/revalidate-menu";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const price = Number.isFinite(body?.price) ? Math.max(0, Math.round(Number(body.price))) : NaN;
  const description =
    typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  const image = typeof body?.image === "string" ? body.image.trim() : "";
  const featured = body?.featured === true;

  if (!categoryId || !name || !Number.isFinite(price) || !image) {
    return NextResponse.json(
      { error: "categoryId, name, price and image are required" },
      { status: 400 }
    );
  }

  const category = await prisma.menuCategory.findUnique({ where: { id: categoryId } });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const last = await prisma.menuItem.findFirst({
    where: { categoryId },
    orderBy: { sortOrder: "desc" },
  });

  const item = await prisma.menuItem.create({
    data: {
      categoryId,
      name,
      price,
      description,
      image,
      featured,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidateMenuPages();
  return NextResponse.json({ item }, { status: 201 });
}
