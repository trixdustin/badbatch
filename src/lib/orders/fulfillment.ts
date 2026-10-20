// Fulfillment is captured only as a free-text "fulfillment details" field at
// checkout (the Order.address column). There is no explicit pickup/delivery
// field in the data model, so we must not invent one. These helpers derive an
// honest indicator from the existing data only.

export const UNCONFIRMED_FULFILLMENT = "To be confirmed with BAD BATCH";

/** True when the customer provided their own fulfillment details (an address
 *  or context) rather than leaving it for the shop to confirm. */
export function isFulfillmentProvided(address: string): boolean {
  const trimmed = address.trim();
  return trimmed.length > 0 && trimmed !== UNCONFIRMED_FULFILLMENT;
}

/** Short, scannable label for list views. */
export function fulfillmentLabel(address: string): string {
  return isFulfillmentProvided(address) ? "details provided" : "to confirm";
}
