export type ProductCopy = {
  index: string;
  name: string;
  flavor: string;
  description: string;
};

const productCopy: Record<string, ProductCopy> = {
  "the-classic": {
    index: "01",
    name: "The Usual",
    flavor: "Chocolate Chip",
    description: "The one you come back for.",
  },
  "the-dark": {
    index: "02",
    name: "Burn Notice",
    flavor: "S’mores",
    description: "S’mores, in cookie form.",
  },
  "the-third": {
    index: "03",
    name: "White Lie",
    flavor: "Biscoff White Chocolate",
    description: "Biscoff with white chocolate.",
  },
  seasonal: {
    index: "04",
    name: "After Hours",
    flavor: "Cookies & Cream",
    description: "The current seasonal cookie.",
  },
};

export function getProductCopy(slug: string, fallbackIndex = "—"): ProductCopy {
  return (
    productCopy[slug] ?? {
      index: fallbackIndex,
      name: slug.replaceAll("-", " "),
      flavor: "",
      description: "",
    }
  );
}

export function getProductLabel(slug: string, fallbackIndex = "—", productName?: string) {
  const copy = getProductCopy(slug, fallbackIndex);
  return `${copy.index} / ${productName ?? copy.name}`;
}

export function sortByProductIndex<T extends { slug: string }>(products: T[]) {
  return [...products].sort((first, second) =>
    getProductCopy(first.slug).index.localeCompare(getProductCopy(second.slug).index),
  );
}
