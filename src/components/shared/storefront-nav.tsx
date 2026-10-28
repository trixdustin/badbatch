"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/storefront/brand-logo";
import { InstagramLink } from "@/components/storefront/instagram-link";
import { useCart } from "@/components/storefront/cart-provider";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function StorefrontNav() {
  const { itemCount, hydrated } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="site-header">
      <BrandLogo />
      <nav aria-label="Main navigation" className="site-nav">
        <Link href="/menu">menu</Link>
        <Link href="/sets">sets</Link>
        <Link href="/reviews">reviews</Link>
        <Link href="/#story">about</Link>
        <InstagramLink className="nav-order-link">instagram</InstagramLink>
        <ThemeToggle />
        <Link
          aria-label={`Your batch${hydrated ? `, ${itemCount} items` : ""}`}
          className="nav-cart"
          href="/cart"
        >
          batch <span aria-hidden="true" className="nav-cart-count">
            {hydrated ? String(itemCount).padStart(2, "0") : "—"}
          </span>
        </Link>
      </nav>
      <div className="mobile-nav-actions flex items-center gap-3 sm:hidden">
        <Link
          aria-label={`Your batch${hydrated ? `, ${itemCount} items` : ""}`}
          className="nav-cart"
          href="/cart"
        >
          batch <span aria-hidden="true" className="nav-cart-count">{hydrated ? String(itemCount).padStart(2, "0") : "—"}</span>
        </Link>
        <button
          aria-expanded={mobileMenuOpen}
          aria-controls="storefront-mobile-menu"
          className="mobile-menu-trigger"
          onClick={() => setMobileMenuOpen((open) => !open)}
          type="button"
        >
          {mobileMenuOpen ? "close" : "menu"}
        </button>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="mobile-menu"
        hidden={!mobileMenuOpen}
        id="storefront-mobile-menu"
      >
          <Link href="/menu" onClick={closeMobileMenu}>the menu</Link>
          <Link href="/sets" onClick={closeMobileMenu}>cookie sets</Link>
          <Link href="/reviews" onClick={closeMobileMenu}>customer reviews</Link>
          <Link href="/#story" onClick={closeMobileMenu}>about BAD BATCH</Link>
          <InstagramLink className="footer-link">Instagram</InstagramLink>
          <ThemeToggle />
      </nav>
    </header>
  );
}
