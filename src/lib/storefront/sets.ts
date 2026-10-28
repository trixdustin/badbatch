export const COOKIE_SET_RULES = {
  usual4: { name: "The Usual, x4", price: 26000, contents: [{ slug: "the-classic", quantity: 4 }] },
  fullBatch: { name: "Full Batch", price: 30000, contents: [
    { slug: "the-classic", quantity: 1 }, { slug: "the-dark", quantity: 1 },
    { slug: "the-third", quantity: 1 }, { slug: "seasonal", quantity: 1 },
  ] },
} as const;

export const COOKIE_RETAIL_CENTS: Record<string, number> = {
  "the-classic": 7000, "the-dark": 8000, "the-third": 9000, seasonal: 8000,
};

export function doubleTroublePrice(slug: string) {
  const price = COOKIE_RETAIL_CENTS[slug];
  return price ? price * 2 - 1000 : null;
}

export function setSavings(setId: "usual4" | "fullBatch" | "doubleTrouble", slug?: string) {
  if (setId === "usual4") return 2000;
  if (setId === "fullBatch") return 2000;
  return slug ? 1000 : 0;
}

export const COOKIE_SET_NAMES: Record<string, string> = {
  usual4: "The Usual, x4",
  doubleTrouble: "Double Trouble",
  fullBatch: "Full Batch",
};

export const COOKIE_NAMES: Record<string, string> = {
  "the-classic": "The Usual / Chocolate Chip",
  "the-dark": "Burn Notice / S’mores",
  "the-third": "White Lie / Biscoff White Chocolate",
  seasonal: "After Hours / Cookies & Cream",
};

export function describeSetContents(contents: { slug: string; quantity: number }[], multiplier = 1) {
  return contents.map((part) => `${part.quantity * multiplier} × ${COOKIE_NAMES[part.slug] ?? part.slug}`).join(" · ");
}
