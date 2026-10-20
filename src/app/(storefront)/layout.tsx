import type { ReactNode } from "react";
import { CartProvider } from "@/components/storefront/cart-provider";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { StorefrontNav } from "@/components/shared/storefront-nav";

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="storefront-theme">
        <div className="site-shell">
          <StorefrontNav />
          <main className="site-main">{children}</main>
          <StorefrontFooter />
        </div>
      </div>
    </CartProvider>
  );
}
