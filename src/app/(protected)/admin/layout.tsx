import type { ReactNode } from "react";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireAdminPage } from "@/lib/auth/authorization";

export const instant = false;

export default function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-6 py-8">Loading admin...</p>}>
      <AuthorizedAdminLayout>{children}</AuthorizedAdminLayout>
    </Suspense>
  );
}

async function AuthorizedAdminLayout({ children }: { children: ReactNode }) {
  await connection();
  await requireAdminPage();
  return <div className="mx-auto min-h-screen w-full max-w-6xl px-6">{children}</div>;
}
