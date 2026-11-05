/* ===== offering-catalog.js — RC offering / Play product mapping (no native SDK) ===== */
'use strict';

const OfferingCatalog = {
  /** Ordered candidates for a plan (configured id first, then matching package type). */
  packageCandidatesForPlan(offering, planId) {
    if (!offering || !offering.availablePackages) return [];
    if (planId !== 'monthly' && planId !== 'yearly') return [];
    const packages = offering.availablePackages;
    const out = [];
    const seen = new Set();
    function push(pkg) {
      if (!pkg || seen.has(pkg)) return;
      seen.add(pkg);
      out.push(pkg);
    }
    const lookup = typeof REVENUECAT_PACKAGE_IDENTIFIERS === 'object'
      ? REVENUECAT_PACKAGE_IDENTIFIERS
      : {};
    const ident = lookup[planId];
    if (ident) {
      for (let j = 0; j < packages.length; j++) {
        if (packages[j].identifier === ident) push(packages[j]);
      }
    }
    const wantType = planId === 'yearly' ? 'ANNUAL' : 'MONTHLY';
    for (let i = 0; i < packages.length; i++) {
      if (packages[i].packageType === wantType) push(packages[i]);
    }
    return out;
  },

  packageForPlan(offering, planId) {
    const candidates = this.packageCandidatesForPlan(offering, planId);
    return candidates.length ? candidates[0] : null;
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
    const candidates = this.packageCandidatesForPlan(offering, planId);
    for (let i = 0; i < candidates.length; i++) {
      if (this.validatePackageProduct(candidates[i], planId)) return candidates[i];
    }
    return null;
  },

  /** Store price strings when only one plan resolved (no savings compare). */
  buildPartialPlanQuotes(monthlyPkg, yearlyPkg) {
    const mp = monthlyPkg && monthlyPkg.product ? monthlyPkg.product : null;
    const yp = yearlyPkg && yearlyPkg.product ? yearlyPkg.product : null;
    if (!mp && !yp) return null;
    const currency = (yp && yp.currencyCode) || (mp && mp.currencyCode) || '';
    return {
      currency,
      monthly: mp ? mp.priceString : '—',
      yearly: yp ? yp.priceString : '—',
      yearlyList: '',
      yearlyPerMonth: yp && yp.pricePerMonthString
        ? `${yp.pricePerMonthString}/mo · best value`
        : (yp ? '—' : '—'),
      percentOff: 0,
      fromStore: true,
      partial: true,
    };
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
      : '—';
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
