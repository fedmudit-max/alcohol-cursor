#!/usr/bin/env node
/**
 * RevenueCat CustomerInfo apply rules — verification, malformed payloads, products.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { makeCustomerInfo, makeRealisticCustomerInfo } from './fixtures/customer-info.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function runScript(relativePath, context) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context, {
    filename: relativePath,
  });
}

function setupContext() {
  const store = {};
  const ctx = vm.createContext({
    CONFIG: {
      showTestUI: false,
      isProduction: true,
      premiumBilling: 'store',
      revenueCatAndroidApiKey: 'goog_fake',
      revenueCatEntitlementId: 'premium',
      enforceTrialEntitlement: true,
    },
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
    console,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    document: { getElementById: () => null, body: { classList: { add: () => {}, remove: () => {} } } },
    RevenueCatBilling: { isAvailable: () => true },
    Tracker: { data: null },
    UI: { renderAll: () => {} },
  });
  runScript('src/config/app.config.js', ctx);
  vm.runInContext(`
    CONFIG.premiumBilling = 'store';
    CONFIG.revenueCatAndroidApiKey = 'goog_fake_entitlement_test';
  `, ctx);
  runScript('src/utils/dates.js', ctx);
  runScript('src/utils/helpers.js', ctx);
  runScript('src/premium/premium.js', ctx);
  return ctx;
}

let failed = 0;

function ok(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(` FAIL ${name}:`, e.message);
  }
}

console.log('\nRevenueCat entitlement apply\n');

ok('VERIFIED active grants premium', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({ verification: 'VERIFIED' }));
  if (!ctx.isPremiumActive()) throw new Error('expected active');
});

ok('VERIFIED_ON_DEVICE active grants premium', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({ verification: 'VERIFIED_ON_DEVICE' }));
  if (!ctx.isPremiumActive()) throw new Error('expected active');
});

ok('NOT_REQUESTED active does not grant', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({ verification: 'NOT_REQUESTED' }));
  if (ctx.isPremiumActive()) throw new Error('must not grant');
});

ok('NOT_REQUESTED on later sync keeps existing verified premium', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    requestDate: '2026-06-01T12:00:00.000Z',
    verification: 'VERIFIED',
  }));
  if (!ctx.isPremiumActive()) throw new Error('seed premium');
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    requestDate: '2026-06-02T12:00:00.000Z',
    verification: 'NOT_REQUESTED',
  }));
  if (!ctx.isPremiumActive()) throw new Error('transient verification must not revoke');
});

ok('missing verification does not grant', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  const ci = makeCustomerInfo();
  delete ci.entitlements.verification;
  ctx.applyRevenueCatCustomerInfo(ci);
  if (ctx.isPremiumActive()) throw new Error('must not grant');
});

ok('unknown verification does not grant', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({ verification: 'TAMPERED' }));
  if (ctx.isPremiumActive()) throw new Error('must not grant');
});

ok('FAILED denies even with active entitlement', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({ verification: 'FAILED' }));
  if (ctx.isPremiumActive()) throw new Error('FAILED must deny');
});

ok('verified inactive revokes premium', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    requestDate: '2026-06-01T12:00:00.000Z',
    verification: 'VERIFIED',
  }));
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    active: false,
    requestDate: '2026-06-02T12:00:00.000Z',
    verification: 'VERIFIED',
  }));
  if (ctx.isPremiumActive()) throw new Error('should revoke');
});

ok('NOT_REQUESTED inactive does not revoke existing premium', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    requestDate: '2026-06-02T12:00:00.000Z',
    verification: 'VERIFIED',
  }));
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    active: false,
    requestDate: '2026-06-03T12:00:00.000Z',
    verification: 'NOT_REQUESTED',
  }));
  if (!ctx.isPremiumActive()) throw new Error('must keep premium');
});

ok('missing requestDate does not grant or revoke', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  const ci = makeCustomerInfo({ verification: 'VERIFIED' });
  delete ci.requestDate;
  ctx.applyRevenueCatCustomerInfo(ci);
  if (ctx.isPremiumActive()) throw new Error('undated must not grant');
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    requestDate: '2026-06-01T12:00:00.000Z',
    verification: 'VERIFIED',
  }));
  const stale = makeCustomerInfo({ active: false, verification: 'VERIFIED' });
  delete stale.requestDate;
  ctx.applyRevenueCatCustomerInfo(stale);
  if (!ctx.isPremiumActive()) throw new Error('undated must not revoke');
});

ok('malformed active map does not revoke', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    requestDate: '2026-06-01T12:00:00.000Z',
    verification: 'VERIFIED',
  }));
  ctx.applyRevenueCatCustomerInfo({
    requestDate: '2026-06-02T12:00:00.000Z',
    entitlements: { verification: 'VERIFIED', active: null },
  });
  if (!ctx.isPremiumActive()) throw new Error('malformed must not revoke');
});

ok('unknown product id still grants verified premium entitlement', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    verification: 'VERIFIED',
    productId: 'wrong_monthly_sku',
  }));
  if (!ctx.isPremiumActive()) throw new Error('RC premium entitlement must grant access');
});

ok('unrecognized product id grants access without inferring plan from name', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    verification: 'VERIFIED',
    productId: 'someone_elses_annual_plan',
  }));
  if (!ctx.isPremiumActive()) throw new Error('expected access');
});

ok('legacy separate Play product id grants when RC marks premium active', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    verification: 'VERIFIED',
    productId: 'ten_drinks_premium_yearly',
  }));
  if (!ctx.isPremiumActive()) throw new Error('legacy sku on active entitlement must grant');
});

ok('Play subscription id + base plan monthly grants premium', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    verification: 'VERIFIED',
    productId: 'ten_drinks_premium',
    productPlanId: 'monthly',
  }));
  if (!ctx.isPremiumActive()) throw new Error('expected active');
});

ok('Play subscription id + base plan yearly grants premium', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    verification: 'VERIFIED',
    productId: 'ten_drinks_premium',
    productPlanId: 'yearly',
  }));
  if (!ctx.isPremiumActive()) throw new Error('expected active');
});

ok('subscription id alone without base plan still grants active premium', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    verification: 'VERIFIED',
    productId: 'ten_drinks_premium',
  }));
  if (!ctx.isPremiumActive()) throw new Error('active premium entitlement must grant');
});

ok('migration sku — other subscription id with base plan grants access', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    verification: 'VERIFIED',
    productId: 'other_subscription',
    productPlanId: 'yearly',
  }));
  if (!ctx.isPremiumActive()) throw new Error('verified premium must grant');
});

ok('unknown base plan id still grants verified premium entitlement', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
    verification: 'VERIFIED',
    productId: 'ten_drinks_premium',
    productPlanId: 'weekly',
  }));
  if (!ctx.isPremiumActive()) throw new Error('unknown base plan must not block access');
});

ok('realistic SDK CustomerInfo (split Play ids) grants premium', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  ctx.applyRevenueCatCustomerInfo(makeRealisticCustomerInfo({
    verification: 'VERIFIED',
    productId: 'ten_drinks_premium',
    productPlanId: 'yearly',
  }));
  if (!ctx.isPremiumActive()) throw new Error('expected active');
});

ok('cancelled sub (willRenew false) stays premium until expirationDate', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  const future = new Date(Date.now() + 14 * 86400000).toISOString();
  ctx.applyRevenueCatCustomerInfo(makeRealisticCustomerInfo({
    verification: 'VERIFIED',
    productId: 'ten_drinks_premium',
    productPlanId: 'monthly',
    willRenew: false,
    expirationDate: future,
  }));
  if (!ctx.isPremiumActive()) throw new Error('cancelled but in paid period must stay premium');
});

ok('cached entitlement — access until expiration instant without new sync', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  ctx.applyRevenueCatCustomerInfo(makeRealisticCustomerInfo({
    verification: 'VERIFIED',
    expirationDate: future,
  }));
  if (!ctx.isPremiumActive()) throw new Error('future expiration must grant offline-style access');
});

ok('cached entitlement — no local grace after expirationDate passes', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  const past = new Date(Date.now() - 1000).toISOString();
  ctx.applyRevenueCatCustomerInfo(makeRealisticCustomerInfo({
    verification: 'VERIFIED',
    expirationDate: past,
  }));
  if (ctx.isPremiumActive()) throw new Error('expired cache must not grant');
});

ok('cancelled sub loses premium after expirationDate passes', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  const past = new Date(Date.now() - 86400000).toISOString();
  ctx.applyRevenueCatCustomerInfo(makeRealisticCustomerInfo({
    verification: 'VERIFIED',
    productId: 'ten_drinks_premium',
    productPlanId: 'yearly',
    willRenew: false,
    expirationDate: past,
  }));
  if (ctx.isPremiumActive()) throw new Error('expired period must not grant access');
});

ok('willRenew false does not revoke before verified inactive snapshot', () => {
  const ctx = setupContext();
  ctx.clearPremiumRecord();
  const future = new Date(Date.now() + 20 * 86400000).toISOString();
  ctx.applyRevenueCatCustomerInfo(makeRealisticCustomerInfo({
    requestDate: '2026-06-01T12:00:00.000Z',
    verification: 'VERIFIED',
    productId: 'ten_drinks_premium',
    productPlanId: 'yearly',
    willRenew: true,
    expirationDate: future,
  }));
  ctx.applyRevenueCatCustomerInfo(makeRealisticCustomerInfo({
    requestDate: '2026-06-02T12:00:00.000Z',
    verification: 'VERIFIED',
    productId: 'ten_drinks_premium',
    productPlanId: 'yearly',
    willRenew: false,
    expirationDate: future,
  }));
  if (!ctx.isPremiumActive()) throw new Error('auto-renew off must not revoke early');
});

console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll RevenueCat entitlement checks passed.\n');
process.exit(failed ? 1 : 0);
