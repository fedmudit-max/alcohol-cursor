/* ===== src/main.js ===== */
'use strict';
function boot() {
  applyDevChrome();
  dismissAppSplash();

  // Flush pending debounced saves only — never write stale Tracker.data over localStorage edits
  window.addEventListener('pagehide', () => DataManager.flush());

  // Dev only — wipe stale caches so code changes show immediately
  if (!CONFIG.isProduction) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    }
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
  }

  // Start the app — always dismiss splash even if init throws
  const privacyLink = el('privacyPolicyFullLink');
  if (privacyLink && CONFIG.privacyPolicyUrl) privacyLink.href = CONFIG.privacyPolicyUrl;

  try {
    if (typeof healStuckBodyScroll === 'function') healStuckBodyScroll();
    Tracker.init();
    if (typeof bindCollapsiblePanelToggles === 'function') bindCollapsiblePanelToggles();
    bindMonthGridCalendarClicks();
    if (typeof healStuckBodyScroll === 'function') healStuckBodyScroll();
  } catch (err) {
    console.error('[10Drinks] boot failed:', err);
    dismissAppSplash();
  }
  setTimeout(dismissAppSplash, 3000);

  if (Tracker.data) renderDidYouKnow(Tracker.data);

  // Start the D3 meter — blank until user takes the test this page load
  MeterController.init();
  if (!MeterController.initialized) {
    let retries = 0;
    const d3Poll = setInterval(() => {
      retries++;
      MeterController.init();
      if (MeterController.initialized) {
        clearInterval(d3Poll);
      }
      if (retries >= D3_RETRY_MAX) {
        clearInterval(d3Poll);
        const offline = el('meterOffline');
        if (offline) offline.style.display = 'block';
      }
    }, D3_RETRY_MS);
  }

  // Onboarding — first install only (Onboarding.show checks sj_onboarded)
  if (CONFIG.showOnboarding !== false) {
    setTimeout(() => Onboarding.show(), 350);
  }

  // Personal PWA — offline shell (skip in Capacitor WebView; native shell uses bundled assets)
  const isNativeShell =
    typeof window !== 'undefined' &&
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform();
  if (CONFIG.isProduction && !isNativeShell && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('sw.js', window.location.href), { scope: './' })
        .then((reg) => reg.update())
        .catch(() => {});
    });
  }
}

// Android back / history — close modals before exiting the app
function TenDrinks_handleAndroidBack() {
  const modals = [
    'auditModal', 'celebrationModal', 'confirmModal',
    'acknowledgeModal', 'yesterdayModal', 'calendarDayModal', 'exportChoiceModal', 'onboardingOverlay'
  ];
  for (const id of modals) {
    const m = el(id);
    if (m && (m.classList.contains('active') || m.classList.contains('open') || m.style.display === 'flex')) {
      if (id === 'onboardingOverlay') {
        Onboarding.hideImmediate();
      } else {
        m.classList.remove('active', 'open');
        m.style.display = 'none';
      }
      if (typeof forceUnlockBodyScroll === 'function') forceUnlockBodyScroll();
      else document.body.classList.remove('modal-open');
      history.pushState(null, '', window.location.href);
      return;
    }
  }
}
window.TenDrinks_handleAndroidBack = TenDrinks_handleAndroidBack;
window.addEventListener('popstate', TenDrinks_handleAndroidBack);

// Push initial state so back button works
history.pushState(null, '', window.location.href);


// Show/hide test UI based on CONFIG
applyTestUIChrome();
if (CONFIG.showTestUI) {
  window.SJ_status = function() {
    const d = Tracker.data || DataManager.load();
    const days = daysSince(d.lastDayCheck, getAppToday(d));
    const yest = getAppToday(d);
    yest.setDate(yest.getDate() - 1);
    recalculateStreakFromLog(d);
    console.table({
      build: CONFIG.buildTag,
      appToday: dateKey(getAppToday(d)),
      simulatedToday: d.simulatedToday || '(real clock)',
      daysGap: days,
      lastDayCheck: d.lastDayCheck,
      todayStatus: d.todayStatus,
      soberScore: d.currentScore && d.currentScore.success,
      drinkScore: d.currentScore && d.currentScore.failures,
      currentStreak: d.currentStreak,
      longestStreak: d.longestStreak,
      dailyLogDays: Object.keys(d.dailyLog || {}).length,
      dailyLog: JSON.stringify(d.dailyLog || {}),
      scoredDays: Object.keys(d.scoredDays || {}).length,
      yesterdayLogged: !!(d.dailyLog && d.dailyLog[dateKey(yest)]),
      journeyPendingReset: d.journeyPendingReset,
    });
    return d;
  };

  window.SJ_forceRefresh = function() {
    const d = Tracker.data || DataManager.load();
    refreshStreakUI(d);
    UI.renderAll(d);
    return SJ_status();
  };
}

