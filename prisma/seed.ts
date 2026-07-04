import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl.replace(/^file:/, "") });
const prisma = new PrismaClient({ adapter });

type SeedItem = {
  name: string;
  description?: string;
  price: number;
  image: string;
  featured?: boolean;
};

const categories: { slug: string; label: string; items: SeedItem[] }[] = [
  {
    slug: "appetizers",
    label: "Appetizers",
    items: [
      { name: "Fish and Chips (6pc)", price: 900, image: "/images/menu-item-1.webp" },
      { name: "Loaded Fries", price: 650, image: "/images/menu-item-2.webp", featured: true },
      { name: "Hot Wings (6pc)", price: 450, image: "/images/menu-item-3.webp" },
      { name: "Fried Chicken Pc", price: 350, image: "/images/menu-item-4.webp" },
      { name: "Nuggets (6pc)", price: 350, image: "/images/menu-item-5.webp" },
      { name: "Simple Fries", price: 250, image: "/images/menu-item-6.webp" },
    ],
  },
  {
    slug: "burger",
    label: "Burger",
    items: [
      { name: "Rush Fish Burger", price: 1100, image: "/images/menu-item-7.webp" },
      { name: "Rush Stuff Beefy", price: 1100, image: "/images/menu-item-8.webp" },
      { name: "Rush Beefy Burger", price: 700, image: "/images/menu-item-9.webp" },
      { name: "Rush Stuff Chicken", price: 700, image: "/images/menu-item-10.webp" },
      { name: "Rush Ziggy Burger", price: 600, image: "/images/menu-item-11.webp", featured: true },
      { name: "Rush Patty Burger", price: 400, image: "/images/menu-item-12.webp" },
    ],
  },
  {
    slug: "fried-chicken",
    label: "Fried Chicken",
    items: [
      {
        name: "Quarter",
        description: "2 pc · 1 fries · 1 bun · 1 dip",
        price: 800,
        image: "/images/menu-item-13.webp",
      },
      {
        name: "Half",
        description: "4 pc · 1 fries · 1 bun · 1 dip",
        price: 1300,
        image: "/images/menu-item-14.webp",
      },
      {
        name: "Full (8pc)",
        description: "8 pc · 1 fries · 2 bun · 2 dip",
        price: 2500,
        image: "/images/menu-item-15.webp",
        featured: true,
      },
    ],
  },
  {
    slug: "refreshment",
    label: "Refreshment",
    items: [
      { name: "Cookies n' Cream Shake", price: 700, image: "/images/menu-item-16.webp" },
      { name: "Oreo Shake", price: 700, image: "/images/menu-item-17.webp" },
      { name: "Fruit Salad", price: 450, image: "/images/menu-item-18.webp" },
      { name: "Mint Margarita", price: 250, image: "/images/menu-item-19.webp" },
      { name: "Lemonade", price: 200, image: "/images/menu-item-20.webp", featured: true },
      { name: "Reg Drink", price: 100, image: "/images/menu-item-21.webp" },
    ],
  },
  {
    slug: "sauces",
    label: "Sauces",
    items: [
      { name: "Honey Mustard", price: 150, image: "/images/menu-item-22.webp" },
      { name: "Ranch", price: 150, image: "/images/menu-item-23.webp" },
      { name: "Atomic", price: 100, image: "/images/menu-item-24.webp" },
      { name: "Garlic", price: 100, image: "/images/menu-item-25.webp" },
    ],
  },
];

async function main() {
  const existing = await prisma.menuCategory.count();
  if (existing > 0) {
    console.log(`MenuCategory table already has ${existing} rows — skipping seed.`);
    return;
  }

  for (const [categoryIndex, category] of categories.entries()) {
    const created = await prisma.menuCategory.create({
      data: { slug: category.slug, label: category.label, sortOrder: categoryIndex },
    });
    for (const [itemIndex, item] of category.items.entries()) {
      await prisma.menuItem.create({
        data: {
          categoryId: created.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image: item.image,
          featured: item.featured ?? false,
          sortOrder: itemIndex,
        },
      });
    }
  }

  console.log("Seeded menu catalog.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
