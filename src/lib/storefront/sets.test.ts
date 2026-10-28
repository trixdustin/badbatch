import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COOKIE_RETAIL_CENTS, COOKIE_SET_RULES, doubleTroublePrice, setSavings } from "./sets";
import { checkoutSchema } from "@/lib/validation/checkout";
import { posSaleSchema } from "@/lib/validation/pos";

const checkout = (items: unknown[]) => checkoutSchema.safeParse({ customerName: "Kai", email: "kai@example.com", phone: "12345", items });

describe("cookie set prices", () => {
  it("calculates each confirmed retail comparison", () => {
    assert.equal(COOKIE_SET_RULES.usual4.price, 26000);
    assert.equal(4 * COOKIE_RETAIL_CENTS["the-classic"] - COOKIE_SET_RULES.usual4.price, 2000);
    assert.deepEqual(["the-classic", "the-dark", "the-third", "seasonal"].map(doubleTroublePrice), [13000, 15000, 17000, 15000]);
    assert.equal(COOKIE_SET_RULES.fullBatch.price, 30000);
    assert.equal(Object.values(COOKIE_RETAIL_CENTS).reduce((a, b) => a + b, 0) - COOKIE_SET_RULES.fullBatch.price, 2000);
  });
  it("returns null for unknown flavors and discounts each pair", () => {
    assert.equal(doubleTroublePrice("unknown"), null);
    assert.equal(setSavings("doubleTrouble", "the-classic") * 2, 2000);
  });

  it("accepts one selected Double Trouble flavor and rejects mixed or forged contents", () => {
    assert.equal(checkout([{ setId: "doubleTrouble", flavorSlug: "the-classic", quantity: 1 }]).success, true);
    assert.equal(checkout([{ setId: "doubleTrouble", flavorSlug: "the-classic", quantity: 1, contents: [{ slug: "the-dark", quantity: 2 }] }]).success, false);
    assert.equal(checkout([{ setId: "usual4", flavorSlug: "the-classic", quantity: 1 }]).success, false);
    assert.equal(checkout([{ setId: "doubleTrouble", quantity: 1 }]).success, false);
  });

  it("caps set quantity and keeps the exact set component rules", () => {
    assert.equal(checkout([{ setId: "fullBatch", quantity: 21 }]).success, false);
    assert.deepEqual(COOKIE_SET_RULES.usual4.contents, [{ slug: "the-classic", quantity: 4 }]);
    assert.equal(COOKIE_SET_RULES.fullBatch.contents.length, 4);
  });

  it("validates POS set identity and a single Double Trouble flavor", () => {
    assert.equal(posSaleSchema.safeParse({ items: [{ setId: "doubleTrouble", flavorSlug: "the-dark", quantity: 1 }], paymentMethod: "CASH" }).success, true);
    assert.equal(posSaleSchema.safeParse({ items: [{ setId: "doubleTrouble", quantity: 1, contents: [{ slug: "the-classic", quantity: 1 }, { slug: "the-dark", quantity: 1 }] }], paymentMethod: "CASH" }).success, false);
    assert.equal(posSaleSchema.safeParse({ items: [{ setId: "fullBatch", flavorSlug: "the-dark", quantity: 1 }], paymentMethod: "CASH" }).success, false);
  });
});
