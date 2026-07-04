import { prisma } from "@/lib/prisma";

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string;
  available: boolean;
  featured: boolean;
};

export type MenuCategory = {
  id: string;
  slug: string;
  label: string;
  items: MenuItem[];
};

export async function getMenu(): Promise<MenuCategory[]> {
  const categories = await prisma.menuCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  return categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    label: c.label,
    items: c.items,
  }));
}

export async function getFeatured(): Promise<MenuItem[]> {
  return prisma.menuItem.findMany({
    where: { featured: true, available: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function findMenuItem(id: string): Promise<MenuItem | null> {
  return prisma.menuItem.findUnique({ where: { id } });
}
