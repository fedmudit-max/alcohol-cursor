/* Bundled to revenuecat.bundle.js — RevenueCat + Capacitor (Android store billing). */
import { Capacitor } from '@capacitor/core';
import {
  Purchases,
  LOG_LEVEL,
  ENTITLEMENT_VERIFICATION_MODE,
} from '@revenuecat/purchases-capacitor';

const RevenueCatBilling = {
  _configured: false,
  _listenerRegistered: false,
  _configurePromise: null,
  _offeringsCache: null,
  _offeringsPromise: null,
  _planQuotes: null,
  _packagesByPlan: { monthly: null, yearly: null },

  isNativeAndroid() {
    try {
      return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    } catch (e) {
      return false;
    }
  },

  getApiKey() {
    if (typeof CONFIG === 'undefined') return '';
    const key = CONFIG.revenueCatAndroidApiKey;
    return typeof key === 'string' ? key.trim() : '';
  },

  isAvailable() {
    return this.isNativeAndroid() && this.getApiKey().length > 0;
  },

  catalogApi() {
    return typeof OfferingCatalog !== 'undefined' ? OfferingCatalog : null;
  },

  async configure() {
    if (!this.isAvailable()) return false;
    if (this._configured) return true;
    if (!this._configurePromise) {
      this._configurePromise = this._configureOnce().catch((err) => {
        this._configurePromise = null;
        throw err;
      });
    }
    return this._configurePromise;
  },

  async _configureOnce() {
    const apiKey = this.getApiKey();
    await Purchases.configure({
      apiKey,
      entitlementVerificationMode: ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL,
    });
    try {
      if (CONFIG && CONFIG.isProduction === false) {
        await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      }
    } catch (e) { /* optional */ }
    if (!this._listenerRegistered) {
      await Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        // No sync-generation guard: RC pushes legitimate renewals/revocations here.
        // Stale payloads are dropped via CustomerInfo requestDate monotonic apply.
        if (typeof applyRevenueCatCustomerInfo === 'function') {
          applyRevenueCatCustomerInfo(customerInfo);
        }
        const d = typeof Tracker !== 'undefined' && Tracker.data
          ? Tracker.data
          : null;
        if (typeof refreshEntitlementIfChanged === 'function') {
          refreshEntitlementIfChanged(d);
        }
      });
      this._listenerRegistered = true;
    }
    this._configured = true;
    return true;
  },

  _rebuildCatalogFromOffering() {
    const cat = this.catalogApi();
    const offering = this._offeringsCache && this._offeringsCache.current;
    if (!cat || !offering) {
      this._planQuotes = null;
      this._packagesByPlan = { monthly: null, yearly: null };
      return;
    }
    const monthly = cat.resolvePackageForPlan(offering, 'monthly');
    const yearly = cat.resolvePackageForPlan(offering, 'yearly');
    this._packagesByPlan = { monthly, yearly };
    if (monthly && yearly) {
      this._planQuotes = cat.buildPlanQuotes(monthly, yearly);
    } else if (monthly || yearly) {
      this._planQuotes = cat.buildPartialPlanQuotes(monthly, yearly);
    } else {
      this._planQuotes = null;
    }
  },

  /** Launch policy: both base plans must resolve before checkout (see syncPremiumStoreCheckoutState). */
  isStoreCheckoutReady() {
    return this.hasPlan('monthly') && this.hasPlan('yearly') && !!this._planQuotes;
  },

  async loadOfferings(forceRefresh) {
    if (!this.isAvailable()) return null;
    await this.configure();
    if (!forceRefresh && this._offeringsCache) {
      return this._offeringsCache;
    }
    if (!forceRefresh && this._offeringsPromise) {
      return this._offeringsPromise;
    }
    this._offeringsPromise = Purchases.getOfferings()
      .then((result) => {
        this._offeringsCache = result;
        this._rebuildCatalogFromOffering();
        this._offeringsPromise = null;
        return result;
      })
      .catch((err) => {
        this._offeringsPromise = null;
        throw err;
      });
    return this._offeringsPromise;
  },

  isCatalogReady() {
    return !!(this._offeringsCache && this._offeringsCache.current);
  },

  hasPlan(planId) {
    return !!(this._packagesByPlan && this._packagesByPlan[planId]);
  },

  getPlanQuotes() {
    return this._planQuotes;
  },

  resolvePackageForPlan(planId) {
    const cat = this.catalogApi();
    const offering = this._offeringsCache && this._offeringsCache.current;
    if (!cat || !offering) return null;
    return cat.resolvePackageForPlan(offering, planId);
  },

  async getCustomerInfo() {
    await this.configure();
    const result = await Purchases.getCustomerInfo();
    return result.customerInfo;
  },

  async syncEntitlement() {
    return this.getCustomerInfo();
  },

  async purchasePlan(planId) {
    await this.configure();
    await this.loadOfferings();
    const pkg = this.resolvePackageForPlan(planId);
    if (!pkg) throw new Error('no-package-for-plan');
    const result = await Purchases.purchasePackage({ aPackage: pkg });
    return result.customerInfo;
  },

  async restorePurchases() {
    await this.configure();
    const result = await Purchases.restorePurchases();
    return result.customerInfo;
  },
};

window.RevenueCatBilling = RevenueCatBilling;

function getStorePremiumPlanQuotes() {
  if (typeof RevenueCatBilling === 'undefined' || !RevenueCatBilling.isAvailable()) {
    return null;
  }
  return RevenueCatBilling.getPlanQuotes();
}

window.getStorePremiumPlanQuotes = getStorePremiumPlanQuotes;
