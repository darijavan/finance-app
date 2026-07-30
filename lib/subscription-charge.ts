export function isSubscriptionCharge(transaction: { subscription_id?: number | null }): boolean {

  return transaction.subscription_id != null;
}
