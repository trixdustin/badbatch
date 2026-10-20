"use server";

import bcrypt from "bcrypt";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { adminLoginSchema } from "@/lib/validation/admin";
import { createSession, destroySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function loginAction(formData: FormData) {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/admin/login?error=invalid");

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, passwordHash: true, role: true },
  });
  if (!user || user.role !== UserRole.ADMIN) redirect("/admin/login?error=invalid");
  if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    redirect("/admin/login?error=invalid");
  }

  await createSession(user.id, user.email);
  redirect("/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}
