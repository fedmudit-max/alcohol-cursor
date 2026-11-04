#!/usr/bin/env node
/**
 * RevenueCat integration (mocked) — purchase, restore, bootstrap, import resync.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { makeCustomerInfo, makeRealisticCustomerInfo, flushPromises } from './fixtures/customer-info.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function runScript(relativePath, context) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context, {
    filename: relativePath,
  });
}

function setupPremiumContext() {
  const store = {};
  const ctx = vm.createContext({
    CONFIG: {
      showTestUI: false,
      isProduction: true,
      premiumBilling: 'store',
      revenueCatAndroidApiKey: 'goog_fake_integration_test',
      revenueCatEntitlementId: 'premium',
      enforceTrialEntitlement: true,
      showPremiumInApp: true,
      showPremiumSubscribe: true,
    },
    Capacitor: {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    },
    console,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      body: { classList: { add: () => {}, remove: () => {} } },
    },
    window: {},
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    UI: { renderAll: () => {} },
    Tracker: { data: { attempt: 1 }, closePremium: () => {} },
  });

  runScript('src/config/app.config.js', ctx);
  vm.runInContext(`
    CONFIG.premiumBilling = 'store';
    CONFIG.revenueCatAndroidApiKey = 'goog_fake_integration_test';
    CONFIG.showPremiumInApp = true;
    CONFIG.showPremiumSubscribe = true;
  `, ctx);
  runScript('src/utils/dates.js', ctx);
  runScript('src/utils/helpers.js', ctx);
  runScript('src/premium/premium.js', ctx);
  vm.runInContext(`
    showToast = function(msg) { __lastToast = String(msg || ''); };
    renderPremiumEntry = function() {};
    __lastToast = '';
  `, ctx);

  return { ctx, store, toast: () => ctx.__lastToast || '', clearToast: () => { ctx.__lastToast = ''; } };
}

function installMockRC(ctx, handlers = {}) {
  const billing = {
    isAvailable: () => (typeof handlers.isAvailable === 'function' ? handlers.isAvailable() : true),
    isCatalogReady: () => (handlers.catalogReady !== undefined ? handlers.catalogReady : true),
    hasPlan: (planId) => (typeof handlers.hasPlan === 'function' ? handlers.hasPlan(planId) : true),
    loadOfferings: () => {
      billing._loadCalls = (billing._loadCalls || 0) + 1;
      if (handlers.loadOfferings) return handlers.loadOfferings();
      return Promise.resolve({ current: { identifier: 'default' } });
    },
    syncEntitlement: () => {
      billing._syncCalls = (billing._syncCalls || 0) + 1;
      if (handlers.syncEntitlement) return handlers.syncEntitlement();
      return Promise.resolve(makeCustomerInfo());
    },
    purchasePlan: (planId) => {
      billing._purchaseCalls = (billing._purchaseCalls || 0) + 1;
      if (handlers.purchasePlan) return handlers.purchasePlan(planId);
      return Promise.reject(new Error('purchase not mocked'));
    },
    restorePurchases: () => {
      billing._restoreCalls = (billing._restoreCalls || 0) + 1;
      if (handlers.restorePurchases) return handlers.restorePurchases();
      return Promise.resolve(makeCustomerInfo({ active: false }));
    },
    getPlanQuotes: () => null,
  };
  ctx.RevenueCatBilling = billing;
  ctx.window.RevenueCatBilling = billing;
  return billing;
}

/** Foreground resume path — mirrors src/capacitor/native-entry.js appStateChange sync. */
function simulateAppResumeForeground(ctx) {
  const d = ctx.Tracker && ctx.Tracker.data ? ctx.Tracker.data : null;
  return ctx.RevenueCatBilling.syncEntitlement()
    .then((info) => {
      ctx.applyRevenueCatCustomerInfo(info);
      if (typeof ctx.refreshEntitlementIfChanged === 'function') {
        ctx.refreshEntitlementIfChanged(d);
      }
    })
    .catch(() => {
      if (typeof ctx.refreshEntitlementIfChanged === 'function') {
        ctx.refreshEntitlementIfChanged(d);
      }
    });
}

let failed = 0;

async function ok(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(` FAIL ${name}:`, e.message);
  }
}

