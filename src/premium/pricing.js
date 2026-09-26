/* ===== src/premium/pricing.js — locale currency display (pre–store billing) ===== */
'use strict';

/** Reference USD tiers when no local list price is defined. */
const PREMIUM_USD_REFERENCE = {
  monthly: 2.99,
  yearly: 14.99,
  yearlyList: 26.99,
};

/** Typical list prices in major currencies (store will replace when wired). */
const PREMIUM_LIST_BY_CURRENCY = {
  USD: { monthly: 2.99, yearly: 14.99, yearlyList: 26.99 },
  EUR: { monthly: 2.99, yearly: 14.99, yearlyList: 26.99 },
  GBP: { monthly: 2.49, yearly: 12.99, yearlyList: 22.99 },
  INR: { monthly: 149, yearly: 999, yearlyList: 1788 },
  AUD: { monthly: 4.49, yearly: 22.99, yearlyList: 40.99 },
  CAD: { monthly: 3.99, yearly: 19.99, yearlyList: 35.99 },
  JPY: { monthly: 450, yearly: 2200, yearlyList: 3900 },
  MXN: { monthly: 59, yearly: 299, yearlyList: 529 },
  BRL: { monthly: 14.9, yearly: 79.9, yearlyList: 139.9 },
};

const FX_FROM_USD = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83,
  AUD: 1.55,
  CAD: 1.36,
  JPY: 150,
  MXN: 17,
  BRL: 5,
  CHF: 0.88,
  SEK: 10.5,
  NOK: 10.8,
  DKK: 6.9,
  PLN: 4,
  ZAR: 18,
  SGD: 1.35,
  NZD: 1.65,
  HKD: 7.8,
  KRW: 1350,
  AED: 3.67,
  SAR: 3.75,
};

const REGION_TO_CURRENCY = {
  US: 'USD', CA: 'CAD', GB: 'GBP', IN: 'INR', AU: 'AUD', NZ: 'NZD',
  JP: 'JPY', MX: 'MXN', BR: 'BRL', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK',
  PL: 'PLN', ZA: 'ZAR', SG: 'SGD', HK: 'HKD', KR: 'KRW', AE: 'AED', SA: 'SAR',
  AT: 'EUR', BE: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR', FI: 'EUR',
  FR: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR', LU: 'EUR', LV: 'EUR',
  MT: 'EUR', NL: 'EUR', PT: 'EUR', SI: 'EUR', SK: 'EUR', HR: 'EUR',
};

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP']);

function resolveUserCurrencyCode() {
  try {
    const loc = new Intl.Locale(navigator.language || 'en-US');
    if (loc.region && REGION_TO_CURRENCY[loc.region]) {
      return REGION_TO_CURRENCY[loc.region];
    }
  } catch (e) {}
  return 'USD';
}

function roundForCurrency(amount, currencyCode) {
  if (ZERO_DECIMAL_CURRENCIES.has(currencyCode)) {
    return Math.max(1, Math.round(amount));
  }
  return Math.round(amount * 100) / 100;
}

function getPremiumPriceAmounts(currencyCode) {
  const code = currencyCode || resolveUserCurrencyCode();
  if (PREMIUM_LIST_BY_CURRENCY[code]) {
    return { ...PREMIUM_LIST_BY_CURRENCY[code], currency: code };
  }
  const rate = FX_FROM_USD[code] || 1;
  return {
    currency: code,
    monthly: roundForCurrency(PREMIUM_USD_REFERENCE.monthly * rate, code),
    yearly: roundForCurrency(PREMIUM_USD_REFERENCE.yearly * rate, code),
    yearlyList: roundForCurrency(PREMIUM_USD_REFERENCE.yearlyList * rate, code),
  };
}

function formatPremiumPrice(amount, currencyCode) {
  const code = currencyCode || resolveUserCurrencyCode();
  const zeroDec = ZERO_DECIMAL_CURRENCIES.has(code);
  const frac = zeroDec ? 0 : (Math.abs(amount - Math.round(amount)) < 0.001 ? 0 : 2);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: frac,
      maximumFractionDigits: zeroDec ? 0 : 2,
    }).format(amount);
  } catch (e) {
    return `${amount} ${code}`;
  }
}

/** Formatted strings for paywall UI (updates when locale/currency changes). */
function getPremiumPlanQuotes() {
  const amounts = getPremiumPriceAmounts();
  const { currency, monthly, yearly, yearlyList } = amounts;
  const perMonth = yearly / 12;
  const percentOff = yearlyList > 0
    ? Math.max(0, Math.round((1 - yearly / yearlyList) * 100))
    : 0;
  return {
    currency,
    monthly: formatPremiumPrice(monthly, currency),
    yearly: formatPremiumPrice(yearly, currency),
    yearlyList: formatPremiumPrice(yearlyList, currency),
    yearlyPerMonth: formatPremiumPrice(perMonth, currency),
    percentOff,
  };
}

function renderPremiumPlanPrices() {
  const q = getPremiumPlanQuotes();
  const monthlyEl = el('planMonthlyPrice');
  const yearlySaleEl = el('planYearlySalePrice');
  const yearlyListEl = el('planYearlyListPrice');
  const yearlyMsgEl = el('planYearlyPerMonthMsg');
  const offEl = el('planYearlyOff');
  if (monthlyEl) monthlyEl.textContent = q.monthly;
  if (yearlySaleEl) yearlySaleEl.textContent = q.yearly;
  if (yearlyListEl) yearlyListEl.textContent = q.yearlyList;
  if (offEl) {
    offEl.textContent = q.percentOff > 0 ? `${q.percentOff}% off` : '';
    offEl.hidden = q.percentOff <= 0;
  }
  if (yearlyMsgEl) {
    yearlyMsgEl.textContent = `${q.yearlyPerMonth}/mo · best value`;
  }
}
