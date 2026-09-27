/* ===== src/premium/premium.js ===== */
'use strict';
// PREMIUM — entitlement layer (trial + feature gates).
// Production web: trial only; local-stub unlock requires CONFIG.showTestUI (dev).
// ═══════════════════════════════════════════════════════════════
let selectedPremiumPlan = 'yearly';

function isLocalStubBilling() {
  return (CONFIG.premiumBilling || 'local-stub') === 'local-stub';
}

function isStoreBillingConfigured() {
  return CONFIG.premiumBilling === 'store';
}

/** True only in dev when test UI is on — never for public production web. */
function canApplyLocalPremiumUnlock() {
  return isLocalStubBilling() && CONFIG.showTestUI === true;
}

function premiumRecordGrantsAccess(rec) {
  if (!rec || !rec.active) return false;
  if (rec.source === 'local-stub' && isLocalStubBilling() && !canApplyLocalPremiumUnlock()) {
    return false;
  }
  return true;
}

function premiumDaysLeftLabel() {
  const left = trialDaysLeft();
  if (left <= 0) return 'Trial ended';
  if (left === 1) return '1 day left';
  return `${left} days left`;
}

function isPremiumInAppVisible() {
  return CONFIG.showPremiumInApp === true;
}

function isPremiumSubscribeOffered() {
  return isPremiumInAppVisible() && CONFIG.showPremiumSubscribe === true;
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
  buyBtn.disabled = false;
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

function isPremiumActive() {
  const rec = getPremiumRecord();
  if (!premiumRecordGrantsAccess(rec)) return false;
  if (rec.expiresAt) {
    const exp = new Date(rec.expiresAt).getTime();
    if (!Number.isNaN(exp) && Date.now() > exp) return false;
  }
  return true;
}

function migrateTrialPolicyIfNeeded() {
  try {
    let stored = parseInt(localStorage.getItem(TRIAL_POLICY_KEY), 10);
    if (Number.isNaN(stored)) {
      if (localStorage.getItem(TRIAL_KEY)) stored = LEGACY_TRIAL_DAYS;
      else {
        localStorage.setItem(TRIAL_POLICY_KEY, String(TRIAL_DAYS));
        return;
      }
    }
    if (TRIAL_DAYS > stored) {
      const start = getTrialStartedAt();
      const stillInOldWindow = start
        && Date.now() <= start.getTime() + (stored * MS_PER_DAY);
      if (stillInOldWindow) {
        setTrialStartedAtISO(new Date().toISOString());
      }
      localStorage.setItem(TRIAL_POLICY_KEY, String(TRIAL_DAYS));
    } else if (stored !== TRIAL_DAYS) {
      localStorage.setItem(TRIAL_POLICY_KEY, String(TRIAL_DAYS));
    }
  } catch (e) {}
}

function ensureTrialStarted() {
  try {
    migrateTrialPolicyIfNeeded();
    if (!localStorage.getItem(TRIAL_KEY)) {
      localStorage.setItem(TRIAL_KEY, new Date().toISOString());
      localStorage.setItem(TRIAL_POLICY_KEY, String(TRIAL_DAYS));
    }
  } catch (e) {}
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

function isTrialActive() {
  if (isPremiumActive()) return false;
  const start = getTrialStartedAt();
  if (!start) return true; // first session before stamp — treat as trial
  const ends = start.getTime() + (TRIAL_DAYS * MS_PER_DAY);
  return Date.now() <= ends;
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

function hasPremiumAccess() {
  if (!isPremiumInAppVisible()) return !isForcePremiumLocked();
  if (isForcePremiumLocked()) return false;
  return isPremiumActive() || isTrialActive();
}

function setTrialStartedAtISO(iso) {
  try {
    if (iso == null) localStorage.removeItem(TRIAL_KEY);
    else localStorage.setItem(TRIAL_KEY, iso);
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
    // Trial started > TRIAL_DAYS ago → expired free tier
    const past = new Date(Date.now() - ((TRIAL_DAYS + 1) * MS_PER_DAY));
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
  // Legacy single-button preview (optional; may be removed from HTML)
  const btn = el('testPremiumLockBtn');
  if (!btn) return;
  const locked = isForcePremiumLocked();
  btn.textContent = locked ? '✓ Default' : '🔒 Locked';
  btn.classList.toggle('is-locked-preview', locked);
  btn.title = locked
    ? 'Showing locked UI — tap for default (unlocked) UI'
    : 'Showing default UI — tap for locked Premium UI';
}

function trialDaysLeft() {
  const start = getTrialStartedAt();
  if (!start) return TRIAL_DAYS;
  const ends = start.getTime() + (TRIAL_DAYS * MS_PER_DAY);
  return Math.max(0, Math.ceil((ends - Date.now()) / MS_PER_DAY));
}

function journeyHistoryCap() {
  return hasPremiumAccess() ? MAX_COMPLETED_JOURNEYS_PREMIUM : MAX_COMPLETED_JOURNEYS;
}

function isJourneyMilestonePremiumLocked(days) {
  return !hasPremiumAccess() && (days | 0) > FREE_JOURNEY_MILESTONE_DAYS;
}

function savePremiumRecord(rec) {
  try { localStorage.setItem(PREMIUM_KEY, JSON.stringify(rec)); } catch (e) {}
}

function clearPremiumRecord() {
  try { localStorage.removeItem(PREMIUM_KEY); } catch (e) {}
}

function makePremiumLockOverlay(title, sub) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'premium-lock-overlay';
  btn.onclick = () => Tracker.openPremium();
  btn.innerHTML = `<span class="lock-icon">🔒</span>
    <span class="lock-title">${title}</span>
    <span class="lock-sub">${sub}</span>
    <span class="lock-cta">Unlock with Premium</span>`;
  return btn;
}

function setFeatureLocked(cardEl, locked, title, sub) {
  if (!cardEl) return;
  cardEl.classList.toggle('feature-locked', !!locked);
  const existing = cardEl.querySelector('.premium-lock-overlay');
  if (!locked) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;
  cardEl.appendChild(makePremiumLockOverlay(title, sub));
}

function unlockAllPremiumFeatures() {
  const ids = [
    'monthGridCard', 'journeyChartCard', 'bestPerformancesCard', 'lifetimeStatsCard',
    'didYouKnowCard', 'riskMeterCard', 'reductionTargetCard',
  ];
  ids.forEach((id) => setFeatureLocked(el(id), false));
  const segBtns = document.querySelectorAll('.seg-btn');
  if (segBtns[2]) segBtns[2].classList.remove('seg-locked');
  const progressTab = el('progressTabContent');
  if (progressTab) {
    progressTab.classList.remove('feature-locked');
    const ov = progressTab.querySelector('.premium-lock-overlay');
    if (ov) ov.remove();
  }
}

function renderPremiumLocks(data) {
  if (!isPremiumInAppVisible()) {
    unlockAllPremiumFeatures();
    return;
  }
  const unlocked = hasPremiumAccess();

  const segBtns = document.querySelectorAll('.seg-btn');
  if (segBtns[2]) segBtns[2].classList.toggle('seg-locked', !unlocked);

  const progressTab = el('progressTabContent');
  if (progressTab) {
    progressTab.classList.toggle('feature-locked', !unlocked);
    let ov = progressTab.querySelector('.premium-lock-overlay');
    if (!unlocked && !ov) {
      progressTab.appendChild(makePremiumLockOverlay(
        'Science is Premium',
        'See how your body recovers over time after your free trial.'
      ));
    } else if (unlocked && ov) ov.remove();
  }

  // Calendar stays interactive so users can backfill missed in-journey days without Premium
  setFeatureLocked(el('monthGridCard'), false);
  setFeatureLocked(el('journeyChartCard'), !unlocked, 'History', 'Compare past journeys after your trial with Premium.');
  setFeatureLocked(el('bestPerformancesCard'), !unlocked, 'Best Scores', 'Top journey scores unlock with Premium.');
  setFeatureLocked(el('lifetimeStatsCard'), !unlocked, 'Lifetime stats', 'Career totals unlock with Premium.');
  setFeatureLocked(el('didYouKnowCard'), !unlocked, 'Knowledge cards', 'Extra insights are part of Premium.');
  setFeatureLocked(el('riskMeterCard'), !unlocked, 'Risk meter', 'AUDIT-C meter and re-tests are Premium after trial.');

  setFeatureLocked(el('reductionTargetCard'), !unlocked, 'Reduction goal', 'Reduction goal unlocks with Premium.');
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
      daysEl.textContent = premiumDaysLeftLabel();
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
  if (card) card.style.display = '';
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
    sub = premiumDaysLeftLabel();
    showBadge = false;
    trial = true;
  } else {
    badge = isPremiumSubscribeOffered() ? 'Upgrade' : '';
    sub = isPremiumSubscribeOffered()
      ? 'Trial ended — subscribe in app'
      : 'Trial ended — journey logging still available';
    if (!isPremiumSubscribeOffered()) showBadge = false;
  }

  if (titleEl) titleEl.textContent = '✦ Premium';
  if (card) {
    card.classList.toggle('premium-active-state', isPremium);
    card.classList.toggle('premium-trial-state', trial);
  }
  if (status) {
    status.hidden = !showBadge;
    status.textContent = badge;
    status.classList.toggle('is-premium', isPremium);
  }
  if (teaser) teaser.textContent = sub;
  renderPremiumPanelContent();
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

Tracker.togglePremiumLockPreview = function() {
  if (!CONFIG.showTestUI) return;
  const next = !isForcePremiumLocked();
  setForcePremiumLocked(next);
  updatePremiumLockTestBtn();
  if (this.data) UI.renderAll(this.data);
  showToast(next ? 'UI: Locked preview' : 'UI: Default (unlocked)');
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
      subEl.textContent = 'Full access is on. Subscriptions will use App Store / Play Billing when published; for now this device keeps your unlock.';
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
    if (typeof renderPremiumPlanPrices === 'function') renderPremiumPlanPrices();
    Tracker.selectPremiumPlan(selectedPremiumPlan || 'yearly');
    syncPremiumSubscribeCta();
  }
}

function openPremiumOverlay() {
  const overlay = el('premiumOverlay');
  if (overlay) {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
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
  document.body.classList.remove('modal-open');
};

Tracker.selectPremiumPlan = function(planId) {
  if (!PREMIUM_PLANS[planId]) return;
  selectedPremiumPlan = planId;
  document.querySelectorAll('#premiumPriceBlock .premium-plan').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.plan === planId);
  });
  syncPremiumSubscribeCta();
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
    showToast('Store billing is not wired yet. Use dev test UI for local-stub trials.');
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
  if (isPremiumActive()) {
    renderPremiumEntry();
    showToast('Premium restored on this device.');
    this.closePremium();
    return;
  }
  showToast('No Premium purchase found on this device yet.');
};