async function run() {
  console.log('\nRevenueCat integration (mocked)\n');

  await ok('bootstrap — sync success applies premium', async () => {
    const { ctx } = setupPremiumContext();
    installMockRC(ctx, {
      syncEntitlement: () => Promise.resolve(makeCustomerInfo()),
    });
    ctx.bootstrapStoreEntitlement();
    await flushPromises();
    if (!ctx.isPremiumActive()) throw new Error('premium should be active after bootstrap');
  });

  await ok('bootstrap — sync failure keeps existing premium', async () => {
    const { ctx } = setupPremiumContext();
    installMockRC(ctx, {
      syncEntitlement: () => Promise.reject(new Error('offline')),
    });
    ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({ requestDate: '2026-01-01T00:00:00.000Z' }));
    if (!ctx.isPremiumActive()) throw new Error('pre-seeded premium required');
    ctx.bootstrapStoreEntitlement();
    await flushPromises();
    if (!ctx.isPremiumActive()) throw new Error('sync fail must not clear premium');
  });

  await ok('resume — sync error keeps existing premium', async () => {
    const { ctx } = setupPremiumContext();
    installMockRC(ctx, {
      syncEntitlement: () => Promise.reject(new Error('temporary RC outage')),
    });
    ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({ requestDate: '2026-06-01T12:00:00.000Z' }));
    if (!ctx.isPremiumActive()) throw new Error('pre-seeded premium required');
    await simulateAppResumeForeground(ctx);
    await flushPromises();
    if (!ctx.isPremiumActive()) throw new Error('resume sync error must not revoke premium');
  });

  await ok('resume — malformed CustomerInfo does not revoke premium', async () => {
    const { ctx } = setupPremiumContext();
    installMockRC(ctx, {
      syncEntitlement: () => Promise.resolve({
        requestDate: '2026-06-02T12:00:00.000Z',
        entitlements: { verification: 'VERIFIED' },
      }),
    });
    ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({ requestDate: '2026-06-01T12:00:00.000Z' }));
    if (!ctx.isPremiumActive()) throw new Error('pre-seeded premium required');
    await simulateAppResumeForeground(ctx);
    await flushPromises();
    if (!ctx.isPremiumActive()) throw new Error('malformed resume payload must not revoke');
  });

  await ok('resume — null CustomerInfo does not crash or revoke', async () => {
    const { ctx } = setupPremiumContext();
    installMockRC(ctx, {
      syncEntitlement: () => Promise.resolve(null),
    });
    ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({ requestDate: '2026-06-01T12:00:00.000Z' }));
    if (!ctx.isPremiumActive()) throw new Error('pre-seeded premium required');
    await simulateAppResumeForeground(ctx);
    await flushPromises();
    if (!ctx.isPremiumActive()) throw new Error('null resume payload must not revoke');
  });

  await ok('resume — transient error then successful sync keeps premium', async () => {
    const { ctx } = setupPremiumContext();
    let syncCalls = 0;
    const renewedExp = new Date(Date.now() + 60 * 86400000).toISOString();
    installMockRC(ctx, {
      syncEntitlement: () => {
        syncCalls += 1;
        if (syncCalls === 1) return Promise.reject(new Error('503'));
        return Promise.resolve(makeRealisticCustomerInfo({
          requestDate: '2026-06-05T12:00:00.000Z',
          expirationDate: renewedExp,
          productId: 'ten_drinks_premium',
          productPlanId: 'yearly',
        }));
      },
    });
    ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
      requestDate: '2026-06-01T12:00:00.000Z',
      productId: 'ten_drinks_premium',
      productPlanId: 'monthly',
    }));
    if (!ctx.isPremiumActive()) throw new Error('pre-seeded premium required');
    await simulateAppResumeForeground(ctx);
    await flushPromises();
    if (!ctx.isPremiumActive()) throw new Error('premium must survive first resume error');
    await simulateAppResumeForeground(ctx);
    await flushPromises();
    if (!ctx.isPremiumActive()) throw new Error('premium must stay active after successful resume sync');
    if (syncCalls < 2) throw new Error('expected two resume sync attempts');
    ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
      active: false,
      requestDate: '2026-06-06T12:00:00.000Z',
    }));
    if (ctx.isPremiumActive()) throw new Error('newer verified inactive must revoke after successful sync');
  });

  await ok('subscribe — success applies premium and toasts thank you', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    installMockRC(ctx, {
      purchasePlan: () => Promise.resolve(makeCustomerInfo()),
    });
    clearToast();
    ctx.Tracker.subscribePremium();
    await flushPromises();
    if (!ctx.isPremiumActive()) throw new Error('purchase should activate premium');
    if (!/thank you/i.test(toast())) throw new Error(`expected thank you toast, got: ${toast()}`);
  });

  await ok('subscribe — cancel code 1 silent', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    installMockRC(ctx, {
      purchasePlan: () => Promise.reject({ code: '1', message: 'cancelled' }),
    });
    clearToast();
    ctx.Tracker.subscribePremium();
    await flushPromises();
    if (ctx.isPremiumActive()) throw new Error('cancel must not grant premium');
    if (/did not complete/i.test(toast())) throw new Error('cancel should not show failure toast');
  });

  await ok('subscribe — pending code 20', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    installMockRC(ctx, {
      purchasePlan: () => Promise.reject({ code: '20', message: 'pending' }),
    });
    clearToast();
    ctx.Tracker.subscribePremium();
    await flushPromises();
    if (!/pending/i.test(toast())) throw new Error(`expected pending toast, got: ${toast()}`);
  });

  await ok('subscribe — store error shows retry toast', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    installMockRC(ctx, {
      purchasePlan: () => Promise.reject({ code: '10', message: 'network' }),
    });
    clearToast();
    ctx.Tracker.subscribePremium();
    await flushPromises();
    if (!/did not complete/i.test(toast())) throw new Error(`expected failure toast, got: ${toast()}`);
  });

  await ok('restore — active subscription', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    installMockRC(ctx, {
      restorePurchases: () => Promise.resolve(makeCustomerInfo()),
    });
    clearToast();
    ctx.Tracker.restorePremium();
    await flushPromises();
    if (!ctx.isPremiumActive()) throw new Error('restore should activate premium');
    if (!/restored/i.test(toast())) throw new Error(`expected restored toast, got: ${toast()}`);
  });

  await ok('restore — no active subscription', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    installMockRC(ctx, {
      restorePurchases: () => Promise.resolve(makeCustomerInfo({ active: false })),
    });
    clearToast();
    ctx.Tracker.restorePremium();
    await flushPromises();
    if (ctx.isPremiumActive()) throw new Error('empty restore must not grant premium');
    if (!/no active subscription/i.test(toast())) throw new Error(`expected no sub toast, got: ${toast()}`);
  });

  await ok('restore — failure toast', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    installMockRC(ctx, {
      restorePurchases: () => Promise.reject(new Error('play down')),
    });
    clearToast();
    ctx.Tracker.restorePremium();
    await flushPromises();
    if (!/could not restore/i.test(toast())) throw new Error(`expected restore fail toast, got: ${toast()}`);
  });

  await ok('entitlement sequence — renewal then revocation via requestDate', async () => {
    const { ctx } = setupPremiumContext();
    ctx.clearPremiumRecord();
    ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
      requestDate: '2026-06-01T12:00:00.000Z',
    }));
    if (!ctx.isPremiumActive()) throw new Error('initial active');
    ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
      requestDate: '2026-06-02T12:00:00.000Z',
      expirationDate: new Date(Date.now() + 86400000 * 60).toISOString(),
    }));
    if (!ctx.isPremiumActive()) throw new Error('renewal should stay active');
    ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({
      active: false,
      requestDate: '2026-06-03T12:00:00.000Z',
    }));
    if (ctx.isPremiumActive()) throw new Error('revocation should remove premium');
  });

  await ok('clearPremiumMirrorAndResyncStore — premium returns from mock sync', async () => {
    const { ctx, store } = setupPremiumContext();
    const PREMIUM_KEY = 'sj_premium';
    installMockRC(ctx, {
      syncEntitlement: () => Promise.resolve(makeCustomerInfo()),
    });
    store[PREMIUM_KEY] = JSON.stringify({ active: true, source: 'revenuecat' });
    ctx.clearPremiumMirrorAndResyncStore();
    await flushPromises();
    if (!ctx.isPremiumActive()) throw new Error('resync should restore premium from RC');
    if (store[PREMIUM_KEY]) throw new Error('local premium mirror should stay cleared');
  });

  await ok('subscribe — duplicate tap only one purchase', async () => {
    const { ctx } = setupPremiumContext();
    let purchases = 0;
    installMockRC(ctx, {
      purchasePlan: () => {
        purchases += 1;
        return new Promise((resolve) => {
          setTimeout(() => resolve(makeCustomerInfo()), 0);
        });
      },
    });
    ctx.Tracker.subscribePremium();
    ctx.Tracker.subscribePremium();
    await flushPromises();
    await new Promise((r) => setTimeout(r, 5));
    if (purchases !== 1) throw new Error(`expected 1 purchase, got ${purchases}`);
  });

  await ok('restore — duplicate tap only one restore', async () => {
    const { ctx } = setupPremiumContext();
    let restores = 0;
    installMockRC(ctx, {
      restorePurchases: () => {
        restores += 1;
        return Promise.resolve(makeCustomerInfo());
      },
    });
    ctx.Tracker.restorePremium();
    ctx.Tracker.restorePremium();
    await flushPromises();
    if (restores !== 1) throw new Error(`expected 1 restore, got ${restores}`);
  });

  await ok('subscribe — blocked when catalog missing plan', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    installMockRC(ctx, {
      hasPlan: () => false,
      purchasePlan: () => Promise.reject(new Error('should not purchase')),
    });
    clearToast();
    ctx.Tracker.subscribePremium();
    await flushPromises();
    if (/thank you/i.test(toast())) throw new Error('purchase should not succeed');
    if (!/not available yet/i.test(toast())) throw new Error(`expected blocked toast, got: ${toast()}`);
  });

  await ok('subscribe — billing unavailable (no Play RC)', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    installMockRC(ctx, {
      isAvailable: () => false,
      purchasePlan: () => Promise.reject(new Error('should not purchase')),
    });
    clearToast();
    ctx.Tracker.subscribePremium();
    await flushPromises();
    if (/thank you/i.test(toast())) throw new Error('must not purchase');
    if (!/google play/i.test(toast())) throw new Error(`expected Play install toast, got: ${toast()}`);
  });

  await ok('restore — billing unavailable (no Play RC)', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    installMockRC(ctx, {
      isAvailable: () => false,
      restorePurchases: () => Promise.reject(new Error('should not restore')),
    });
    clearToast();
    ctx.Tracker.restorePremium();
    await flushPromises();
    if (/restored/i.test(toast())) throw new Error('must not restore');
    if (!/google play/i.test(toast())) throw new Error(`expected Play install toast, got: ${toast()}`);
  });

  await ok('subscribe — offerings catalog not ready', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    installMockRC(ctx, {
      catalogReady: false,
      hasPlan: () => false,
      purchasePlan: () => Promise.reject(new Error('should not purchase')),
    });
    clearToast();
    ctx.Tracker.subscribePremium();
    await flushPromises();
    if (/thank you/i.test(toast())) throw new Error('must not purchase without catalog');
    if (!/not available yet/i.test(toast())) throw new Error(`expected unavailable toast, got: ${toast()}`);
  });

  await ok('bootstrap — cancelled sub in paid period stays premium', async () => {
    const { ctx } = setupPremiumContext();
    const future = new Date(Date.now() + 10 * 86400000).toISOString();
    installMockRC(ctx, {
      syncEntitlement: () => Promise.resolve(makeRealisticCustomerInfo({
        productId: 'ten_drinks_premium',
        productPlanId: 'yearly',
        willRenew: false,
        expirationDate: future,
      })),
    });
    ctx.bootstrapStoreEntitlement();
    await flushPromises();
    if (!ctx.isPremiumActive()) throw new Error('cancelled sub must remain active until expiry');
  });

  await ok('subscribe — unexpected CustomerInfo (no expiration) does not grant', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    const broken = makeRealisticCustomerInfo();
    broken.entitlements.active.premium.expirationDate = null;
    installMockRC(ctx, {
      purchasePlan: () => Promise.resolve(broken),
    });
    clearToast();
    ctx.Tracker.subscribePremium();
    await flushPromises();
    if (ctx.isPremiumActive()) throw new Error('must not grant without expiration');
    if (!/not active yet/i.test(toast())) throw new Error(`expected inactive toast, got: ${toast()}`);
  });

  await ok('restore — unexpected CustomerInfo (unknown sku) does not grant', async () => {
    const { ctx, toast, clearToast } = setupPremiumContext();
    installMockRC(ctx, {
      restorePurchases: () => Promise.resolve(makeRealisticCustomerInfo({
        productId: 'foreign_product',
        productPlanId: 'yearly',
      })),
    });
    clearToast();
    ctx.Tracker.restorePremium();
    await flushPromises();
    if (ctx.isPremiumActive()) throw new Error('unknown sku must not grant');
    if (!/no active subscription/i.test(toast())) throw new Error(`expected no sub toast, got: ${toast()}`);
  });

  await ok('bootstrap — malformed CustomerInfo keeps existing premium', async () => {
    const { ctx } = setupPremiumContext();
    ctx.applyRevenueCatCustomerInfo(makeCustomerInfo({ requestDate: '2026-01-01T00:00:00.000Z' }));
    if (!ctx.isPremiumActive()) throw new Error('pre-seeded premium required');
    installMockRC(ctx, {
      syncEntitlement: () => Promise.resolve({
        requestDate: '2026-06-02T12:00:00.000Z',
        entitlements: { verification: 'VERIFIED' },
      }),
    });
    ctx.bootstrapStoreEntitlement();
    await flushPromises();
    if (!ctx.isPremiumActive()) throw new Error('malformed sync must not clear premium');
  });
}

run().then(() => {
  console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll RevenueCat integration checks passed.\n');
  process.exit(failed ? 1 : 0);
});