if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock('portrait').catch(() => {});
}

window.addEventListener('beforeunload', () => MidnightTimer.stop());

// ── REDUCTION TARGET ──────────────────────────────────────────
function _getReductionLever(q1, q2, q3) {
  const a = q1 | 0;
  const b = q2 | 0;
  const c = q3 | 0;
  if (c >= 2) return 'binge';
  if (b >= 3) return 'quantity';
  if (a >= 3) return 'frequency';
  return 'maintain';
}

/** Pick a focus lever when total score is elevated but no single item hit legacy thresholds. */
function _resolveReductionLever(q1, q2, q3, score) {
  const lever = _getReductionLever(q1, q2, q3);
  if (lever !== 'maintain' || score < AUDIT_HAZARDOUS_SCORE) return lever;
  const a = q1 | 0;
  const b = q2 | 0;
  const c = q3 | 0;
  if (c >= 2) return 'binge';
  if (b >= a) return 'quantity';
  return 'frequency';
}

function _zoneAlignedReductionCopy(zoneIdx, baseCopy) {
  if (zoneIdx >= 3) {
    return {
      ...baseCopy,
      headline: 'Your screening score is in a harmful range',
    };
  }
  if (zoneIdx >= 2) {
    return {
      ...baseCopy,
      headline: 'Your screening score is in a hazardous range',
    };
  }
  return baseCopy;
}

const REDUCTION_LEVER_COPY = {
  binge: {
    headline: 'Focus first: avoid heavy drinking occasions',
    detail: 'Your answers suggest heavy drinking occasions are the most impactful thing to address. Heavy drinking occasions can carry substantial risk, so reducing them is an important first step.',
    secondary: [
      'Have more alcohol-free days',
      'Drink smaller amounts when you do drink',
      'Drink on fewer days overall',
    ],
  },
  quantity: {
    headline: 'Focus first: reduce how much you drink per session',
    detail: 'Your answers suggest the amount you drink per occasion is worth focusing on. Choosing smaller amounts is one of the most effective changes you can make.',
    secondary: [
      'Have more alcohol-free days',
      'Avoid heavy drinking occasions',
      'Drink on fewer days overall',
    ],
  },
  frequency: {
    headline: 'Focus first: drink on fewer days',
    detail: 'Your answers suggest drinking frequency is the most impactful thing to address. More alcohol-free days give your body time to recover.',
    secondary: [
      'Choose smaller amounts when you do drink',
      'Avoid heavy drinking occasions',
      'Build alcohol-free day streaks in this app',
    ],
  },
  maintain: {
    headline: 'Your screening score is in a lower-risk range',
    detail: 'Less alcohol is always better. Maintaining or reducing further is worthwhile.',
    secondary: [
      'Keep building alcohol-free day streaks',
      'Avoid heavy drinking occasions',
      'Low Risk is not Risk Free',
    ],
  },
};

