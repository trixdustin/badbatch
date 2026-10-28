import Image from "next/image";

const productImages: Record<string, { src: string; alt: string; lightSrc?: string; darkSrc?: string; cartSrc?: string }> = {
  "the-classic": {
    src: "/images/the-usual.png",
    lightSrc: "/images/the-usual-light.jpg",
    darkSrc: "/images/the-usual-dark.jpg",
    cartSrc: "/images/the-usual-cart.png",
    alt: "The Usual chocolate chip cookie",
  },
  "the-dark": {
    src: "/images/burn-notice.png",
    lightSrc: "/images/burn-notice-light.jpg",
    darkSrc: "/images/burn-notice-dark.jpg",
    cartSrc: "/images/burn-notice-cart.png",
    alt: "Burn Notice s’mores cookie",
  },
  "the-third": {
    src: "/images/white-lie.png",
    lightSrc: "/images/white-lie-light.jpg",
    darkSrc: "/images/white-lie-dark.jpg",
    cartSrc: "/images/white-lie-cart.png",
    alt: "White Lie Biscoff white chocolate cookie",
  },
  seasonal: {
    src: "/images/after-hours.png",
    lightSrc: "/images/after-hours-light.jpg",
    darkSrc: "/images/after-hours-dark.jpg",
    cartSrc: "/images/after-hours-cart.png",
    alt: "After Hours cookies and cream cookie",
  },
};

type ProductImageProps = {
  src?: string | null;
  alt: string;
  index?: string;
  slug?: string;
  sizes: string;
  priority?: boolean;
  variant?: "cart";
  className?: string;
};

export function ProductImage({
  src,
  alt,
  index = "—",
  slug,
  sizes,
  priority = false,
  variant,
  className = "",
}: ProductImageProps) {
  const product = slug ? productImages[slug] : undefined;
  const hasThemeImages = Boolean(product?.lightSrc && product.darkSrc);
  const cartImageSrc = variant === "cart" ? product?.cartSrc : undefined;
  const useThemeImage = hasThemeImages && !cartImageSrc;
  const imageSrc = cartImageSrc || (useThemeImage ? undefined : src || product?.src);
  const hasImage = useThemeImage || Boolean(imageSrc);
  const imageAlt = product?.alt ?? alt;

  return (
    <div
      className={`product-image ${className}${useThemeImage ? ` product-image-themed product-image-themed-${slug}` : ""}`}
      role={useThemeImage || !hasImage ? "img" : undefined}
      aria-label={useThemeImage || !hasImage ? imageAlt : undefined}
    >
      {useThemeImage ? null : imageSrc ? (
        <Image
          alt={imageAlt}
          className="product-image-content"
          fill
          priority={priority}
          sizes={sizes}
          src={imageSrc}
        />
      ) : (
        <div aria-hidden="true" className="image-placeholder absolute inset-0">
          <span>{index} / BAD BATCH</span>
        </div>
      )}
    </div>
  );
}
