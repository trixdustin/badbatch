import { redirect } from "next/navigation";
import { connection } from "next/server";
import { loginAction } from "@/lib/auth/actions";
import { getAuthorizedAdmin } from "@/lib/auth/authorization";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ArrowRight } from "lucide-react";

export const instant = false;

export default async function AdminLoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  await connection();
  if (await getAuthorizedAdmin()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="mb-2 text-sm uppercase tracking-widest text-neutral-500">BAD BATCH / admin</p>
      <div className="mb-5"><ThemeToggle /></div>
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">Sign in</h1>
      <form action={loginAction} className="space-y-5">
        <label className="block text-sm">
          Email
          <input
            autoComplete="username"
            className="mt-2 block w-full border border-neutral-400 bg-transparent px-3 py-2"
            name="email"
            required
            type="email"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            autoComplete="current-password"
            className="mt-2 block w-full border border-neutral-400 bg-transparent px-3 py-2"
            name="password"
            required
            type="password"
          />
        </label>
        {error ? <p className="text-sm text-red-700" role="alert">Email or password is incorrect.</p> : null}
        <button className="admin-login-submit" type="submit">
          <span>sign in to admin</span>
          <ArrowRight aria-hidden="true" className="admin-login-arrow" size={16} strokeWidth={1.7} />
        </button>
      </form>
    </main>
  );
}
