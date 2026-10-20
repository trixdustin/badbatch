const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

/**
 * Format a number as Philippine pesos, e.g. 150 -> "₱150.00".
 * The database stores prices as plain decimal amounts which are interpreted
 * as PHP (no currency conversion is performed).
 */
export function formatPhp(amount: number): string {
  return phpFormatter.format(Number.isFinite(amount) ? amount : 0);
}
