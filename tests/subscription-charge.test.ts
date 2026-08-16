import { assert, test } from "vitest";
import { isSubscriptionCharge } from "../lib/subscription-charge.ts";

test("subscription-linked transactions are special charges", () => {
  assert.strictEqual(isSubscriptionCharge({ subscription_id: 7 }), true);
  assert.strictEqual(isSubscriptionCharge({ subscription_id: null }), false);
});