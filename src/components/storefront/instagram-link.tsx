import { instagramUrl } from "@/lib/storefront/instagram";

export function InstagramLink({
  children = "dm to order",
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={instagramUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}
