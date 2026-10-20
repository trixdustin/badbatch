import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BAD BATCH — cookies",
    template: "%s — BAD BATCH",
  },
  description: "Cookies worth coming back for. Explore the BAD BATCH menu and build your order.",
  openGraph: {
    title: "BAD BATCH — cookies",
    description: "Cookies worth coming back for. Explore the BAD BATCH menu and build your order.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
