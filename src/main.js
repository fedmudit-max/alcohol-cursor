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

  // Start the app
  Tracker.init();

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
    'acknowledgeModal', 'yesterdayModal', 'onboardingOverlay'
  ];
  for (const id of modals) {
    const m = el(id);
    if (m && (m.classList.contains('active') || m.classList.contains('open') || m.style.display === 'flex')) {
      m.classList.remove('active', 'open');
      m.style.display = 'none';
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
  const [q1,q2,q3] = answers;
  const body = document.getElementById('reductionTargetBody');
  if (!body) return;
  if (zoneName==='Dependent') {
    body.innerHTML=`<div style="padding:12px 14px;background:rgba(123,0,0,0.06);border-radius:10px;border-left:3px solid #7b0000;">
      <div style="font-size:13px;font-weight:700;color:#7b0000;margin-bottom:8px;">See a doctor before making any changes.</div>
      <div style="font-size:13px;color:rgba(60,60,67,0.7);line-height:1.65;margin-bottom:12px;">At this level, stopping or reducing suddenly can cause withdrawal seizures. Only a doctor can guide you safely from here.</div>
      <div style="font-size:12px;font-weight:600;color:#7b0000;margin-bottom:4px;">📞 NIMHANS: 080-46110007</div>
      <div style="font-size:12px;font-weight:600;color:#7b0000;">📞 iCall: 9152987821</div>
    </div>`;
    return;
  }
  const qtyLabel=['1-2 pegs','3-4 pegs','5-6 pegs','7-9 pegs','10+ pegs'];
  const freqLabel=['Never','Once a month or less','2-4 times a month','2-3 times a week','4+ times a week'];
  const freqTargetLabel=['Never','Once a month','Once a week','Twice a week','Every other day'];
  const bingeDone=q3===0, qtyDone=q2<=1, freqDone=q1<=1;
  const q2Target=q2>1?q2-1:null, q1Target=q1>1?q1-1:null;
  const lowRiskBanner = `<div style="margin-top:12px;padding:12px;background:rgba(52,199,89,0.06);border-radius:10px;text-align:center;"><div style="font-size:22px;margin-bottom:6px;">🎯</div><div style="font-size:14px;font-weight:700;color:#248a3d;">You have reached the Low Risk Zone.</div></div>`;
  const showLowRiskBanner = score <= 3;
  const row=(state,label,cur,tgt,sub)=>{
    if(state==='done') return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(60,60,67,0.06);"><div style="width:24px;height:24px;border-radius:50%;background:#34c759;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="color:white;font-size:13px;font-weight:700;">✓</span></div><div><div style="font-size:13px;font-weight:600;color:#248a3d;">${label}</div><div style="font-size:11px;color:rgba(60,60,67,0.45);margin-top:1px;">${cur}</div></div></div>`;
    if(state==='pending') return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(60,60,67,0.06);opacity:0.4;"><div style="width:24px;height:24px;border-radius:50%;border:2px solid rgba(60,60,67,0.2);flex-shrink:0;"></div><div><div style="font-size:13px;font-weight:500;color:rgba(60,60,67,0.5);">${label}</div><div style="font-size:11px;color:rgba(60,60,67,0.35);margin-top:1px;">${sub||'Complete step above first'}</div></div></div>`;
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(60,60,67,0.06);"><div style="width:24px;height:24px;border-radius:50%;border:2px solid #ff9500;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><div style="width:8px;height:8px;border-radius:50%;background:#ff9500;"></div></div><div style="flex:1;"><div style="font-size:13px;font-weight:600;">${label}</div><div style="display:flex;align-items:center;gap:6px;margin-top:3px;"><span style="font-size:13px;font-weight:700;color:#ff9500;">${cur}</span><span style="font-size:12px;color:rgba(60,60,67,0.3);">→</span><span style="font-size:13px;font-weight:700;color:#34c759;">${tgt}</span></div></div></div>`;
  };
  const bingeRow = !bingeDone
    ? row('active', 'Stop binge sessions', 'Occurring (180ml+)', 'Never exceed 180ml', '')
    : row('done', 'Stop binge sessions', 'None this journey — staying under 180ml', '', '');

  const qtyRow = qtyDone
    ? row('done', 'Quantity per session', qtyLabel[q2], '', '')
    : row('active', 'Quantity per session', qtyLabel[q2], qtyLabel[q2Target??1], '');

  const freqRow = freqDone
    ? row('done', 'Frequency', freqLabel[q1], '', '')
    : (!qtyDone)
      ? row('pending', 'Frequency', freqLabel[q1], freqTargetLabel[q1Target??Math.max(q1-1,1)], 'Reduce quantity first')
      : row('active', 'Frequency', freqLabel[q1], freqTargetLabel[q1Target??Math.max(q1-1,1)], '');

  let msg = '';
  const bingeAlert = '⚠️ Never go over 180ml whisky in one session. Above this threshold liver stress and accident risk spike sharply.';
  const qtyAlerts = ['','3-4 pegs per session — already doing well. Now work on frequency.','From 5-6 pegs down to 3-4. That is the WHO single-occasion Low Risk limit.','From 7-9 pegs to 5-6. One less round makes a measurable difference.','10+ pegs is acute liver stress. Target 7-9 as the first step down.'];
  if (!bingeDone && !qtyDone) {
    msg = '⚠️ Two steps — both active now. Stop binge sessions (never exceed 180ml whisky in one sitting) and reduce your quantity per session. Work on both together.';
  } else if (!bingeDone) {
    msg = bingeAlert;
  } else if (!qtyDone && q2Target !== null) {
    msg = qtyAlerts[q2] || '';
  } else if (qtyDone && !freqDone && q1Target !== null) {
    const freqMsgs = ['','Once a month — deliberate, enjoyable.','From 2-4x month to once a month.','From 2-3x week to 2-4x month — breaks the weekly habit loop.','From 4+x week to 2-3x week — cut two occasions this week.'];
    msg = freqMsgs[q1] || '';
  }
  const msgBlock = (text) => text ? `<div style="margin-top:10px;padding:10px 14px;background:rgba(52,199,89,0.05);border-radius:10px;border-left:3px solid rgba(52,199,89,0.3);"><div style="font-size:12px;color:rgba(60,60,67,0.65);line-height:1.65;">${text}</div></div>` : '';

  if (qtyDone && freqDone && bingeDone) {
    body.innerHTML = `${row('done','Stop binge sessions','Under 180ml every session','','')}${row('done','Quantity per session',qtyLabel[q2],'','')}${row('done','Frequency',freqLabel[q1],'','')}${lowRiskBanner}`;
    return;
  }

  if (showLowRiskBanner) {
    const lowRiskAlerts = [];
    if (q3 > 0) lowRiskAlerts.push(bingeAlert);
    if (q2 === 2) lowRiskAlerts.push(qtyAlerts[2]);
    body.innerHTML = `${bingeRow}${qtyRow}${freqRow}${lowRiskAlerts.map(msgBlock).join('')}${lowRiskBanner}`;
    return;
  }

  body.innerHTML=`${bingeRow}${qtyRow}${freqRow}${msgBlock(msg)}`;
}

// ── WINNING WAYS ──────────────────────────────────────────────
SoberTracker.showWinningWays   = function() { const m=document.getElementById('winningWaysModal'); if(m) m.classList.add('open'); };
SoberTracker.closeWinningWays  = function() { const m=document.getElementById('winningWaysModal'); if(m) m.classList.remove('open'); };
SoberTracker.showTargetZone    = function() { const m=document.getElementById('targetZoneModal'); if(m) m.classList.add('open'); };
SoberTracker.closeTargetZone   = function() {
  const m=document.getElementById('targetZoneModal');
  if(m) m.classList.remove('open');
  const p=document.getElementById('tzBeer');
  const a=document.getElementById('tzBeerArr');
  if(p) p.style.display='none';
  if(a) a.textContent='▸';
};

// ── PATCH renderAll ───────────────────────────────────────────
const _origRenderAll = UI.renderAll.bind(UI);
UI.renderAll = function(data) {
  _origRenderAll(data);
  renderChances(data);
  renderReductionTarget(data);
  renderDidYouKnow(data);
  renderBackupStatus();
  renderPremiumEntry();
};

// ── DYK FACTS ─────────────────────────────────────────────────

// Start after all patches/helpers in this file are defined
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