function renderReductionTarget(data) {
  const card = document.getElementById('reductionTargetCard');
  if (!card || !data) return;

  const date = data.auditDate;
  const answers = data.auditAnswers
    || (data.auditQ1 != null && data.auditQ2 != null && data.auditQ3 != null
      ? [data.auditQ1, data.auditQ2, data.auditQ3]
      : null);
  if (!date || !answers || answers.length < 3) {
    card.style.display = 'none';
    return;
  }

  const q1 = answers[0] | 0;
  const q2 = answers[1] | 0;
  const q3 = answers[2] | 0;
  const score = data.auditScore != null ? (data.auditScore | 0) : q1 + q2 + q3;

  const zoneIdx = MeterController.getZoneIdx(score);
  const zoneName = MeterController.ZONES[zoneIdx]?.label;
  if (!zoneName || zoneIdx === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  const body = document.getElementById('reductionTargetBody');
  if (!body) return;

  const footer = `<p style="margin:12px 0 0;font-size:10px;color:rgba(60,60,67,0.35);text-align:center;line-height:1.45;">Based on your screening answers · Not a personal medical recommendation</p>`;

  if (score >= AUDIT_SEEK_SUPPORT_SCORE) {
    const p = 'margin:0 0 12px;font-size:13px;color:rgba(60,60,67,0.75);line-height:1.65;';
    const pLast = 'margin:0;font-size:13px;color:rgba(60,60,67,0.75);line-height:1.65;';
    body.innerHTML = `
      <div style="padding:12px 14px;background:rgba(123,0,0,0.06);border-radius:10px;border-left:3px solid #7b0000;">
        <div style="font-size:13px;font-weight:700;color:#7b0000;margin-bottom:10px;">Seek professional support</div>
        <p style="${p}">Your screening result is in a higher-risk range. Consider speaking with a healthcare professional about your drinking.</p>
        <p style="${p}">If you drink heavily every day or have experienced withdrawal symptoms before, don't stop or make a major reduction suddenly without medical guidance. Alcohol withdrawal can be dangerous and, in some cases, life-threatening.</p>
        <p style="${pLast}">A healthcare professional can help you decide on a safe reduction or stopping plan.</p>
      </div>${footer}`;
    return;
  }

  const lever = _resolveReductionLever(q1, q2, q3, score);
  const copy = _zoneAlignedReductionCopy(zoneIdx, REDUCTION_LEVER_COPY[lever]);
  const secondaryList = copy.secondary
    .map((item) => `<li style="margin-bottom:4px;">${item}</li>`)
    .join('');

  const showSafetyNote = q3 > 0 || q1 >= 4;
  const safetyNote = showSafetyNote
    ? `<div style="margin-top:10px;padding:10px 12px;background:rgba(255,149,0,0.06);border-radius:10px;border-left:3px solid rgba(255,149,0,0.45);">
        <p style="margin:0;font-size:11px;color:rgba(60,60,67,0.7);line-height:1.6;">If you drink very heavily or have had withdrawal symptoms before, speak with a healthcare professional before making major changes.</p>
      </div>`
    : '';

  const showLowRiskBanner = score <= 3;
  const lowRiskBanner = showLowRiskBanner
    ? `<div style="margin-top:12px;padding:12px;background:rgba(52,199,89,0.06);border-radius:10px;text-align:center;">
        <div style="font-size:22px;margin-bottom:6px;">🎯</div>
        <div style="font-size:14px;font-weight:700;color:#248a3d;">Lower-risk screening range</div>
        <div style="font-size:12px;color:rgba(60,60,67,0.55);margin-top:4px;">Low Risk is not Risk Free · Less is always better</div>
      </div>`
    : '';

  let accentBg = 'rgba(52,199,89,0.05)';
  let accentBorder = 'rgba(52,199,89,0.3)';
  if (zoneIdx >= 3) {
    accentBg = 'rgba(255,59,48,0.08)';
    accentBorder = 'rgba(255,59,48,0.45)';
  } else if (zoneIdx >= 2) {
    accentBg = 'rgba(255,149,0,0.08)';
    accentBorder = 'rgba(255,149,0,0.45)';
  }

  body.innerHTML = `
    <div style="padding:10px 14px;background:${accentBg};border-radius:10px;border-left:3px solid ${accentBorder};">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:rgba(28,28,30,0.9);line-height:1.45;">${copy.headline}</p>
      <p style="margin:0 0 10px;font-size:12px;color:rgba(60,60,67,0.7);line-height:1.65;">${copy.detail}</p>
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:rgba(60,60,67,0.55);">You may also find it helpful to:</p>
      <ul style="margin:0;padding-left:18px;font-size:12px;color:rgba(60,60,67,0.7);line-height:1.55;">${secondaryList}</ul>
    </div>
    ${safetyNote}
    ${lowRiskBanner}
    ${footer}`;
}

// ── PATCH renderAll ───────────────────────────────────────────
const _origRenderAll = UI.renderAll.bind(UI);
UI.renderAll = function(data) {
  _origRenderAll(data);
  try {
    renderReductionTarget(data);
    renderDidYouKnow(data);
    renderBackupStatus();
    if (typeof renderPremiumPlanPrices === 'function') renderPremiumPlanPrices();
    renderPremiumEntry();
  } catch (err) {
    console.error('[10Drinks] renderAll post-hook failed:', err);
  }
};

// ── DYK FACTS ─────────────────────────────────────────────────

// Start after all patches/helpers in this file are defined
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
