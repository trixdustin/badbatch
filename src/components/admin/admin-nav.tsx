import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function AdminNav() {
  return (
    <nav className="admin-navigation mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-300 py-5">
      <div className="flex flex-wrap items-center gap-5 text-sm">
        <Link className="font-semibold" href="/admin">dashboard</Link>
        <Link href="/admin/orders">orders</Link>
        <Link href="/admin/reviews">reviews</Link>
        <Link href="/admin/pos">POS</Link>
        <Link href="/admin/inventory">inventory</Link>
        <Link href="/admin/costing">costing</Link>
        <Link href="/admin/products">products</Link>
        <Link href="/admin/settings">settings</Link>
        <Link aria-label="View public storefront in a new tab" className="underline underline-offset-4" href="/" rel="noreferrer" target="_blank">View Storefront ↗</Link>
      </div>
      <ThemeToggle />
      <form action={logoutAction}>
        <button className="admin-signout-button" type="submit">sign out</button>
      </form>
    </nav>
  );
}
