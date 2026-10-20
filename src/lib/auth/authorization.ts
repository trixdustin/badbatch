import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export async function getAuthorizedAdmin() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true },
  });
  return user?.role === UserRole.ADMIN ? user : null;
}

export async function requireAdminPage() {
  const admin = await getAuthorizedAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
