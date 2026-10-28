"use client";

import { useEffect, useState, type FocusEvent } from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { ProductImage } from "@/components/storefront/product-image";
import { SectionLabel } from "@/components/storefront/section-label";
import type { StorefrontProduct } from "@/components/storefront/product-item";
import { getProductCopy, getProductLabel } from "@/lib/storefront/product-copy";
import { formatPhp } from "@/lib/format/currency";

export function FeaturedCookieSlideshow({ products }: { products: StorefrontProduct[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const currentIndex = products.length ? activeIndex % products.length : 0;
  const product = products[currentIndex];

  useEffect(() => {
    if (
      products.length < 2 ||
      isPaused ||
      isHovered ||
      isFocused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % products.length);
    }, 6500);

    return () => window.clearInterval(interval);
  }, [activeIndex, isFocused, isHovered, isPaused, products.length]);

  if (!product) return null;

  const copy = getProductCopy(product.slug);
  const productLabel = getProductLabel(product.slug, undefined, product.name);

  function changeSlide(direction: -1 | 1) {
    setActiveIndex((index) => (index + direction + products.length) % products.length);
  }

  function resumeAfterFocus(event: FocusEvent<HTMLElement>) {
    const nextFocusedElement = event.relatedTarget;
    if (
      !(nextFocusedElement instanceof Node) ||
      !event.currentTarget.contains(nextFocusedElement)
    ) {
      setIsFocused(false);
    }
  }

  return (
    <section
      aria-label="Featured cookies"
      aria-roledescription="carousel"
      className="featured-carousel section-rule grid gap-8 py-16 sm:py-20 md:grid-cols-[1.15fr_0.85fr] md:items-center md:gap-14"
      onBlurCapture={resumeAfterFocus}
      onFocusCapture={() => setIsFocused(true)}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <div>
        <div
          aria-label={`${productLabel} cookie`}
          aria-roledescription="slide"
          className="featured-carousel-photo"
          key={product.id}
          role="group"
        >
          <ProductImage
            alt={`${copy.name} cookie`}
            className="aspect-[4/3] w-full max-w-[480px]"
            index={copy.index}
            slug={product.slug}
            sizes="(max-width: 768px) min(100vw, 480px), 38vw"
            src={product.image || null}
          />
        </div>

        {products.length > 1 ? (
          <div aria-label="Slideshow controls" className="featured-carousel-controls">
            <div className="flex items-center gap-2">
              <button
                aria-label="Previous cookie"
                className="featured-carousel-arrow"
                onClick={() => changeSlide(-1)}
                type="button"
              >
                <span aria-hidden="true">←</span>
              </button>
              <button
                aria-label="Next cookie"
                className="featured-carousel-arrow"
                onClick={() => changeSlide(1)}
                type="button"
              >
                <span aria-hidden="true">→</span>
              </button>
              <span aria-hidden="true" className="featured-carousel-count">
                {String(currentIndex + 1).padStart(2, "0")} / {String(products.length).padStart(2, "0")}
              </span>
            </div>

            <div aria-label="Choose a cookie" className="flex items-center gap-2" role="group">
              {products.map((item, index) => (
                <button
                  aria-current={index === currentIndex ? "true" : undefined}
                  aria-label={`Show ${item.name}`}
                  className="featured-carousel-dot"
                  key={item.id}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                />
              ))}
            </div>

            <button
              aria-label={isPaused ? "Play slideshow" : "Pause slideshow"}
              className="featured-carousel-play"
              onClick={() => {
                setIsPaused((paused) => !paused);
                setIsFocused(false);
              }}
              type="button"
            >
              {isPaused ? <Play aria-hidden="true" size={15} /> : <Pause aria-hidden="true" size={15} />}
            </button>
          </div>
        ) : null}
      </div>

      <div className="max-w-md">
        <SectionLabel index="02">in focus</SectionLabel>
        <p className="micro-label mt-10">{product.category}</p>
        <p className="mt-2 text-xs text-[var(--cream-muted)]">
          {product.isSeasonal ? "limited batch" : "permanent batch"}
        </p>
        <h2 className="mt-4 text-4xl font-medium tracking-[-0.05em]" id="featured-cookie-title">
          {productLabel}
        </h2>
        {product.subtitle ? <p className="mt-5 text-sm leading-6 text-[var(--cream-muted)]">{product.subtitle}</p> : null}
        {product.description ? <p className="mt-2 text-sm leading-6 text-[var(--cream-muted)]">{product.description}</p> : null}
        <p className="micro-label mt-7">
          {product.price === "0.00" ? "price being confirmed" : formatPhp(Number(product.price))}
        </p>
        <Link className="editorial-link mt-7" href={`/cookies/${product.slug}`}>
          more about this one <span aria-hidden="true" className="ml-6">↗</span>
        </Link>
      </div>
    </section>
  );
}
