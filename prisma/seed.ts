import { PrismaClient, Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import { z } from "zod";

const prisma = new PrismaClient();
const adminSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(12)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

async function main() {
  const admin = adminSchema.safeParse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });

  if (!admin.success) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) before seeding.");
  }

  const passwordHash = await bcrypt.hash(admin.data.password, 12);
  await prisma.user.upsert({
    where: { email: admin.data.email.toLowerCase() },
    update: { role: UserRole.ADMIN },
    create: {
      email: admin.data.email.toLowerCase(),
      passwordHash,
      name: "BAD BATCH admin",
      role: UserRole.ADMIN,
    },
  });

  const products = [
    {
      name: "The Usual",
      slug: "the-classic",
      subtitle: "Chocolate Chip",
      category: "cookie",
      description: "The one you come back for.",
      isSeasonal: false,
    },
    {
      name: "Burn Notice",
      slug: "the-dark",
      subtitle: "S’mores",
      category: "cookie",
      description: "S’mores, in cookie form.",
      isSeasonal: false,
    },
    {
      name: "White Lie",
      slug: "the-third",
      subtitle: "Biscoff White Chocolate",
      category: "cookie",
      description: "Biscoff with white chocolate.",
      isSeasonal: false,
    },
    {
      name: "After Hours",
      slug: "seasonal",
      subtitle: "Cookies & Cream",
      category: "cookie",
      description: "The current seasonal cookie.",
      isSeasonal: true,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        description: product.description,
        isSeasonal: product.isSeasonal,
      },
      create: {
        ...product,
        price: new Prisma.Decimal("0.00"),
        image: "",
        isAvailable: true,
      },
    });
  }

  const seasonalProduct = await prisma.product.findUniqueOrThrow({
    where: { slug: "seasonal" },
    select: { id: true },
  });
  await prisma.storeSettings.upsert({
    where: { id: "store" },
    update: { seasonalProductId: seasonalProduct.id },
    create: {
      id: "store",
      orderingEnabled: false,
      announcement: "",
      seasonalProductId: seasonalProduct.id,
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
