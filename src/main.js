/* ===== src/main.js ===== */
'use strict';
function boot() {
  applyDevChrome();

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
  try {
    Tracker.init();
  } catch (err) {
    console.error('[10Drinks] boot failed:', err);
    dismissAppSplash();
  }
  setTimeout(dismissAppSplash, 3000);

  renderDidYouKnow(Tracker.data);

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

  // Personal PWA — offline shell + install support
  if (CONFIG.isProduction && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('sw.js', window.location.href), { scope: './' })
        .then((reg) => reg.update())
        .catch(() => {});
    });
  }
}

// Android back button — close any open modal instead of closing the app
window.addEventListener('popstate', function() {
  // Close modals in priority order
  const modals = [
    'auditModal', 'celebrationModal', 'confirmModal',
    'acknowledgeModal', 'yesterdayModal', 'calendarDayModal', 'onboardingOverlay'
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
      document.body.classList.remove('modal-open');
      // Push state again so next back press works
      history.pushState(null, '', window.location.href);
      return;
    }
  }
});

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

// ── SHELF RENDERER ────────────────────────────────────────────
function renderChances(data) {
  const remaining = 10 - data.currentScore.failures;
  const grid = document.getElementById('chancesGrid');
  if (!grid) return;
  grid.innerHTML = Array.from({length:10}, (_,i) => {
    const full = i < remaining;
    if (full) return `<div class="slot-chance"><div style="position:absolute;bottom:2px;left:0;right:0;display:flex;flex-direction:column;align-items:center;z-index:4;"><span style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(80,40,0,0.35)) drop-shadow(0 1px 2px rgba(0,0,0,0.2));">🥃</span><div style="width:55%;height:4px;background:radial-gradient(ellipse,rgba(60,30,0,0.4) 0%,rgba(60,30,0,0.12) 60%,transparent 80%);border-radius:50%;margin-top:1px;"></div></div></div>`;
    return `<div class="slot-chance empty"></div>`;
  }).join('');
  const info = document.getElementById('journeyAvailable');
  if (info) info.textContent = remaining;
}

// ── REDUCTION TARGET ──────────────────────────────────────────
function renderReductionTarget(data) {
  const card = document.getElementById('reductionTargetCard');
  if (!card) return;
  const answers = data.auditAnswers || (data.auditQ1 !== null ? [data.auditQ1, data.auditQ2, data.auditQ3] : null);
  const score   = data.auditScore   ?? (answers ? answers.reduce((a,b)=>a+b,0) : null);
  const date    = data.auditDate;
  if (!date || !answers || score === null) { card.style.display='none'; return; }
  const zoneIdx = MeterController.getZoneIdx(score);
  const zoneName = MeterController.ZONES[zoneIdx]?.label;
  if (!zoneName || zoneName==='Sober') { card.style.display='none'; return; }
  card.style.display = 'block';
  const zl = document.getElementById('reductionZoneLabel');
  if (zl) zl.textContent = zoneName;
  const body = document.getElementById('reductionTargetBody');
  if (!body) return;
  if (zoneName === 'Seek Support') {
    body.innerHTML=`<div style="padding:12px 14px;background:rgba(123,0,0,0.06);border-radius:10px;border-left:3px solid #7b0000;">
      <div style="font-size:13px;font-weight:700;color:#7b0000;margin-bottom:8px;">See a doctor before making any changes.</div>
      <div style="font-size:13px;color:rgba(60,60,67,0.7);line-height:1.65;margin-bottom:12px;">At this level, stopping or reducing suddenly can cause withdrawal seizures. Only a doctor can guide you safely from here.</div>
      <div style="font-size:12px;font-weight:600;color:#7b0000;margin-bottom:4px;">📞 NIMHANS: 080-46110007</div>
      <div style="font-size:12px;font-weight:600;color:#7b0000;">📞 iCall: 9152987821</div>
    </div>`;
    return;
  }
  const q3 = answers[2];
  const heavyOccasionLead = q3 > 0
    ? `<p style="margin:0 0 12px;">If you drink heavily every day or have experienced withdrawal symptoms, speak with a healthcare professional before stopping suddenly or making a major reduction.</p>`
    : '';
  const lowRiskBanner = `<div style="margin-top:12px;padding:12px;background:rgba(52,199,89,0.06);border-radius:10px;text-align:center;"><div style="font-size:22px;margin-bottom:6px;">🎯</div><div style="font-size:14px;font-weight:700;color:#248a3d;">Lower-risk screening range</div><div style="font-size:12px;color:rgba(60,60,67,0.55);margin-top:4px;">Low Risk is not Risk Free</div></div>`;
  const showLowRiskBanner = score <= 3;
  const reductionGuidance = `<div style="padding:10px 14px;background:rgba(52,199,89,0.05);border-radius:10px;border-left:3px solid rgba(52,199,89,0.3);"><div style="font-size:12px;color:rgba(60,60,67,0.65);line-height:1.65;">
    ${heavyOccasionLead}
    <p style="margin:0 0 6px;font-weight:600;color:rgba(60,60,67,0.75);">To reduce your alcohol use:</p>
    <ul style="margin:0 0 12px;padding-left:18px;">
      <li>Drink on fewer days</li>
      <li>Have more alcohol-free days</li>
      <li>Choose smaller amounts when drinking</li>
      <li>Avoid heavy-drinking occasions</li>
    </ul>
    <p style="margin:0;">Your AUDIT-C score may decrease as your drinking frequency and quantity decrease.</p>
  </div></div>`;

  body.innerHTML = `${reductionGuidance}${showLowRiskBanner ? lowRiskBanner : ''}`;
}

// ── WINNING WAYS ──────────────────────────────────────────────
SoberTracker.showWinningWays   = function() { const m=document.getElementById('winningWaysModal'); if(m) m.classList.add('open'); };
SoberTracker.closeWinningWays  = function() { const m=document.getElementById('winningWaysModal'); if(m) m.classList.remove('open'); };
// ── PATCH renderAll ───────────────────────────────────────────
const _origRenderAll = UI.renderAll.bind(UI);
UI.renderAll = function(data) {
  _origRenderAll(data);
  renderChances(data);
  renderReductionTarget(data);
  renderDidYouKnow(data);
  renderBackupStatus();
  if (typeof renderPremiumPlanPrices === 'function') renderPremiumPlanPrices();
  renderPremiumEntry();
};

// ── DYK FACTS ─────────────────────────────────────────────────

// Start after all patches/helpers in this file are defined
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
