/* ===== src/premium/premium.js ===== */
'use strict';
// PREMIUM — entitlement layer (trial + feature gates).
// Production web: trial only; local-stub unlock requires CONFIG.showTestUI (dev).
// ═══════════════════════════════════════════════════════════════
let selectedPremiumPlan = 'yearly';

/** Prevents overlapping RevenueCat purchase / restore calls. */
let rcBillingOpInFlight = false;

/** Bumped on import/delete resync — in-flight syncs from before invalidate are ignored. */
let rcEntitlementSyncGeneration = 0;

/** Subscription truth from RevenueCat only — never read localStorage for store billing. */
let rcPremiumState = {
  active: false,
  entitlementId: null,
  expiresAt: null,
  productId: null,
  plan: null,
  verification: null,
  requestDateMs: null,
  lastSyncAt: null,
};

function clearRcPremiumState() {
  rcPremiumState = {
    active: false,
    entitlementId: null,
    expiresAt: null,
    productId: null,
    plan: null,
    verification: null,
    requestDateMs: null,
    lastSyncAt: null,
  };
}

function rcCustomerInfoRequestDateMs(customerInfo) {
  if (!customerInfo || customerInfo.requestDate == null || customerInfo.requestDate === '') {
    return null;
  }
  const t = new Date(customerInfo.requestDate).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Ignore stale async getCustomerInfo responses (older than last applied snapshot). */
function rcShouldApplyCustomerInfo(customerInfo) {
  const incoming = rcCustomerInfoRequestDateMs(customerInfo);
  if (incoming == null) return false;
  const last = rcPremiumState.requestDateMs;
  if (last == null) return true;
  return incoming >= last;
}

function rcVerificationFailed(verification) {
  return verification === 'FAILED';
}

function rcVerificationAcceptable(verification) {
  return verification === 'VERIFIED' || verification === 'VERIFIED_ON_DEVICE';
}

/** User dismissed Play purchase sheet — not a billing failure. */
function isRevenueCatPurchaseUserCancelled(err) {
  if (!err) return false;
  if (err.userCancelled === true) return true;
  const code = err.code != null ? err.code : err.errorCode;
  if (code === 1 || code === '1' || code === 'PURCHASE_CANCELLED' || code === 'PurchaseCancelledError') {
    return true;
  }
  return false;
}

function isRevenueCatPurchasePending(err) {
  if (!err) return false;
  const code = err.code != null ? err.code : err.errorCode;
  return code === 20 || code === '20' || code === 'PAYMENT_PENDING_ERROR';
}

/** Dated, structurally valid CustomerInfo — required before grant or revoke. */
function rcIsAuthoritativeCustomerInfo(customerInfo) {
  if (!customerInfo || typeof customerInfo !== 'object') return false;
  const entitlements = customerInfo.entitlements;
  if (!entitlements || typeof entitlements !== 'object') return false;
  if (!Object.prototype.hasOwnProperty.call(entitlements, 'active')) return false;
  const active = entitlements.active;
  if (typeof active !== 'object' || active === null || Array.isArray(active)) return false;
  return rcCustomerInfoRequestDateMs(customerInfo) != null;
}

function premiumActiveFromRevenueCat() {
  if (!isStoreBillingConfigured()) return false;
  if (!rcPremiumState.active) return false;
  if (!rcVerificationAcceptable(rcPremiumState.verification)) return false;
  const entId = revenueCatEntitlementId();
  if (rcPremiumState.entitlementId !== entId) return false;
  if (rcPremiumState.expiresAt == null || rcPremiumState.expiresAt === '') return false;
  const exp = new Date(rcPremiumState.expiresAt).getTime();
  if (Number.isNaN(exp)) return false;
  return Date.now() <= exp;
}

function isLocalStubBilling() {
  return (CONFIG.premiumBilling || 'local-stub') === 'local-stub';
}

function isStoreBillingConfigured() {
  return CONFIG.premiumBilling === 'store';
}

function isRevenueCatStoreBilling() {
  if (!isStoreBillingConfigured()) return false;
  const key = CONFIG.revenueCatAndroidApiKey;
  if (typeof key !== 'string' || !key.trim()) return false;
  return typeof RevenueCatBilling !== 'undefined' && RevenueCatBilling.isAvailable();
}

function revenueCatEntitlementId() {
  if (CONFIG && CONFIG.revenueCatEntitlementId) return CONFIG.revenueCatEntitlementId;
  if (typeof REVENUECAT_ENTITLEMENT_ID === 'string') return REVENUECAT_ENTITLEMENT_ID;
  return '10drinks_premium';
}

function planIdFromStoreProductId(productId) {
  if (!productId || typeof PLAY_BILLING_PRODUCT_IDS !== 'object') return null;
  for (const key of Object.keys(PLAY_BILLING_PRODUCT_IDS)) {
    if (key !== 'monthly' && key !== 'yearly') continue;
    if (PLAY_BILLING_PRODUCT_IDS[key] === productId) return key;
  }
  return null;
}

/**
 * Map RevenueCat entitlement fields to app plan (monthly | yearly).
 * Offerings use composite ids; CustomerInfo on Android may use subscription id + productPlanIdentifier.
 */
function planFromEntitlement(ent) {
  if (!ent || typeof ent !== 'object') return null;
  const productId = ent.productIdentifier || null;
  const fromComposite = planIdFromStoreProductId(productId);
  if (fromComposite) return fromComposite;

  const basePlanId = ent.productPlanIdentifier;
  if (typeof basePlanId !== 'string' || !basePlanId) return null;
  if (basePlanId !== 'monthly' && basePlanId !== 'yearly') return null;
  const subId = typeof PLAY_SUBSCRIPTION_ID === 'string' ? PLAY_SUBSCRIPTION_ID : '';
  if (!subId || productId !== subId) return null;
  return basePlanId;
}

/** Plan label for UI/analytics; access does not depend on a known plan. */
function resolvePlanLabelFromEntitlement(ent) {
  const plan = planFromEntitlement(ent);
  if (plan) return plan;
  const productId = ent && ent.productIdentifier ? ent.productIdentifier : '';
  const basePlanId = ent && ent.productPlanIdentifier ? ent.productPlanIdentifier : '';
  if (productId || basePlanId) {
    console.warn(
      '[10Drinks] Premium entitlement active with unrecognized product mapping:',
      productId,
      basePlanId,
    );
  }
  return null;
}

function invalidateRcEntitlementSyncGeneration() {
  rcEntitlementSyncGeneration += 1;
}

function captureRcEntitlementSyncGeneration() {
  return rcEntitlementSyncGeneration;
}

function rcEntitlementSyncGenerationMatches(syncGeneration) {
  if (syncGeneration == null) return true;
  return syncGeneration === rcEntitlementSyncGeneration;
}

/**
 * Apply RevenueCat CustomerInfo to in-memory entitlement (authoritative for store billing).
 * Does not persist subscription state to localStorage.
 * @param {object} customerInfo
 * @param {number|null|undefined} syncGeneration — from captureRcEntitlementSyncGeneration() when starting async sync
 */
function applyRevenueCatCustomerInfo(customerInfo, syncGeneration) {
  if (!rcEntitlementSyncGenerationMatches(syncGeneration)) {
    return premiumActiveFromRevenueCat();
  }
  if (!rcIsAuthoritativeCustomerInfo(customerInfo)) {
    return premiumActiveFromRevenueCat();
  }
  if (!rcShouldApplyCustomerInfo(customerInfo)) {
    return premiumActiveFromRevenueCat();
  }
  const requestDateMs = rcCustomerInfoRequestDateMs(customerInfo);
  const verification = customerInfo.entitlements.verification ?? null;
  const entId = revenueCatEntitlementId();
  const active = customerInfo.entitlements.active;
  const ent = active[entId];

  if (rcVerificationFailed(verification)) {
    clearRcPremiumState();
    rcPremiumState.requestDateMs = requestDateMs;
    clearPremiumLocalStorage();
    return false;
  }

  if (!ent) {
    if (rcVerificationAcceptable(verification)) {
      clearRcPremiumState();
      rcPremiumState.requestDateMs = requestDateMs;
      clearPremiumLocalStorage();
      return false;
    }
    return premiumActiveFromRevenueCat();
  }

  if (!rcVerificationAcceptable(verification)) {
    return premiumActiveFromRevenueCat();
  }

  const productId = ent.productIdentifier || null;
  const plan = resolvePlanLabelFromEntitlement(ent);
  if (ent.expirationDate == null || ent.expirationDate === '') {
    return premiumActiveFromRevenueCat();
  }
  const expMs = new Date(ent.expirationDate).getTime();
  if (Number.isNaN(expMs)) {
    return premiumActiveFromRevenueCat();
  }

  rcPremiumState = {
    active: true,
    entitlementId: entId,
    expiresAt: ent.expirationDate,
    productId,
    plan,
    verification,
    requestDateMs,
    lastSyncAt: new Date().toISOString(),
  };
  clearPremiumLocalStorage();
  return premiumActiveFromRevenueCat();
}

/** True only in dev when test UI is on — never for public production web. */
function canApplyLocalPremiumUnlock() {
  return isLocalStubBilling() && CONFIG.showTestUI === true;
}

function premiumRecordGrantsAccess(rec) {
  if (!rec || rec.active !== true) return false;

  // Local test purchases are never valid in production.
  if (rec.source === 'local-stub') {
    return canApplyLocalPremiumUnlock();
  }

  return false;
}

function premiumDaysLeftLabel() {
  const left = trialDaysLeft();
  if (left <= 0) return 'Trial ended';
  if (left === 1) return '1 day left';
  return `${left} days left`;
}

/** Settings premium row — active trial (collapsed header). */
function premiumTrialHeaderTitle() {
  const left = trialDaysLeft();
  if (left <= 0) return 'Free Trial Ended';
  if (left === 1) return 'Free Trial · 1 Day Left';
  return `Free Trial · ${left} Days Left`;
}

function isPremiumPanelOpen() {
  const body = el('premiumPanelBody');
  return !!(body && body.classList.contains('is-open'));
}

function syncPremiumPanelHeaderTrial() {
  const teaser = el('premiumPanelTeaser');
  const titleEl = el('premiumPanelTitle');
  const card = el('premiumPanelCard');
  const status = el('premiumEntryStatus');
  const open = isPremiumPanelOpen();
  if (card) card.classList.toggle('premium-panel-open', open);
  const trial = isTrialActive() && !isForcePremiumLocked() && !isPremiumActive();
  if (!trial) {
    if (teaser) teaser.hidden = false;
    return;
  }
  if (titleEl) titleEl.textContent = premiumTrialHeaderTitle();
  if (teaser) {
    teaser.textContent = '';
    teaser.hidden = open;
  }
  if (status) status.hidden = true;
}

function isPremiumInAppVisible() {
  return CONFIG.showPremiumInApp === true;
}

function isTrialEntitlementEnforced() {
  if (CONFIG.enforceTrialEntitlement === false) return false;
  if (CONFIG.enforceTrialEntitlement === true || isPremiumInAppVisible()) return true;
  // Old cached bundles without the flag — still enforce on shipped production builds.
  return CONFIG.isProduction === true;
}

function isPremiumSubscribeOffered() {
  return isPremiumInAppVisible() && CONFIG.showPremiumSubscribe === true;
}

function premiumStorePlanPurchasable(planId) {
  if (!isRevenueCatStoreBilling()) return true;
  if (typeof RevenueCatBilling === 'undefined') return false;
  return RevenueCatBilling.hasPlan(planId || 'yearly');
}

function syncPremiumStoreCheckoutState() {
  if (!isPremiumSubscribeOffered() || isPremiumActive()) return;
  const buyBtn = el('premiumCtaBtn');
  const subEl = el('premiumSheetSubtitle');
  const checkoutBlocked = !canApplyLocalPremiumUnlock() && !isStoreBillingConfigured();
  if (!isRevenueCatStoreBilling()) return;
  const ready = typeof RevenueCatBilling !== 'undefined' && RevenueCatBilling.isCatalogReady();
  const selected = selectedPremiumPlan || 'yearly';
  const checkoutReady = typeof RevenueCatBilling.isStoreCheckoutReady === 'function'
    && RevenueCatBilling.isStoreCheckoutReady();
  const planReady = ready && checkoutReady && premiumStorePlanPurchasable(selected);
  if (buyBtn && !checkoutBlocked) {
    buyBtn.disabled = !planReady;
    if (!planReady && !ready) {
      buyBtn.textContent = 'Loading prices…';
    } else if (ready && !checkoutReady) {
      buyBtn.textContent = 'Unavailable';
    }
  }
  if (subEl && !checkoutBlocked) {
    if (!ready) {
      subEl.hidden = false;
      subEl.textContent = 'Loading subscription prices from Google Play…';
    } else if (!checkoutReady) {
      subEl.hidden = false;
      subEl.textContent = 'Both monthly and yearly plans are required. Subscriptions are temporarily unavailable.';
    } else if (subEl.textContent && /Loading subscription|temporarily unavailable|Both monthly/i.test(subEl.textContent)) {
      subEl.hidden = true;
      subEl.textContent = '';
    }
  }
}

function refreshPremiumStoreCatalog(done) {
  if (!isRevenueCatStoreBilling()) {
    if (typeof renderPremiumPlanPrices === 'function') renderPremiumPlanPrices();
    syncPremiumSubscribeCta();
    syncPremiumStoreCheckoutState();
    if (typeof done === 'function') done();
    return;
  }
  RevenueCatBilling.loadOfferings()
    .then(() => {
      if (typeof renderPremiumPlanPrices === 'function') renderPremiumPlanPrices();
      syncPremiumSubscribeCta();
      syncPremiumStoreCheckoutState();
      if (typeof done === 'function') done();
    })
    .catch(() => {
      if (typeof renderPremiumPlanPrices === 'function') renderPremiumPlanPrices();
      syncPremiumSubscribeCta();
      syncPremiumStoreCheckoutState();
      if (typeof done === 'function') done();
    });
}

function syncPremiumSubscribeCta() {
  const buyBtn = el('premiumCtaBtn');
  if (!isPremiumSubscribeOffered()) {
    if (buyBtn) buyBtn.hidden = true;
    const restoreBtn = el('premiumRestoreBtn');
    if (restoreBtn) restoreBtn.hidden = true;
    return;
  }
  if (!buyBtn || buyBtn.hidden) return;
  if (!canApplyLocalPremiumUnlock() && !isStoreBillingConfigured()) {
    buyBtn.textContent = 'Coming in the app';
    buyBtn.disabled = true;
    return;
  }
  if (isRevenueCatStoreBilling()) {
    const plan = PREMIUM_PLANS[selectedPremiumPlan] || PREMIUM_PLANS.yearly;
    buyBtn.disabled = !premiumStorePlanPurchasable(plan.id);
  } else {
    buyBtn.disabled = false;
  }
  const plan = PREMIUM_PLANS[selectedPremiumPlan] || PREMIUM_PLANS.yearly;
  const q = typeof getPremiumPlanQuotes === 'function' ? getPremiumPlanQuotes() : null;
  if (q) {
    buyBtn.textContent = plan.id === 'yearly'
      ? `Subscribe — Annual ${q.yearly}`
      : `Subscribe — Monthly ${q.monthly}`;
  } else {
    buyBtn.textContent = plan.id === 'yearly' ? 'Subscribe — Annual' : 'Subscribe — Monthly';
  }
}

function getPremiumRecord() {
  try {
    const raw = localStorage.getItem(PREMIUM_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (!rec || typeof rec !== 'object') return null;
    return rec;
  } catch (e) {
    return null;
  }
}

/** Fail-closed: trusted premium records must carry a valid, unexpired expiresAt. */
function premiumRecordHasValidExpiry(rec) {
  if (!rec) return false;
  if (rec.expiresAt == null || rec.expiresAt === '') return false;
  const exp = new Date(rec.expiresAt).getTime();
  if (Number.isNaN(exp)) return false;
  return Date.now() <= exp;
}

function isPremiumActive() {
  if (isStoreBillingConfigured()) {
    return premiumActiveFromRevenueCat();
  }
  const rec = getPremiumRecord();
  if (!premiumRecordGrantsAccess(rec)) return false;
  return premiumRecordHasValidExpiry(rec);
}

/** Trial expires at start + (policyDays × 24h). Active while now < returned ms. */
function getTrialEndTimestamp(start, policyDays) {
  const days = policyDays || TRIAL_DAYS;
  return start.getTime() + days * MS_PER_DAY;
}

/** First app open only — not journey day, not dailyLog span. */
function reconcileTrialClock(data) {
  try {
    const lsStart = getTrialStartedAt();
    const dataStart = data && data.trialStartedAt ? new Date(data.trialStartedAt) : null;
    let anchorMs = null;
    if (lsStart && !Number.isNaN(lsStart.getTime())) {
      anchorMs = lsStart.getTime();
    } else if (dataStart && !Number.isNaN(dataStart.getTime())) {
      anchorMs = dataStart.getTime();
    } else {
      anchorMs = Date.now();
    }
    const iso = new Date(anchorMs).toISOString();
    setTrialStartedAtISO(iso);
    if (data) data.trialStartedAt = iso;
    return iso;
  } catch (e) {
    return null;
  }
}

function ensureTrialStarted(data) {
  reconcileTrialClock(data || (typeof Tracker !== 'undefined' && Tracker.data) || null);
}

function getTrialStartedAt() {
  try {
    const raw = localStorage.getItem(TRIAL_KEY);
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}

function isTrialGatedPremiumLocked(data) {
  if (typeof isTrialEntitlementEnforced !== 'function' || !isTrialEntitlementEnforced()) return false;
  if (typeof hasPremiumAccess !== 'function') return false;
  return !hasPremiumAccess(data);
}

/** AUDIT-C screening, re-test, and reduction/withdrawal safety copy — never paywalled. */
function isAuditSafetyGuidanceLocked() {
  return false;
}

function isTrialActive(data) {
  if (isPremiumActive()) return false;
  const start = getTrialStartedAt();
  if (!start) return false;
  return Date.now() < getTrialEndTimestamp(start);
}

function journeyAttemptForPremiumLock(data) {
  let d = data;
  if (!d && typeof Tracker !== 'undefined' && Tracker.data) d = Tracker.data;
  if (!d && typeof DataManager !== 'undefined') {
    try { d = DataManager.load(); } catch (e) { d = null; }
  }
  return Math.max(1, parseInt(d && d.attempt, 10) || 1);
}

function isJourneyAttemptPremiumLocked(data, fromAttempt) {
  if (!isTrialEntitlementEnforced()) return false;
  if (isForcePremiumLocked()) return true;
  if (hasPremiumAccess(data)) return false;
  const from = typeof fromAttempt === 'number' ? fromAttempt : 3;
  return journeyAttemptForPremiumLock(data) >= from;
}

/** Dashboard Best Score tile — from BEST_SCORE_CARD_LOCK_FROM_ATTEMPT (J3). */
function isBestScoreCardLocked(data) {
  const from = typeof BEST_SCORE_CARD_LOCK_FROM_ATTEMPT === 'number'
    ? BEST_SCORE_CARD_LOCK_FROM_ATTEMPT
    : 3;
  return isJourneyAttemptPremiumLocked(data, from);
}

/** History, Best Scores, Lifetime — from journey 4, or when journey 3 has ended (pending reset). */
function isBestScoreLocked(data) {
  if (!isTrialEntitlementEnforced()) return false;
  if (isForcePremiumLocked()) return true;
  if (hasPremiumAccess(data)) return false;
  const from = typeof BEST_SCORE_LOCK_FROM_ATTEMPT === 'number'
    ? BEST_SCORE_LOCK_FROM_ATTEMPT
    : 3;
  let d = data;
  if (!d && typeof Tracker !== 'undefined' && Tracker.data) d = Tracker.data;
  if (!d && typeof DataManager !== 'undefined') {
    try { d = DataManager.load(); } catch (e) { d = null; }
  }
  const attempt = journeyAttemptForPremiumLock(d);
  if (attempt >= from) return true;
  if (attempt === from - 1 && d && d.journeyPendingReset) return true;
  return false;
}

/** Calendar: J3+ tier lock, or trial ended on J1–2. */
function isCalendarLocked(data) {
  if (!isTrialEntitlementEnforced()) return false;
  if (isForcePremiumLocked()) return true;
  if (isPremiumActive()) return false;
  const fromCal = typeof CALENDAR_LOCK_FROM_ATTEMPT === 'number'
    ? CALENDAR_LOCK_FROM_ATTEMPT
    : 3;
  if (isJourneyAttemptPremiumLocked(data, fromCal)) return true;
  return typeof hasPremiumAccess === 'function' && !hasPremiumAccess(data);
}

const FORCE_PREMIUM_LOCKED_KEY = 'sj_forcePremiumLocked';

function isForcePremiumLocked() {
  if (!CONFIG.showTestUI) return false;
  try { return sessionStorage.getItem(FORCE_PREMIUM_LOCKED_KEY) === '1'; } catch (e) { return false; }
}

function setForcePremiumLocked(locked) {
  try {
    if (locked) sessionStorage.setItem(FORCE_PREMIUM_LOCKED_KEY, '1');
    else sessionStorage.removeItem(FORCE_PREMIUM_LOCKED_KEY);
  } catch (e) {}
}

function hasPremiumAccess(data) {
  if (!isTrialEntitlementEnforced()) return !isForcePremiumLocked();
  if (isForcePremiumLocked()) return false;
  return isPremiumActive() || isTrialActive(data);
}

function setTrialStartedAtISO(iso) {
  try {
    if (iso == null) localStorage.removeItem(TRIAL_KEY);
    else localStorage.setItem(TRIAL_KEY, iso);
    if (typeof Tracker !== 'undefined' && Tracker.data) {
      Tracker.data.trialStartedAt = iso || null;
    }
  } catch (e) {}
}

/** Dev A1: real free/trial entitlement (not just a visual preview). */
function applyEntitlementTestState(mode) {
  setForcePremiumLocked(false);
  clearPremiumRecord();
  if (mode === 'trial') {
    setTrialStartedAtISO(new Date().toISOString());
    return;
  }
  if (mode === 'free') {
    const past = new Date(Date.now() - (TRIAL_DAYS * MS_PER_DAY + 3600000));
    setTrialStartedAtISO(past.toISOString());
  }
}

function getEntitlementTestMode() {
  if (isForcePremiumLocked()) return 'locked-preview';
  if (isPremiumActive()) return 'premium';
  if (isTrialActive()) return 'trial';
  return 'free';
}

function updatePremiumLockTestBtn() {
  const mode = getEntitlementTestMode();
  const trialBtn = el('testPremiumTrialBtn');
  const freeBtn = el('testPremiumFreeBtn');
  if (trialBtn) {
    trialBtn.classList.toggle('is-active', mode === 'trial');
    trialBtn.title = 'A1: active trial — Premium unlocked, status shows Trial · Xd';
  }
  if (freeBtn) {
    freeBtn.classList.toggle('is-active', mode === 'free');
    freeBtn.title = 'A1: trial expired — Calendar / Journeys / Lifetime / Knowledge locked, status Upgrade';
  }
}

function trialDaysLeft(data) {
  const start = getTrialStartedAt();
  if (!start) return TRIAL_DAYS;
  let d = data;
  if (!d && typeof Tracker !== 'undefined' && Tracker.data) d = Tracker.data;
  if (typeof isTrialActive === 'function' && !isTrialActive(d)) return 0;
  const remainingMs = getTrialEndTimestamp(start) - Date.now();
  if (remainingMs <= 0) return 0;
  const days = Math.ceil(remainingMs / MS_PER_DAY);
  return Math.max(1, Math.min(TRIAL_DAYS, days));
}

function reconcileStubPremiumWithTrial() {
  if (!isTrialEntitlementEnforced()) return;
  const rec = getPremiumRecord();
  if (!rec || !rec.active) return;
  if (rec.source === 'local-stub' && !canApplyLocalPremiumUnlock()) {
    clearPremiumRecord();
  }
}

/** Re-render when wall-clock trial crosses expired (app open or resume). */
function refreshEntitlementIfChanged(data) {
  if (!isTrialEntitlementEnforced()) return;
  reconcileStubPremiumWithTrial();
  const d = data || (typeof Tracker !== 'undefined' && Tracker.data) || null;
  if (!d) return;
  const access = hasPremiumAccess(d);
  if (typeof Tracker !== 'undefined') {
    if (Tracker._lastPremiumAccess === access) return;
    Tracker._lastPremiumAccess = access;
  }
  if (typeof UI !== 'undefined' && UI.renderAll) UI.renderAll(d);
}

function journeyHistoryCap() {
  return hasPremiumAccess() ? MAX_COMPLETED_JOURNEYS_PREMIUM : MAX_COMPLETED_JOURNEYS;
}

/** UI/history cap only — never mutate persisted completedJourneys. */
function completedJourneysForDisplay(data) {
  const all = (data && data.completedJourneys) || [];
  const cap = journeyHistoryCap();
  if (all.length <= cap) return all;
  return all.slice(-cap);
}

/** UI cap for archived streak segments — full history stays in pastJourneyStreaks. */
function pastJourneyStreaksForDisplay(data) {
  const all = (data && data.pastJourneyStreaks) || [];
  const cap = journeyHistoryCap();
  if (all.length <= cap) return all;
  return all.slice(-cap);
}

function isJourneyMilestonePremiumLocked(days) {
  return !hasPremiumAccess() && (days | 0) > FREE_JOURNEY_MILESTONE_DAYS;
}

function savePremiumRecord(rec) {
  try { localStorage.setItem(PREMIUM_KEY, JSON.stringify(rec)); } catch (e) {}
}

function bootstrapStoreEntitlement() {
  if (!isRevenueCatStoreBilling()) return;
  const syncGeneration = captureRcEntitlementSyncGeneration();
  RevenueCatBilling.loadOfferings().catch(() => {});
  RevenueCatBilling.syncEntitlement()
    .then((customerInfo) => {
      applyRevenueCatCustomerInfo(customerInfo, syncGeneration);
      if (typeof refreshEntitlementIfChanged === 'function') {
        refreshEntitlementIfChanged(typeof Tracker !== 'undefined' ? Tracker.data : null);
      }
    })
    .catch((err) => {
      console.warn('[10Drinks] RevenueCat sync skipped:', err && (err.message || err));
    });
}

function storePurchaseEntitlementPendingToast() {
  showToast('Purchase went through Google Play. Tap Restore purchase if Premium is not visible yet.');
}

/** Apply purchase CustomerInfo; one refresh before asking user to restore (no repeat purchase). */
function completeStorePurchaseFromCustomerInfo(customerInfo, syncGeneration) {
  if (applyRevenueCatCustomerInfo(customerInfo, syncGeneration)) {
    return Promise.resolve(true);
  }
  return RevenueCatBilling.syncEntitlement()
    .then((fresh) => applyRevenueCatCustomerInfo(fresh, syncGeneration))
    .catch(() => false);
}

function finalizeStorePurchaseUi(active) {
  if (!active) {
    storePurchaseEntitlementPendingToast();
    return;
  }
  renderPremiumEntry();
  if (Tracker.data) UI.renderAll(Tracker.data);
  Tracker.closePremium();
  showToast('Premium is active. Thank you!');
}

function clearPremiumLocalStorage() {
  try { localStorage.removeItem(PREMIUM_KEY); } catch (e) {}
}

function clearPremiumRecord() {
  clearRcPremiumState();
  clearPremiumLocalStorage();
}

/** Import / delete all: drop local premium mirror; same RC user — re-fetch Play entitlement. */
function clearPremiumMirrorAndResyncStore() {
  clearPremiumLocalStorage();
  clearRcPremiumState();
  invalidateRcEntitlementSyncGeneration();
  bootstrapStoreEntitlement();
}

function makePremiumLockOverlay(title, sub, options) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'premium-lock-overlay';
  if (options && options.compact) btn.classList.add('premium-lock-overlay--compact');
  if (isPremiumSubscribeOffered()) {
    btn.onclick = () => Tracker.openPremium();
  } else {
    btn.onclick = () => {
      if (typeof showToast === 'function') {
        showToast('Your free trial has ended. Premium subscriptions are coming soon.');
      }
    };
  }
  if (options && options.compact) {
    btn.setAttribute('aria-label', title ? `${title} — locked` : 'Locked');
    btn.innerHTML = '<span class="lock-icon" aria-hidden="true">🔒</span><span class="lock-title">Locked</span>';
    return btn;
  }
  const cta = isPremiumSubscribeOffered() ? 'Unlock with Premium' : 'Free trial ended';
  btn.innerHTML = `<span class="lock-icon">🔒</span>
    <span class="lock-title">${title}</span>
    <span class="lock-sub">${sub}</span>
    <span class="lock-cta">${cta}</span>`;
  return btn;
}

function lockTabPanel(tabEl, locked, title, sub) {
  if (!tabEl) return;
  tabEl.classList.toggle('feature-locked', !!locked);
  let ov = tabEl.querySelector('.premium-lock-overlay');
  if (locked && !ov) {
    tabEl.appendChild(makePremiumLockOverlay(title, sub));
  } else if (!locked && ov) {
    ov.remove();
  }
}

function clearPremiumLockUi(rootEl) {
  if (!rootEl) return;
  rootEl.classList.remove('feature-locked');
  rootEl.querySelectorAll('.premium-lock-overlay').forEach((node) => node.remove());
}

function setFeatureLocked(cardEl, locked, title, sub, options) {
  if (!cardEl) return;
  if (!locked) {
    clearPremiumLockUi(cardEl);
    return;
  }
  clearPremiumLockUi(cardEl);
  cardEl.classList.add('feature-locked');
  cardEl.appendChild(makePremiumLockOverlay(title, sub, options));
}

/** Collapsible cards: lock only the body so Show/Hide stays tappable when unlocked. */
function setCollapsibleFeatureLocked(cardEl, bodyEl, locked, title, sub, options) {
  if (!cardEl || !bodyEl) {
    setFeatureLocked(cardEl, locked, title, sub, options);
    return;
  }
  clearPremiumLockUi(cardEl);
  clearPremiumLockUi(bodyEl);
  if (!locked) return;
  bodyEl.classList.add('feature-locked');
  bodyEl.appendChild(makePremiumLockOverlay(title, sub, options));
}

const JOURNEY_TIER_COLLAPSIBLES = [
  ['lifetimeStatsCard', 'lifetimeStatsBody'],
];

function clearJourneyTierCollapsibleLocks() {
  JOURNEY_TIER_COLLAPSIBLES.forEach(([cardId, bodyId]) => {
    clearPremiumLockUi(el(cardId));
    clearPremiumLockUi(el(bodyId));
  });
}

function collapseCollapsiblePanel(bodyId, btnId, headerId) {
  const body = el(bodyId);
  if (body) {
    body.classList.remove('panel-open');
    body.style.display = 'none';
  }
  const btn = el(btnId);
  if (btn) btn.textContent = 'Show \u25be';
  const header = el(headerId);
  if (header) header.setAttribute('aria-expanded', 'false');
}

function applyCompactCardLock(cardId, bodyId, btnId, headerId, locked, ariaTitle) {
  const card = el(cardId);
  const body = el(bodyId);
  if (!card) return;
  if (locked) {
    collapseCollapsiblePanel(bodyId, btnId, headerId);
    if (body) clearPremiumLockUi(body);
    setFeatureLocked(card, true, ariaTitle, '', { compact: true });
    return;
  }
  clearPremiumLockUi(card);
  setCollapsibleFeatureLocked(card, body, false);
}

function applyTrialGatedCardLock(cardId, bodyId, btnId, headerId, locked, title, _sub) {
  applyCompactCardLock(cardId, bodyId, btnId, headerId, locked, title);
}

function unlockAllPremiumFeatures() {
  const ids = [
    'bestScoreCard', 'monthGridCard', 'journeyChartCard', 'bestPerformancesCard', 'lifetimeStatsCard',
    'didYouKnowCard', 'riskMeterCard', 'reductionTargetCard',
  ];
  ids.forEach((id) => setFeatureLocked(el(id), false));
  clearPremiumLockUi(el('monthGridBody'));
  clearPremiumLockUi(el('riskMeterBody'));
  clearJourneyTierCollapsibleLocks();
  const segBtns = document.querySelectorAll('.seg-btn');
  segBtns.forEach((btn) => btn.classList.remove('seg-locked'));
  lockTabPanel(el('streakTabContent'), false);
  lockTabPanel(el('journeyMilestoneTabContent'), false);
  lockTabPanel(el('progressTabContent'), false);
}

function renderPremiumLocks(data) {
  if (!isTrialEntitlementEnforced()) {
    unlockAllPremiumFeatures();
    return;
  }
  const unlocked = hasPremiumAccess(data);

  const segBtns = document.querySelectorAll('.seg-btn');
  segBtns.forEach((btn, i) => {
    if (i <= 2) btn.classList.toggle('seg-locked', !unlocked);
  });

  lockTabPanel(
    el('streakTabContent'),
    !unlocked,
    'Streak milestones are Premium',
    'Track streak milestones after your free trial with Premium.'
  );
  lockTabPanel(
    el('journeyMilestoneTabContent'),
    !unlocked,
    'Journey milestones are Premium',
    'View journey milestone progress after your free trial with Premium.'
  );
  lockTabPanel(
    el('progressTabContent'),
    !unlocked,
    'Science is Premium',
    'See how your body recovers over time after your free trial.'
  );

  setFeatureLocked(
    el('bestScoreCard'),
    isBestScoreCardLocked(data),
    'Best Score',
    'Your best journey score unlocks with Premium from Journey 3 onward.'
  );
  applyTrialGatedCardLock(
    'monthGridCard',
    'monthGridBody',
    'monthGridToggleBtn',
    'monthGridPanelToggle',
    isCalendarLocked(data),
    'Calendar',
    'Log and review days on the calendar with Premium from Journey 3 onward.'
  );
  const journeyTierLocked = isBestScoreLocked(data);
  applyCompactCardLock(
    'journeyChartCard',
    'journeyChartBody',
    'journeyChartToggleBtn',
    'journeyChartPanelToggle',
    journeyTierLocked,
    'History'
  );
  applyCompactCardLock(
    'bestPerformancesCard',
    'bestPerformancesBody',
    'bestPerformancesToggleBtn',
    'bestPerformancesPanelToggle',
    journeyTierLocked,
    'Best Scores'
  );
  if (!journeyTierLocked) clearJourneyTierCollapsibleLocks();
  setCollapsibleFeatureLocked(
    el('lifetimeStatsCard'),
    el('lifetimeStatsBody'),
    journeyTierLocked,
    'Lifetime',
    '',
    journeyTierLocked ? { compact: true } : null
  );
  setFeatureLocked(el('didYouKnowCard'), !unlocked, 'Knowledge cards', 'Extra insights are part of Premium.');
  clearPremiumLockUi(el('riskMeterCard'));
  clearPremiumLockUi(el('riskMeterBody'));
  setCollapsibleFeatureLocked(el('riskMeterCard'), el('riskMeterBody'), false);
  setFeatureLocked(el('reductionTargetCard'), false);
}

function renderPremiumPanelContent() {
  const daysEl = el('premiumPanelDaysLeft');
  const noteEl = el('premiumPanelActiveNote');
  const subBtn = el('premiumPanelSubscribeBtn');
  const restoreBtn = el('premiumPanelRestoreBtn');
  const active = isPremiumActive() && !isForcePremiumLocked();
  const trial = isTrialActive() && !isForcePremiumLocked();

  if (daysEl) {
    if (active) {
      daysEl.textContent = '';
    } else if (trial) {
      daysEl.textContent = '';
      daysEl.classList.remove('is-ended');
    } else {
      daysEl.textContent = 'Trial ended';
      daysEl.classList.add('is-ended');
    }
  }
  if (noteEl) {
    if (active) {
      noteEl.hidden = false;
      noteEl.textContent = 'You have full Premium access on this device.';
    } else {
      noteEl.hidden = true;
      noteEl.textContent = '';
    }
  }
  const offered = isPremiumSubscribeOffered();
  if (subBtn) subBtn.hidden = !!active || !offered;
  if (restoreBtn) restoreBtn.hidden = !!active || !offered;
}

function renderPremiumEntry() {
  const status = el('premiumEntryStatus');
  const teaser = el('premiumPanelTeaser') || el('settingsPremiumTeaser');
  const card = el('premiumPanelCard');
  const titleEl = el('premiumPanelTitle');
  if (!isPremiumInAppVisible()) {
    if (card) card.style.display = 'none';
    return;
  }
  if (card) {
    const showInSettings = CONFIG.showPremiumInSettings !== false;
    card.style.display = showInSettings ? '' : 'none';
    if (!showInSettings) return;
  }
  if (!status && !teaser && !card) return;

  let badge = 'Upgrade';
  let sub = 'Trial & subscriptions';
  let showBadge = true;
  let isPremium = false;
  let trial = false;

  if (isForcePremiumLocked()) {
    badge = 'Locked';
    sub = 'Preview mode';
    isPremium = false;
  } else if (isPremiumActive()) {
    badge = 'Active';
    sub = 'Full access on this device';
    isPremium = true;
  } else if (isTrialActive()) {
    badge = '';
    sub = '';
    showBadge = false;
    trial = true;
  } else {
    badge = isPremiumSubscribeOffered() ? 'Upgrade' : '';
    sub = isPremiumSubscribeOffered()
      ? 'Trial ended — subscribe in app'
      : 'Trial ended — journey logging still available';
    if (!isPremiumSubscribeOffered()) showBadge = false;
  }

  if (titleEl) titleEl.textContent = trial ? premiumTrialHeaderTitle() : '✦ Premium';
  if (card) {
    card.classList.toggle('premium-active-state', isPremium);
    card.classList.toggle('premium-trial-state', trial);
  }
  if (status) {
    status.hidden = !showBadge || trial;
    status.textContent = badge;
    status.classList.toggle('is-premium', isPremium);
  }
  if (teaser) teaser.textContent = trial ? '' : sub;
  renderPremiumPanelContent();
  syncPremiumPanelHeaderTrial();
}

Tracker.togglePremiumPanel = function() {
  const body = el('premiumPanelBody');
  const toggle = el('premiumPanelToggle');
  const chev = el('premiumPanelChevron');
  if (!body) return;
  const open = body.classList.contains('is-open');
  body.classList.toggle('is-open', !open);
  body.style.display = '';
  if (toggle) toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
  if (chev) chev.classList.toggle('open', !open);
  if (!open) renderPremiumPanelContent();
  syncPremiumPanelHeaderTrial();
};

// Paywall sheet + test lock (attached to Tracker for onclick="SoberTracker.…")
// Load this file after journey.js so Tracker exists.

/** A1 — switch device to trial (unlocked) or free/expired (locked). Dev only. */
Tracker.setEntitlementTest = function(mode) {
  if (!CONFIG.showTestUI) return;
  if (mode !== 'trial' && mode !== 'free') return;
  applyEntitlementTestState(mode);
  updatePremiumLockTestBtn();
  renderPremiumEntry();
  if (this.data) UI.renderAll(this.data);
  if (mode === 'trial') {
    const left = trialDaysLeft();
    showToast(left <= 1
      ? 'A1 Trial: badge “last day”, features unlocked'
      : `A1 Trial: badge “Trial · ${left}d”, features unlocked`);
  } else {
    showToast('A1 Free: status “Upgrade”, Premium features locked');
  }
};

function renderPremiumCheckoutSheet() {
  const titleEl = el('premiumSheetTitle');
  const subEl = el('premiumSheetSubtitle');
  const priceBlock = el('premiumPriceBlock');
  const laterBtn = el('premiumLaterBtn');
  const buyBtn = el('premiumCtaBtn');
  const restoreBtn = el('premiumRestoreBtn');
  if (!titleEl) return;

  const active = isPremiumActive();

  if (active) {
    titleEl.textContent = 'You’re Premium';
    if (subEl) {
      subEl.hidden = false;
      subEl.textContent = 'Full Premium access is active on this device.';
    }
    if (priceBlock) priceBlock.hidden = true;
    if (laterBtn) laterBtn.textContent = 'Close';
    if (buyBtn) buyBtn.hidden = true;
    if (restoreBtn) restoreBtn.hidden = true;
  } else if (!isPremiumSubscribeOffered()) {
    titleEl.textContent = 'Premium';
    if (subEl) {
      subEl.hidden = false;
      subEl.textContent = isTrialActive()
        ? 'Your free trial includes full Premium access. Subscriptions are not available in this test build yet.'
        : 'Premium subscriptions are not available in this test build yet. You can still use journey logging.';
    }
    if (priceBlock) priceBlock.hidden = true;
    if (laterBtn) laterBtn.textContent = 'Close';
    if (buyBtn) buyBtn.hidden = true;
    if (restoreBtn) restoreBtn.hidden = true;
  } else {
    titleEl.textContent = 'Choose a plan';
    const checkoutBlocked = !canApplyLocalPremiumUnlock() && !isStoreBillingConfigured();
    if (subEl) {
      if (checkoutBlocked) {
        subEl.hidden = false;
        subEl.textContent = isTrialActive()
          ? 'Subscriptions are coming in the mobile app. Your free trial still includes full Premium access.'
          : 'Subscriptions are coming in the mobile app. You can keep using basic Journey logging on the web.';
      } else {
        subEl.hidden = true;
        subEl.textContent = '';
      }
    }
    if (priceBlock) priceBlock.hidden = false;
    if (laterBtn) laterBtn.textContent = isTrialActive() ? 'Not now' : 'Continue with basic logging';
    if (buyBtn) buyBtn.hidden = false;
    if (restoreBtn) restoreBtn.hidden = false;
    refreshPremiumStoreCatalog(() => {
      Tracker.selectPremiumPlan(selectedPremiumPlan || 'yearly');
    });
  }
}

function openPremiumOverlay() {
  const overlay = el('premiumOverlay');
  if (overlay) {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    if (typeof lockBodyScroll === 'function') lockBodyScroll();
    else document.body.classList.add('modal-open');
  }
}

/** Locked features / unlock CTAs — opens plan picker directly. */
Tracker.openPremium = function() {
  if (!isPremiumInAppVisible()) return;
  selectedPremiumPlan = selectedPremiumPlan || 'yearly';
  renderPremiumCheckoutSheet();
  openPremiumOverlay();
};

/** Premium tab Subscribe — same checkout popup (monthly / annual). */
Tracker.openPremiumCheckout = function() {
  if (!isPremiumSubscribeOffered()) return;
  if (isPremiumActive()) {
    showToast('Premium is already active on this device.');
    return;
  }
  if (typeof this.closeSettings === 'function') this.closeSettings();
  selectedPremiumPlan = selectedPremiumPlan || 'yearly';
  renderPremiumCheckoutSheet();
  openPremiumOverlay();
};

Tracker.closePremium = function() {
  const overlay = el('premiumOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  }
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  else document.body.classList.remove('modal-open');
};

Tracker.selectPremiumPlan = function(planId) {
  if (!PREMIUM_PLANS[planId]) return;
  selectedPremiumPlan = planId;
  document.querySelectorAll('#premiumPriceBlock .premium-plan').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.plan === planId);
  });
  syncPremiumSubscribeCta();
  syncPremiumStoreCheckoutState();
};

