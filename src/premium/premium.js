/* ===== src/premium/premium.js ===== */
'use strict';
// PREMIUM — local entitlement (billing wiring later)
// ═══════════════════════════════════════════════════════════════
let selectedPremiumPlan = 'yearly';

function premiumDaysLeftLabel() {
  const left = trialDaysLeft();
  if (left <= 0) return 'Trial ended';
  if (left === 1) return '1 day left';
  return `${left} days left`;
}

function syncPremiumSubscribeCta() {
  const buyBtn = el('premiumCtaBtn');
  if (!buyBtn || buyBtn.hidden) return;
  const plan = PREMIUM_PLANS[selectedPremiumPlan] || PREMIUM_PLANS.yearly;
  buyBtn.textContent = plan.id === 'yearly' ? 'Subscribe — Annual ₹999' : 'Subscribe — Monthly ₹149';
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
  if (!rec || !rec.active) return false;
  if (rec.expiresAt) {
    const exp = new Date(rec.expiresAt).getTime();
    if (!Number.isNaN(exp) && Date.now() > exp) return false;
  }
  return true;
}

function ensureTrialStarted() {
  try {
    if (!localStorage.getItem(TRIAL_KEY)) {
      localStorage.setItem(TRIAL_KEY, new Date().toISOString());
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
  const existing = cardEl.querySelector(':scope > .premium-lock-overlay');
  if (!locked) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;
  cardEl.appendChild(makePremiumLockOverlay(title, sub));
}

function renderPremiumLocks(data) {
  const unlocked = hasPremiumAccess();

  const segBtns = document.querySelectorAll('.seg-btn');
  if (segBtns[2]) segBtns[2].classList.toggle('seg-locked', !unlocked);

  const progressTab = el('progressTabContent');
  if (progressTab) {
    progressTab.classList.toggle('feature-locked', !unlocked);
    let ov = progressTab.querySelector(':scope > .premium-lock-overlay');
    if (!unlocked && !ov) {
      progressTab.appendChild(makePremiumLockOverlay(
        'Progress is Premium',
        'See how your body recovers over time after your free trial.'
      ));
    } else if (unlocked && ov) ov.remove();
  }

  setFeatureLocked(el('monthGridCard'), !unlocked, 'Monthly calendar', 'Browse your full month history with Premium.');
  setFeatureLocked(el('journeyChartCard'), !unlocked, 'History', 'Compare past journeys after your trial with Premium.');
  setFeatureLocked(el('lifetimeStatsCard'), !unlocked, 'Lifetime stats', 'Career totals unlock with Premium.');
  setFeatureLocked(el('didYouKnowCard'), !unlocked, 'Knowledge cards', 'Extra insights are part of Premium.');
  setFeatureLocked(el('riskMeterCard'), !unlocked, 'Risk meter', 'AUDIT-C meter and re-tests are Premium after trial.');

  // Reduce target / low risk can stay tied to meter access
  setFeatureLocked(el('reductionTargetCard'), !unlocked, 'Reduction target', 'Targets unlock with Premium.');
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
  if (subBtn) subBtn.hidden = !!active;
  if (restoreBtn) restoreBtn.hidden = !!active;
}

function renderPremiumEntry() {
  const status = el('premiumEntryStatus');
  if (!status) return;
  if (isForcePremiumLocked()) {
    status.hidden = false;
    status.textContent = 'Locked';
    status.classList.remove('is-premium');
    renderPremiumPanelContent();
    return;
  }
  if (isPremiumActive()) {
    status.hidden = false;
    status.textContent = 'Active';
    status.classList.add('is-premium');
  } else if (isTrialActive()) {
    status.textContent = '';
    status.hidden = true;
    status.classList.remove('is-premium');
  } else {
    status.hidden = false;
    status.textContent = 'Upgrade';
    status.classList.remove('is-premium');
  }
  renderPremiumPanelContent();
}

Tracker.togglePremiumPanel = function() {
  const body = el('premiumPanelBody');
  const btn = el('premiumPanelToggleBtn');
  const toggle = el('premiumPanelToggle');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (btn) btn.textContent = open ? 'Show \u25be' : 'Hide \u25b4';
  if (toggle) toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
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
  } else {
    titleEl.textContent = 'Choose a plan';
    if (subEl) subEl.hidden = true;
    if (priceBlock) priceBlock.hidden = false;
    if (laterBtn) laterBtn.textContent = isTrialActive() ? 'Not now' : 'Continue with basic logging';
    if (buyBtn) {
      buyBtn.hidden = false;
      buyBtn.disabled = false;
    }
    if (restoreBtn) restoreBtn.hidden = false;
    Tracker.selectPremiumPlan(selectedPremiumPlan || 'yearly');
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
  selectedPremiumPlan = selectedPremiumPlan || 'yearly';
  renderPremiumCheckoutSheet();
  openPremiumOverlay();
};

/** Premium tab Subscribe — same checkout popup (monthly / annual). */
Tracker.openPremiumCheckout = function() {
  if (isPremiumActive()) {
    showToast('Premium is already active on this device.');
    return;
  }
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
  if (isPremiumActive()) {
    showToast('Premium is already active on this device.');
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
  showToast(plan.id === 'yearly' ? 'Yearly Premium unlocked' : 'Monthly Premium unlocked');
};

Tracker.restorePremium = function() {
  if (isPremiumActive()) {
    renderPremiumEntry();
    showToast('Premium restored on this device.');
    this.closePremium();
    return;
  }
  showToast('No Premium purchase found on this device yet.');
};

