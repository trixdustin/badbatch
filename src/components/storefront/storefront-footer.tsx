import Link from "next/link";
import { BrandLogo } from "@/components/storefront/brand-logo";
import { InstagramLink } from "@/components/storefront/instagram-link";
import { contactEmail } from "@/lib/storefront/contact";

export function StorefrontFooter() {
  return (
    <footer className="site-footer">
      <BrandLogo />
      <nav aria-label="Footer" className="footer-links">
        <Link className="footer-link" href="/menu">menu</Link>
        <InstagramLink className="footer-link">instagram ↗</InstagramLink>
        <a className="footer-link" href={`mailto:${contactEmail}`}>email</a>
        <Link aria-label="Admin sign in" className="footer-admin-mark" href="/admin/login" title="Admin sign in">
          <span aria-hidden="true">BB</span>
        </Link>
      </nav>
      <p className="footer-note">© BAD BATCH</p>
    </footer>
  );
}
