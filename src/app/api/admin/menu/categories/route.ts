import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { revalidateMenuPages } from "@/lib/revalidate-menu";

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let suffix = 2;
  while (await prisma.menuCategory.findUnique({ where: { slug } })) {
    slug = `${slugify(base)}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "Category name is required" }, { status: 400 });

  const last = await prisma.menuCategory.findFirst({ orderBy: { sortOrder: "desc" } });
  const category = await prisma.menuCategory.create({
    data: { label, slug: await uniqueSlug(label), sortOrder: (last?.sortOrder ?? -1) + 1 },
    include: { items: true },
  });

  revalidateMenuPages();
  return NextResponse.json({ category }, { status: 201 });
}
