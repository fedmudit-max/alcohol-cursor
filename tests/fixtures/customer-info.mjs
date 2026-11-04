/** Deterministic RevenueCat CustomerInfo fixtures (SDK-shaped) for VM tests. */

function defaultFutureExpiration(opts) {
  if (opts.expirationDate !== undefined) return opts.expirationDate;
  return new Date(Date.now() + 30 * 86400000).toISOString();
}

/**
 * PurchasesEntitlementInfo-shaped object for Android Play subscription + base plan.
 * @see @revenuecat/purchases-capacitor PurchasesEntitlementInfo
 */
export function makeAndroidPremiumEntitlement(opts = {}) {
  const expirationDate = defaultFutureExpiration(opts);
  const nowIso = opts.now ?? new Date().toISOString();
  const nowMs = opts.nowMs ?? Date.now();
  const productIdentifier = opts.productId ?? 'ten_drinks_premium:yearly';

  let productPlanIdentifier = opts.productPlanId ?? null;
  if (productPlanIdentifier == null && productIdentifier.includes(':')) {
    const idx = productIdentifier.indexOf(':');
    productPlanIdentifier = productIdentifier.slice(idx + 1);
  }
  if (productIdentifier === 'ten_drinks_premium' && opts.productPlanId) {
    productPlanIdentifier = opts.productPlanId;
  }

  const willRenew = opts.willRenew !== undefined ? opts.willRenew : true;
  let unsubscribeDetectedAt = opts.unsubscribeDetectedAt ?? null;
  if (willRenew === false && !unsubscribeDetectedAt) {
    unsubscribeDetectedAt = new Date(nowMs - 86400000).toISOString();
  }

  const ent = {
    identifier: 'premium',
    isActive: opts.isActive !== false,
    willRenew,
    periodType: opts.periodType ?? 'NORMAL',
    latestPurchaseDate: opts.latestPurchaseDate ?? nowIso,
    latestPurchaseDateMillis: opts.latestPurchaseDateMillis ?? nowMs,
    originalPurchaseDate: opts.originalPurchaseDate ?? nowIso,
    originalPurchaseDateMillis: opts.originalPurchaseDateMillis ?? nowMs,
    expirationDate,
    expirationDateMillis: opts.expirationDateMillis ?? new Date(expirationDate).getTime(),
    store: opts.store ?? 'PLAY_STORE',
    productIdentifier,
    productPlanIdentifier,
    isSandbox: opts.isSandbox !== undefined ? opts.isSandbox : true,
    unsubscribeDetectedAt,
    unsubscribeDetectedAtMillis: unsubscribeDetectedAt
      ? (opts.unsubscribeDetectedAtMillis ?? new Date(unsubscribeDetectedAt).getTime())
      : null,
    billingIssueDetectedAt: opts.billingIssueDetectedAt ?? null,
    billingIssueDetectedAtMillis: opts.billingIssueDetectedAtMillis ?? null,
  };
  return ent;
}

/** CustomerInfo-shaped payload with entitlements.all + top-level subscription metadata. */
export function makeRealisticCustomerInfo(opts = {}) {
  const inactive = opts.active === false;
  const requestDate = opts.requestDate ?? new Date().toISOString();
  const expirationDate = defaultFutureExpiration(opts);
  const premiumEnt = makeAndroidPremiumEntitlement({
    ...opts,
    expirationDate,
    isActive: !inactive && opts.isActive !== false,
  });

  const active = inactive ? {} : { premium: premiumEnt };
  const allPremium = inactive ? { ...premiumEnt, isActive: false } : premiumEnt;

  const compositeSku = premiumEnt.productPlanIdentifier
    && premiumEnt.productIdentifier === 'ten_drinks_premium'
    ? `${premiumEnt.productIdentifier}:${premiumEnt.productPlanIdentifier}`
    : premiumEnt.productIdentifier;

  return {
    entitlements: {
      all: { premium: allPremium },
      active,
      verification: opts.verification ?? 'VERIFIED',
    },
    activeSubscriptions: inactive ? [] : [premiumEnt.productIdentifier],
    allPurchasedProductIdentifiers: [compositeSku],
    latestExpirationDate: inactive ? null : expirationDate,
    firstSeen: opts.firstSeen ?? '2026-01-01T00:00:00.000Z',
    originalAppUserId: opts.originalAppUserId ?? '$RCAnonymousID:test-user-001',
    requestDate,
    allExpirationDates: inactive ? {} : { [compositeSku]: expirationDate },
    allPurchaseDates: inactive ? {} : { [compositeSku]: premiumEnt.originalPurchaseDate },
    originalApplicationVersion: null,
    originalPurchaseDate: premiumEnt.originalPurchaseDate,
    managementURL: inactive ? null : 'https://play.google.com/store/account/subscriptions',
    nonSubscriptionTransactions: [],
    subscriptionsByProductIdentifier: inactive
      ? {}
      : {
        [premiumEnt.productIdentifier]: {
          productIdentifier: premiumEnt.productIdentifier,
          expiresDate: expirationDate,
          isActive: premiumEnt.isActive,
          willRenew: premiumEnt.willRenew,
        },
      },
  };
}

/** Default test CustomerInfo (full SDK-shaped object). */
export function makeCustomerInfo(opts = {}) {
  return makeRealisticCustomerInfo(opts);
}

export function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}
