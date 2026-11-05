#!/usr/bin/env node
/**
 * Offering catalog — package mapping, Play ID validation, store quotes.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadCatalog() {
  const ctx = {
    window: {},
    PLAY_BILLING_PRODUCT_IDS: {
      monthly: 'ten_drinks_premium:monthly',
      yearly: 'ten_drinks_premium:yearly',
    },
    REVENUECAT_PACKAGE_IDENTIFIERS: { monthly: 'monthly', yearly: 'annual' },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/premium/offering-catalog.js'), 'utf8'), ctx);
  return ctx.window.OfferingCatalog;
}

function pkg(type, ident, productId, price, priceString, extras) {
  return {
    packageType: type,
    identifier: ident,
    product: {
      identifier: productId,
      price,
      priceString,
      currencyCode: 'USD',
      pricePerMonth: price / 12,
      pricePerMonthString: `$${(price / 12).toFixed(2)}`,
      ...extras,
    },
  };
}

const cat = loadCatalog();
let failed = 0;

function ok(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}: ${e.message}`);
  }
}

console.log('\nPremium offering catalog\n');

const offering = {
  availablePackages: [
    pkg('MONTHLY', 'monthly', 'ten_drinks_premium:monthly', 2.99, '$2.99'),
    pkg('ANNUAL', 'annual', 'ten_drinks_premium:yearly', 14.99, '$14.99'),
  ],
};

ok('packageForPlan — MONTHLY / ANNUAL types', () => {
  const m = cat.packageForPlan(offering, 'monthly');
  const y = cat.packageForPlan(offering, 'yearly');
  if (m.product.identifier !== 'ten_drinks_premium:monthly') throw new Error('monthly pkg');
  if (y.product.identifier !== 'ten_drinks_premium:yearly') throw new Error('yearly pkg');
});

ok('packageForPlan — rejects unknown planId', () => {
  if (cat.packageForPlan(offering, 'lifetime') !== null) throw new Error('unknown plan');
  if (cat.resolvePackageForPlan(offering, 'weekly') !== null) throw new Error('unknown resolve');
});

ok('resolvePackageForPlan — rejects wrong Play product ID', () => {
  const bad = {
    availablePackages: [
      pkg('MONTHLY', 'monthly', 'wrong_monthly_sku', 2.99, '$2.99'),
    ],
  };
  if (cat.resolvePackageForPlan(bad, 'monthly')) {
    throw new Error('wrong SKU must not resolve');
  }
});

ok('resolvePackageForPlan — accepts validated packages', () => {
  if (!cat.resolvePackageForPlan(offering, 'monthly')) throw new Error('monthly');
  if (!cat.resolvePackageForPlan(offering, 'yearly')) throw new Error('yearly');
});

ok('buildPlanQuotes — uses Play priceString and store savings', () => {
  const m = cat.resolvePackageForPlan(offering, 'monthly');
  const y = cat.resolvePackageForPlan(offering, 'yearly');
  const q = cat.buildPlanQuotes(m, y);
  if (!q || !q.fromStore) throw new Error('fromStore');
  if (q.monthly !== '$2.99' || q.yearly !== '$14.99') throw new Error('priceString mismatch');
  if (q.yearlyList !== '') throw new Error('no fake list price');
  const expectOff = Math.round((1 - 14.99 / (2.99 * 12)) * 100);
  if (q.percentOff !== expectOff) throw new Error(`percentOff ${q.percentOff} vs ${expectOff}`);
});

ok('package identifier fallback when types CUSTOM', () => {
  const customOffering = {
    availablePackages: [
      pkg('CUSTOM', 'monthly', 'ten_drinks_premium:monthly', 2.99, '$2.99'),
      pkg('CUSTOM', 'annual', 'ten_drinks_premium:yearly', 14.99, '$14.99'),
    ],
  };
  if (!cat.resolvePackageForPlan(customOffering, 'yearly')) {
    throw new Error('annual identifier fallback');
  }
});

ok('buildPartialPlanQuotes — monthly only', () => {
  const m = cat.resolvePackageForPlan(offering, 'monthly');
  const q = cat.buildPartialPlanQuotes(m, null);
  if (!q || !q.fromStore || q.monthly !== '$2.99') throw new Error('monthly partial');
  if (q.yearly !== '—' || q.percentOff !== 0) throw new Error('yearly placeholder');
});

ok('buildPartialPlanQuotes — yearly only', () => {
  const y = cat.resolvePackageForPlan(offering, 'yearly');
  const q = cat.buildPartialPlanQuotes(null, y);
  if (!q || q.yearly !== '$14.99') throw new Error('yearly partial');
  if (q.monthly !== '—') throw new Error('monthly placeholder');
});

ok('resolvePackageForPlan — skips invalid first monthly, selects valid second', () => {
  const multiMonthly = {
    availablePackages: [
      pkg('MONTHLY', 'promo_monthly', 'wrong_sku:monthly', 1.99, '$1.99'),
      pkg('MONTHLY', 'monthly', 'ten_drinks_premium:monthly', 2.99, '$2.99'),
      pkg('ANNUAL', 'annual', 'ten_drinks_premium:yearly', 14.99, '$14.99'),
    ],
  };
  const resolved = cat.resolvePackageForPlan(multiMonthly, 'monthly');
  if (!resolved || resolved.product.identifier !== 'ten_drinks_premium:monthly') {
    throw new Error('must pick validated product, not first MONTHLY slot');
  }
});

ok('configured package identifier wins over generic MONTHLY type', () => {
  const offering = {
    availablePackages: [
      pkg('MONTHLY', 'promo_slot', 'wrong_sku:monthly', 2.99, '$2.99'),
      pkg('CUSTOM', 'monthly', 'ten_drinks_premium:monthly', 2.99, '$2.99'),
    ],
  };
  const resolved = cat.resolvePackageForPlan(offering, 'monthly');
  if (!resolved || resolved.product.identifier !== 'ten_drinks_premium:monthly') {
    throw new Error('identifier mapping must beat generic MONTHLY type');
  }
});

console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll offering catalog checks passed.\n');
process.exit(failed ? 1 : 0);