Tracker.subscribePremium = function() {
  if (!isPremiumSubscribeOffered()) return;
  if (isPremiumActive()) {
    showToast('Premium is already active on this device.');
    return;
  }
  if (!canApplyLocalPremiumUnlock() && !isStoreBillingConfigured()) {
    showToast('Premium subscriptions will be available in the mobile app.');
    return;
  }
  if (isStoreBillingConfigured()) {
    if (!isRevenueCatStoreBilling()) {
      showToast('Install from Google Play to subscribe.');
      return;
    }
    const plan = PREMIUM_PLANS[selectedPremiumPlan] || PREMIUM_PLANS.yearly;
    if (!premiumStorePlanPurchasable(plan.id)) {
      showToast('Subscription prices are not available yet. Try again in a moment.');
      refreshPremiumStoreCatalog();
      return;
    }
    if (rcBillingOpInFlight) return;
    rcBillingOpInFlight = true;
    const syncGeneration = captureRcEntitlementSyncGeneration();
    RevenueCatBilling.purchasePlan(plan.id)
      .then((customerInfo) => completeStorePurchaseFromCustomerInfo(customerInfo, syncGeneration))
      .then((active) => finalizeStorePurchaseUi(active))
      .catch((err) => {
        if (isRevenueCatPurchaseUserCancelled(err)) return;
        if (isRevenueCatPurchasePending(err)) {
          showToast('Payment is pending with Google. Premium unlocks when it completes.');
          return;
        }
        showToast('Purchase did not complete. Try again or use Restore purchase.');
        console.warn('[10Drinks] RevenueCat purchase failed:', err);
      })
      .finally(() => {
        rcBillingOpInFlight = false;
      });
    return;
  }
  const plan = PREMIUM_PLANS[selectedPremiumPlan] || PREMIUM_PLANS.yearly;
  const expires = new Date();
  expires.setDate(expires.getDate() + (plan.days | 0));
  savePremiumRecord({
    active: true,
    plan: plan.id,
    startedAt: new Date().toISOString(),
    expiresAt: expires.toISOString(),
    source: 'local-stub',
  });
  renderPremiumEntry();
  if (this.data) UI.renderAll(this.data);
  this.closePremium();
  showToast('Premium unlocked (dev stub — test UI only).');
};

Tracker.restorePremium = function() {
  if (!isPremiumSubscribeOffered()) return;
  if (isStoreBillingConfigured()) {
    if (!isRevenueCatStoreBilling()) {
      showToast('Install from Google Play to restore purchases.');
      return;
    }
    if (rcBillingOpInFlight) return;
    rcBillingOpInFlight = true;
    const syncGeneration = captureRcEntitlementSyncGeneration();
    RevenueCatBilling.restorePurchases()
      .then((customerInfo) => {
        if (!applyRevenueCatCustomerInfo(customerInfo, syncGeneration)) {
          showToast('No active subscription found for this Google account.');
          return;
        }
        renderPremiumEntry();
        if (Tracker.data) UI.renderAll(Tracker.data);
        Tracker.closePremium();
        showToast('Premium restored on this device.');
      })
      .catch((err) => {
        showToast('Could not restore purchases. Try again on Google Play.');
        console.warn('[10Drinks] RevenueCat restore failed:', err);
      })
      .finally(() => {
        rcBillingOpInFlight = false;
      });
    return;
  }
  if (isPremiumActive()) {
    renderPremiumEntry();
    showToast('Premium restored on this device.');
    this.closePremium();
    return;
  }
  showToast('No Premium purchase found on this device yet.');
};

