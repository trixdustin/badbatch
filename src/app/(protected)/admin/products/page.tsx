import { connection } from "next/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageIntro } from "@/components/shared/page-intro";
import { ProductEditor, type EditableProduct } from "@/components/admin/product-editor";
import { ProductCreateForm } from "@/components/admin/product-create-form";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export const instant = false;

export default async function AdminProductsPage() {
  await connection();
  await requireAdminPage();
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      subtitle: true,
      category: true,
      description: true,
      image: true,
      price: true,
      isSeasonal: true,
      isAvailable: true,
    },
  });

  const editableProducts: EditableProduct[] = products.map((product) => ({
    ...product,
    price: product.price.toFixed(2),
  }));

  return (
    <>
      <AdminNav />
      <PageIntro eyebrow="catalog" title="Products">
        Create, edit, and archive cookies. Changes are validated and applied by the protected{" "}
        <code>PATCH</code>, <code>POST</code>, and <code>DELETE /api/admin/products/:id</code>{" "}
        endpoints. A product can only be ordered once its price is above ₱0 and it is marked available.
      </PageIntro>
      <ProductCreateForm />
      {editableProducts.length === 0 ? (
        <p className="border-y border-neutral-300 py-8 text-sm text-neutral-600">No products yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-300">
          {editableProducts.map((product) => (
            <li className="py-6" key={product.id}>
              <ProductEditor product={product} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

