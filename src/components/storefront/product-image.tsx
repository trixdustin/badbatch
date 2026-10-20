import Image from "next/image";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  index: string;
  sizes: string;
  priority?: boolean;
  className?: string;
};

export function ProductImage({
  src,
  alt,
  index,
  sizes,
  priority = false,
  className = "",
}: ProductImageProps) {
  return (
    <div
      className={`product-image ${className}`}
      role={src ? undefined : "img"}
      aria-label={src ? undefined : alt}
    >
      {src ? (
        <Image
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          src={src}
        />
      ) : (
        <div aria-hidden="true" className="image-placeholder absolute inset-0">
          <span>{index} / BAD BATCH</span>
        </div>
      )}
    </div>
  );
}
