#!/usr/bin/env node
/**
 * Release billing / Play / RevenueCat config validation (source or dist app.config.js).
 * Usage:
 *   node tests/release-config.mjs              → invariants + default trial shipping profile (src)
 *   node tests/release-config.mjs --trial [path]
 *   node tests/release-config.mjs --store [path]
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultConfigPath = path.join(root, 'src/config/app.config.js');

export function loadAppConfig(configPath) {
  const abs = path.resolve(configPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`config not found: ${abs}`);
  }
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs });
  return vm.runInContext(`({
    PREMIUM_BILLING_MODE,
    REVENUECAT_ANDROID_API_KEY,
    REVENUECAT_ENTITLEMENT_ID,
    PLAY_SUBSCRIPTION_ID,
    PLAY_BILLING_PRODUCT_IDS,
    PREMIUM_PLANS,
    CONFIG,
  })`, ctx);
}

export function validateBillingCatalog(cfg) {
  const errors = [];
  if (cfg.REVENUECAT_ENTITLEMENT_ID !== 'premium') {
    errors.push(`REVENUECAT_ENTITLEMENT_ID must be "premium" (got ${cfg.REVENUECAT_ENTITLEMENT_ID})`);
  }
  if (!cfg.CONFIG || cfg.CONFIG.revenueCatEntitlementId !== 'premium') {
    errors.push('CONFIG.revenueCatEntitlementId must be "premium"');
  }
  if (cfg.PLAY_SUBSCRIPTION_ID !== 'ten_drinks_premium') {
    errors.push(`PLAY_SUBSCRIPTION_ID must be ten_drinks_premium (got ${cfg.PLAY_SUBSCRIPTION_ID})`);
  }
  const ids = cfg.PLAY_BILLING_PRODUCT_IDS;
  if (!ids || typeof ids !== 'object') {
    errors.push('PLAY_BILLING_PRODUCT_IDS must be an object');
  } else {
    if (ids.monthly !== 'ten_drinks_premium:monthly') {
      errors.push(`monthly product must be ten_drinks_premium:monthly (got ${ids.monthly})`);
    }
    if (ids.yearly !== 'ten_drinks_premium:yearly') {
      errors.push(`yearly product must be ten_drinks_premium:yearly (got ${ids.yearly})`);
    }
  }
  const plans = cfg.PREMIUM_PLANS;
  if (!plans?.monthly || plans.monthly.id !== 'monthly') {
    errors.push('PREMIUM_PLANS.monthly.id must be "monthly"');
  }
  if (!plans?.yearly || plans.yearly.id !== 'yearly') {
    errors.push('PREMIUM_PLANS.yearly.id must be "yearly"');
  }
  return errors;
}

export function validateReleaseCommon(cfg) {
  const errors = [];
  if (!cfg.CONFIG) {
    errors.push('CONFIG object missing');
    return errors;
  }
  if (cfg.CONFIG.showTestUI !== false) {
    errors.push('CONFIG.showTestUI must be false for release');
  }
  if (cfg.CONFIG.showInternalTestBar !== false) {
    errors.push('CONFIG.showInternalTestBar must be false for release');
  }
  return errors;
}

export function validateTrialProfile(cfg) {
  const errors = validateReleaseCommon(cfg);
  if (cfg.PREMIUM_BILLING_MODE !== 'local-stub') {
    errors.push(`PREMIUM_BILLING_MODE must be local-stub (got ${cfg.PREMIUM_BILLING_MODE})`);
  }
  if (cfg.CONFIG?.premiumBilling !== 'local-stub') {
    errors.push('CONFIG.premiumBilling must be local-stub');
  }
  const key = typeof cfg.REVENUECAT_ANDROID_API_KEY === 'string' ? cfg.REVENUECAT_ANDROID_API_KEY : '';
  if (key.trim() !== '') {
    errors.push('REVENUECAT_ANDROID_API_KEY must be empty in trial profile');
  }
  if (cfg.CONFIG?.showPremiumInApp !== false) {
    errors.push('CONFIG.showPremiumInApp must be false in trial profile');
  }
  if (cfg.CONFIG?.showPremiumSubscribe !== false) {
    errors.push('CONFIG.showPremiumSubscribe must be false in trial profile');
  }
  return errors;
}

export function validateStoreProfile(cfg) {
  const errors = validateReleaseCommon(cfg);
  if (cfg.PREMIUM_BILLING_MODE !== 'store') {
    errors.push(`PREMIUM_BILLING_MODE must be store (got ${cfg.PREMIUM_BILLING_MODE})`);
  }
  if (cfg.CONFIG?.premiumBilling !== 'store') {
    errors.push('CONFIG.premiumBilling must be store');
  }
  const key = typeof cfg.REVENUECAT_ANDROID_API_KEY === 'string' ? cfg.REVENUECAT_ANDROID_API_KEY.trim() : '';
  if (!key.startsWith('goog_') || key.length < 20) {
    errors.push('REVENUECAT_ANDROID_API_KEY must be a nonempty public goog_ key in store profile');
  }
  if (cfg.CONFIG?.showPremiumInApp !== true) {
    errors.push('CONFIG.showPremiumInApp must be true in store profile');
  }
  if (cfg.CONFIG?.showPremiumSubscribe !== true) {
    errors.push('CONFIG.showPremiumSubscribe must be true in store profile');
  }
  if (cfg.CONFIG?.showPremiumInSettings !== true) {
    errors.push('CONFIG.showPremiumInSettings must be true in store profile');
  }
  return errors;
}

function runDefaultTestSuite() {
  let failed = 0;
  const ok = (name, fn) => {
    try {
      fn();
      console.log(`  ok  ${name}`);
    } catch (e) {
      failed += 1;
      console.error(` FAIL ${name}:`, e.message);
    }
  };

  console.log('\nRelease config validation\n');

  const srcCfg = loadAppConfig(defaultConfigPath);

  ok('billing catalog invariants (Play + RC ids)', () => {
    const errs = validateBillingCatalog(srcCfg);
    if (errs.length) throw new Error(errs.join('; '));
  });

  ok('default shipping profile matches trial preflight', () => {
    const errs = validateTrialProfile(srcCfg);
    if (errs.length) throw new Error(errs.join('; '));
  });

  ok('store profile rules (synthetic store config)', () => {
    const synthetic = loadAppConfig(defaultConfigPath);
    synthetic.PREMIUM_BILLING_MODE = 'store';
    synthetic.CONFIG = { ...synthetic.CONFIG };
    synthetic.CONFIG.premiumBilling = 'store';
    synthetic.CONFIG.showPremiumInApp = true;
    synthetic.CONFIG.showPremiumSubscribe = true;
    synthetic.CONFIG.showPremiumInSettings = true;
    synthetic.REVENUECAT_ANDROID_API_KEY = `goog_${'a'.repeat(24)}`;
    synthetic.CONFIG.revenueCatAndroidApiKey = synthetic.REVENUECAT_ANDROID_API_KEY;
    const errs = validateStoreProfile(synthetic);
    if (errs.length) throw new Error(errs.join('; '));
  });

  console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll release config checks passed.\n');
  return failed;
}

function runCliProfile(profile, configPath) {
  const cfg = loadAppConfig(configPath);
  const catalogErrs = validateBillingCatalog(cfg);
  if (catalogErrs.length) {
    console.error(`release-config (${profile}): ${catalogErrs.join('; ')}`);
    process.exit(1);
  }
  const profileErrs = profile === 'store' ? validateStoreProfile(cfg) : validateTrialProfile(cfg);
  if (profileErrs.length) {
    console.error(`release-config (${profile}): ${profileErrs.join('; ')}`);
    process.exit(1);
  }
  console.log(`release-config (${profile}): OK`);
}

const args = process.argv.slice(2);
const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  if (args.length === 0) {
    process.exit(runDefaultTestSuite() ? 1 : 0);
  }
  const profile = args[0];
  const configPath = args[1] || defaultConfigPath;
  if (profile !== '--trial' && profile !== '--store') {
    console.error('Usage: node tests/release-config.mjs [--trial|--store] [app.config.js path]');
    process.exit(1);
  }
  runCliProfile(profile === '--store' ? 'store' : 'trial', configPath);
}
