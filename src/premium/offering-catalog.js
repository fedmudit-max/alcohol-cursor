/* ===== offering-catalog.js — RC offering / Play product mapping (no native SDK) ===== */
'use strict';

const OfferingCatalog = {
  packageForPlan(offering, planId) {
    if (!offering || !offering.availablePackages) return null;
    const packages = offering.availablePackages;
    const wantType = planId === 'yearly' ? 'ANNUAL' : 'MONTHLY';
    for (let i = 0; i < packages.length; i++) {
      if (packages[i].packageType === wantType) return packages[i];
    }
    const lookup = typeof REVENUECAT_PACKAGE_IDENTIFIERS === 'object'
      ? REVENUECAT_PACKAGE_IDENTIFIERS
      : {};
    const ident = lookup[planId];
    if (!ident) return null;
    for (let j = 0; j < packages.length; j++) {
      if (packages[j].identifier === ident) return packages[j];
    }
    return null;
  },

  expectedPlayProductId(planId) {
    if (typeof PLAY_BILLING_PRODUCT_IDS !== 'object' || !PLAY_BILLING_PRODUCT_IDS) return null;
    return PLAY_BILLING_PRODUCT_IDS[planId] || null;
  },

  validatePackageProduct(pkg, planId) {
    if (!pkg || !pkg.product) return false;
    const expected = this.expectedPlayProductId(planId);
    if (!expected) return false;
    return pkg.product.identifier === expected;
  },

  resolvePackageForPlan(offering, planId) {
    const pkg = this.packageForPlan(offering, planId);
    if (!pkg || !this.validatePackageProduct(pkg, planId)) return null;
    return pkg;
  },

  buildPlanQuotes(monthlyPkg, yearlyPkg) {
    if (!monthlyPkg || !yearlyPkg || !monthlyPkg.product || !yearlyPkg.product) return null;
    const mp = monthlyPkg.product;
    const yp = yearlyPkg.product;
    const twelveMonthly = mp.price * 12;
    const percentOff = twelveMonthly > yp.price && twelveMonthly > 0
      ? Math.max(0, Math.round((1 - yp.price / twelveMonthly) * 100))
      : 0;
    const yearlyPerMonthLabel = yp.pricePerMonthString
      ? `${yp.pricePerMonthString}/mo · best value`
      : `${(yp.price / 12).toFixed(2)} · best value`;
    return {
      currency: yp.currencyCode || mp.currencyCode || '',
      monthly: mp.priceString,
      yearly: yp.priceString,
      yearlyList: '',
      yearlyPerMonth: yearlyPerMonthLabel,
      percentOff,
      fromStore: true,
    };
  },
};

window.OfferingCatalog = OfferingCatalog;
