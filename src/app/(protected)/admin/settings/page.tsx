import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageIntro } from "@/components/shared/page-intro";
import {
  StoreSettingsControl,
  type EditableSettings,
  type SeasonalOption,
} from "@/components/admin/store-settings-control";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export default function AdminSettingsPage() {
  return (
    <>
      <AdminNav />
      <PageIntro eyebrow="store controls" title="Settings">
        Update store settings below. Changes are validated and applied by the protected, server-validated{" "}
        <code>PATCH /api/admin/settings</code> endpoint.
      </PageIntro>
      <Suspense fallback={<SettingsLoading />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  await requireAdminPage();
  const [settings, seasonalRecords] = await Promise.all([
    prisma.storeSettings.findUnique({
      where: { id: "store" },
      select: {
        orderingEnabled: true,
        announcement: true,
        seasonalProductId: true,
        updatedAt: true,
      },
    }),
    prisma.product.findMany({
      where: { isSeasonal: true, isAvailable: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const editableSettings: EditableSettings = {
    orderingEnabled: settings?.orderingEnabled ?? false,
    announcement: settings?.announcement ?? "",
    seasonalProductId: settings?.seasonalProductId ?? null,
  };
  const seasonalProducts: SeasonalOption[] = seasonalRecords.map((product) => ({
    id: product.id,
    name: product.name,
  }));

  return (
    <StoreSettingsControl seasonalProducts={seasonalProducts} settings={editableSettings} />
  );
}

function SettingsLoading() {
  return (
    <section aria-live="polite" className="py-8">
      <p className="text-sm text-neutral-600">Loading store settings…</p>
    </section>
  );
}

