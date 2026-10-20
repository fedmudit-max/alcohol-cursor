/* ===== src/ui/dashboard.js ===== */
'use strict';

function streakMilestoneStatusText(streak, targetDays) {
  const left = (targetDays | 0) - (streak | 0);
  if (left <= 1) return '';
  return `${left}d`;
}

const UI = {
  renderPrimary(data) {
    el('calendarDay').textContent = data.calendarDay;
    el('currentScore').innerHTML  = formatScoreHTML(data.currentScore);
    el('bestScore').textContent   = formatScoreText(getDisplayBestScore(data));
    el('scoreExplain').textContent = `${data.currentScore.success} sober days — ${data.currentScore.failures} drinking days`;
    const target = getNextJourneyTarget(data);
    const bestExplainEl = el('bestScoreExplain');
    if (bestExplainEl) {
      const beatingBest = isBeatingBestScore(data);
      const showTarget = !beatingBest && !data.journeyPendingReset && data.attempt > 1 && target > 0;
      if (beatingBest) {
        bestExplainEl.textContent = 'New Best! Keep Going!';
        bestExplainEl.classList.add('is-new-best');
        bestExplainEl.style.display = '';
      } else if (showTarget) {
        bestExplainEl.textContent = `Beat ${target} to win`;
        bestExplainEl.classList.remove('is-new-best');
        bestExplainEl.style.display = '';
      } else {
        bestExplainEl.textContent = '';
        bestExplainEl.classList.remove('is-new-best');
        bestExplainEl.style.display = 'none';
      }
    }
    const appName = typeof APP_DISPLAY_NAME !== 'undefined' ? APP_DISPLAY_NAME : '10Drinks';
    document.title = CONFIG.isProduction ? appName : (appName + ' · ' + (CONFIG.buildTag || 'dev'));
    el('currentCard').classList.toggle('inactive', data.currentScore.failures >= JOURNEY_MAX_FAILURES);
    renderWelcomeHint(data);
  },

  renderButtons(data) {
    const sb = el('successBtn'), fb = el('failBtn');
    const pendingYesterday = shouldAskYesterday(data);
    if (data.journeyPendingReset || (data.currentScore.failures | 0) >= JOURNEY_MAX_FAILURES) {
      sb.disabled = true; sb.classList.remove('logged'); sb.textContent = 'Journey Ended';
      fb.disabled = true; fb.textContent = '🥃 Logged';
    } else if (data.todayStatus === 'failed') {
      sb.disabled = true;  sb.classList.remove('logged'); sb.textContent = 'Still in the game.';
      fb.disabled = true;  fb.textContent = '🥃 Logged';
    } else if (data.todaySuccessLogged) {
      sb.disabled = true; sb.classList.add('logged'); sb.textContent = '✓ Sober Today';
      fb.disabled = true; fb.textContent = '🥃 Logged';
    } else {
      const needYesterday = pendingYesterday;
      sb.disabled = false;
      fb.disabled = false;
      sb.classList.remove('logged');
      sb.textContent = needYesterday ? '✓ Log yesterday first' : '✓ I Did Not Drink Today';
      fb.textContent = needYesterday ? '🥃 Log yesterday first' : '🥃 I Drank Today';
    }
  },

  renderStreakMilestones(data) {
    const streak = getDisplayStreak(data);
    const best   = data.longestStreak;
    const streakBroken = isStreakTabBroken(data);
    const streakList = el('streakMilestoneList');
    if (streakList) streakList.classList.toggle('journey-ended', streakBroken);

    // Find index of next unachieved milestone
    const nextMilestone = getNextStreakMilestone(streak);
    const nextIdx = nextMilestone ? STREAK_MILESTONES.indexOf(nextMilestone) : -1;

    STREAK_MILESTONES.forEach((m, i) => {
      const row    = el(m.el); if (!row) return;
      const nameEl = row.querySelector('.milestone-name');
      const statEl = row.querySelector('.milestone-status');
      const subEl  = el(`${m.el}-sub`);
      row.classList.remove(
        'milestone-active', 'milestone-streak-broken',
        'milestone-journey-review', 'milestone-journey-ended', 'milestone-journey-ended-idle',
      );

      if (streakBroken) {
        if (streak >= m.days) {
          row.classList.add('milestone-journey-review', 'milestone-journey-ended');
          nameEl.className = 'milestone-name journey-ended-achieved';
          statEl.className = 'milestone-status journey-ended-achieved';
          nameEl.textContent = m.name;
          statEl.textContent = '✓';
        } else {
          nameEl.className = 'milestone-name';
          statEl.className = 'milestone-status';
          if (i === nextIdx) {
            nameEl.textContent = m.name;
            statEl.textContent = streakMilestoneStatusText(streak, m.days);
          } else {
            nameEl.textContent = `Day ${m.days}`;
            statEl.textContent = '';
          }
        }
        if (subEl) subEl.textContent = '';
        return;
      }

      if (streak >= m.days) {
        row.classList.add('milestone-active');
        nameEl.className  = 'milestone-name achieved';
        statEl.className  = 'milestone-status achieved';
        nameEl.textContent = m.name;
        statEl.textContent = '✓';
        if (subEl) subEl.textContent = '';
      } else if (i === nextIdx) {
        nameEl.className  = 'milestone-name';
        statEl.className  = 'milestone-status';
        nameEl.textContent = m.name;
        statEl.textContent = streakMilestoneStatusText(streak, m.days);
        if (subEl) subEl.textContent = '';
      } else {
        nameEl.className  = 'milestone-name';
        statEl.className  = 'milestone-status';
        nameEl.textContent = `Day ${m.days}`;
        statEl.textContent = '';
        if (subEl) subEl.textContent = '';
      }
    });

    // Personal best — same row styling as Day 1–7 milestones
    const bsi = el('bestStreakItem');
    const statEl = el('longestStreakDisplay');
    if (!bsi || !statEl) return;
    const nameEl = bsi.querySelector('.milestone-name');
    bsi.classList.remove(
      'milestone-active', 'milestone-streak-broken',
      'milestone-journey-review', 'milestone-journey-ended', 'milestone-journey-ended-idle',
    );
    nameEl.textContent = 'Best Streak';
    statEl.textContent = best > 0 ? String(best) : '';

    if (streakBroken) {
      if (best > 0) {
        bsi.classList.add('milestone-journey-review', 'milestone-journey-ended');
        nameEl.className = 'milestone-name journey-ended-achieved';
        statEl.className = 'milestone-status journey-ended-achieved';
      } else {
        bsi.classList.add('milestone-journey-review', 'milestone-journey-ended-idle');
        nameEl.className = 'milestone-name journey-ended-idle';
        statEl.className = 'milestone-status journey-ended-idle';
      }
      syncStreakTabChrome(data);
      return;
    }

    if (best > 0) {
      if (data.inPersonalBest) bsi.classList.add('milestone-active');
      nameEl.className = 'milestone-name achieved';
      statEl.className = 'milestone-status achieved';
    } else {
      nameEl.className = 'milestone-name';
      statEl.className = 'milestone-status';
    }

    syncStreakTabChrome(data);
  },

  renderJourneyTrophies(data) {
    if (syncJourneyMilestonesRevealed(data)) DataManager.save(data);
    renderJourneyMilestoneSections(data);
  },

  showModal(msg) {
    el('modalMessage').textContent = msg;
    el('confirmModal').classList.add('active');
    if (typeof lockBodyScroll === 'function') lockBodyScroll();
    else document.body.classList.add('modal-open');
  },
  hideModal() {
    el('confirmModal').classList.remove('active');
    if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
    else document.body.classList.remove('modal-open');
  }
};

// Drinking-days shelf (10 slots) — must run on every UI.renderAll (not only from main.js)
function renderChances(data) {
  if (!data) return;
  ensureScoreNumbers(data);
  const failures = Math.min(JOURNEY_MAX_FAILURES, data.currentScore.failures | 0);
  const remaining = JOURNEY_MAX_FAILURES - failures;
  const grid = el('chancesGrid');
  if (!grid) return;
  grid.innerHTML = Array.from({ length: JOURNEY_MAX_FAILURES }, (_, i) => {
    const full = i < remaining;
    if (full) {
      return `<div class="slot-chance"><div style="position:absolute;bottom:2px;left:0;right:0;display:flex;flex-direction:column;align-items:center;z-index:4;"><span style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(80,40,0,0.35)) drop-shadow(0 1px 2px rgba(0,0,0,0.2));">🥃</span><div style="width:55%;height:4px;background:radial-gradient(ellipse,rgba(60,30,0,0.4) 0%,rgba(60,30,0,0.12) 60%,transparent 80%);border-radius:50%;margin-top:1px;"></div></div></div>`;
    }
    return `<div class="slot-chance empty"></div>`;
  }).join('');
  const info = el('journeyAvailable');
  if (info) info.textContent = String(remaining);
}

// Returns integer days between an ISO date string and ref day (default: real today)
function daysSince(isoString, refDate) {
  const last = new Date(isoString);
  if (isNaN(last.getTime())) return 0;
  const ref     = refDate || new Date();
  const refDay  = new Date(ref.getFullYear(),  ref.getMonth(),  ref.getDate());
  const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate());
  return Math.round((refDay - lastDay) / MS_PER_DAY);
}

// ═══════════════════════════════════════════════════════════════

function toggleSciNode(idx) {
  SCIENCE_NODES.forEach((_, i) => {
    const body    = document.getElementById(`sn-body-${i}`);
    const arr     = document.getElementById(`sn-arr-${i}`);
    const card    = document.getElementById(`sn-card-${i}`);
    const preview = card ? card.querySelector('.sn-preview') : null;
    if (!body) return;
    const open = i === idx ? body.style.display === 'none' : false;
    body.style.display = open ? 'block' : 'none';
    if (arr)     arr.textContent           = open ? '▾' : '›';
    if (card)    card.style.background     = open ? 'rgba(60,60,67,0.04)' : '';
    if (preview) preview.style.display     = open ? 'none' : 'block';
  });
}

function getVisibleScienceNodes(streak) {
  return SCIENCE_NODES.filter(n => n.hiddenUntil === undefined || streak >= n.hiddenUntil);
}

function renderScienceTimeline(data) {
  const container = el('scienceTimeline');
  if (!container) return;
  const currentStreak = getScienceTimelineStreak(data);

  const nodes = getVisibleScienceNodes(currentStreak);
  let html = '';

  nodes.forEach((node, i) => {
    const achieved  = currentStreak >= node.day;
    const inStageRange = i === nodes.length - 1
      ? achieved
      : currentStreak >= node.day && currentStreak < nodes[i + 1].day;
    // Full “YOU ARE HERE” card only on the active stage — never before that day is reached
    const isCurrent = achieved && currentStreak > 0 && inStageRange;
    const lineColor = (achieved && i < nodes.length - 1 && currentStreak >= nodes[i + 1].day)
      ? '#34c759' : 'rgba(60,60,67,0.12)';
    const dotBg   = achieved ? '#34c759' : 'rgba(60,60,67,0.12)';
    const dotSize = isCurrent ? '14px' : '8px';
    const citeHtml = node.cite
      ? `<div style="font-size:10px;color:rgba(60,60,67,0.35);margin-top:6px;font-style:italic;">📄 ${node.cite}</div>` : '';
    const connector = i < nodes.length - 1
      ? `<div style="flex:1;width:2px;background:${lineColor};margin-top:3px;"></div>` : '';
    const sepLine = i < nodes.length - 1
      ? `<div style="display:flex;"><div style="width:24px;flex-shrink:0;display:flex;justify-content:center;"><div style="width:2px;height:6px;background:${lineColor};"></div></div></div>` : '';

    if (isCurrent) {
      // ── Active achieved node — full card ───────────────────────────
      html += `
    <div style="display:flex;align-items:stretch;gap:0;">
      <div style="display:flex;flex-direction:column;align-items:center;width:24px;flex-shrink:0;padding-top:4px;">
        <div style="width:14px;height:14px;border-radius:50%;background:#34c759;flex-shrink:0;box-shadow:0 0 0 3px rgba(52,199,89,0.2);"></div>
        ${connector}
      </div>
      <div style="flex:1;min-width:0;padding-left:10px;margin-bottom:6px;">
        <div style="background:linear-gradient(135deg,rgba(52,199,89,0.1),rgba(52,199,89,0.05));border:1.5px solid rgba(52,199,89,0.3);border-radius:12px;padding:12px 14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:18px;line-height:1;">${node.organ}</span>
              <div>
                <div style="font-size:9px;font-weight:700;color:#34c759;letter-spacing:0.5px;text-transform:uppercase;">${node.label}</div>
                <div style="font-size:13px;font-weight:700;color:#1c1c1e;margin-top:1px;">${node.title}</div>
              </div>
            </div>
            <span style="font-size:9px;font-weight:700;color:white;background:#34c759;border-radius:5px;padding:2px 7px;white-space:nowrap;">YOU ARE HERE</span>
          </div>
          <div style="font-size:12px;color:rgba(60,60,67,0.7);line-height:1.65;padding-top:8px;border-top:1px solid rgba(60,60,67,0.08);">${node.change}</div>
          ${citeHtml}
        </div>
      </div>
    </div>${sepLine}`;

    } else {
      // ── All others — compact tappable row ─────────────────────────
      const titleColor = achieved ? '#1c1c1e' : '#1c1c1e';
      const dayColor   = achieved ? '#34c759' : 'rgba(60,60,67,0.35)';
      const textColor  = 'rgba(60,60,67,0.65)';
      const nodeIdx    = SCIENCE_NODES.indexOf(node);

      html += `
    <div style="display:flex;align-items:stretch;gap:0;">
      <div style="display:flex;flex-direction:column;align-items:center;width:24px;flex-shrink:0;padding-top:9px;">
        <div style="width:${dotSize};height:${dotSize};border-radius:50%;background:${dotBg};flex-shrink:0;"></div>
        ${connector}
      </div>
      <div style="flex:1;min-width:0;padding-left:10px;margin-bottom:4px;">
        <div id="sn-card-${nodeIdx}" onclick="toggleSciNode(${nodeIdx})" style="cursor:pointer;background:${achieved?'rgba(52,199,89,0.05)':'rgba(60,60,67,0.03)'};border:1px solid ${achieved?'rgba(52,199,89,0.18)':'rgba(60,60,67,0.11)'};border-radius:10px;padding:10px 12px;-webkit-tap-highlight-color:rgba(0,0,0,0.04);">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:14px;line-height:1;">${node.organ}</span>
              <div>
                <div style="font-size:9px;font-weight:600;color:${dayColor};letter-spacing:0.3px;text-transform:uppercase;">${node.label}</div>
                <div style="font-size:12px;font-weight:600;color:${titleColor};margin-top:1px;">${node.title}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
              ${achieved ? '<span style="font-size:10px;color:#34c759;font-weight:700;">✓</span>' : ''}
              <span id="sn-arr-${nodeIdx}" style="font-size:18px;color:rgba(60,60,67,0.3);font-weight:300;line-height:1;">›</span>
            </div>
          </div>
          <div class="sn-preview" style="font-size:11px;color:rgba(60,60,67,0.5);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${node.change}&thinsp;…</div>
          <div id="sn-body-${nodeIdx}" style="display:none;margin-top:7px;padding-top:7px;border-top:1px solid rgba(60,60,67,0.07);">
            <div style="font-size:11px;color:${textColor};line-height:1.6;">${node.change}</div>
            ${citeHtml}
          </div>
        </div>
      </div>
    </div>${sepLine}`;
    }
  });

  container.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// Catches unhandled JS errors — shows recovery message instead
// of blank screen. Critical for health app reliability.
// ─────────────────────────────────────────────────────────────
window.onerror = function(msg, src, line, col, err) {
  console.error('[10Drinks] error:', msg, 'at', src, line, col);
  // Only show UI error for non-trivial errors
  if (msg && !msg.includes('Script error')) {
    const existing = document.getElementById('globalErrorBanner');
    if (!existing) {
      const banner = document.createElement('div');
      banner.id = 'globalErrorBanner';
      banner.style.cssText = 'position:fixed;bottom:32px;left:16px;right:16px;background:#ff3b30;color:white;padding:12px 16px;border-radius:12px;font-size:13px;font-weight:600;z-index:9990;text-align:center;';
      banner.textContent = 'Something went wrong. Pull down to refresh.';
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 5000);
    }
  }
  return false; // don't suppress error
};

window.addEventListener('unhandledrejection', function(e) {
  console.error('[10Drinks] unhandled promise:', e.reason);
});

// ═══════════════════════════════════════════════════════════════
// BOOT — runs once when page loads
// ═══════════════════════════════════════════════════════════════
const WELCOME_HINT_STEP1_KEY = 'sj_welcome_step1_done';
const WELCOME_HINT_DISMISSED_KEY = 'sj_welcome_dismissed';

function isFreshFirstJourneyWelcome(data) {
  return !!(
    data
    && data.currentScore
    && data.attempt === 1
    && data.currentScore.success === 0
    && data.currentScore.failures === 0
    && data.todayStatus === 'none'
    && !data.journeyPendingReset
  );
}

function dismissWelcomeHint() {
  try { localStorage.setItem(WELCOME_HINT_STEP1_KEY, '1'); } catch (e) {}
  const card = el('welcomeHint');
  if (card) card.style.display = 'none';
  const d = typeof Tracker !== 'undefined' ? Tracker.data : null;
  renderWelcomeHint(d);
}

function dismissWelcomeHint2() {
  try { localStorage.setItem(WELCOME_HINT_DISMISSED_KEY, '1'); } catch (e) {}
  const card = el('welcomeHint2');
  if (card) card.style.display = 'none';
}

function renderWelcomeHint(data) {
  const card1 = el('welcomeHint');
  const card2 = el('welcomeHint2');
  if (!card1 || !data || !data.currentScore) {
    if (card2) card2.style.display = 'none';
    return;
  }
  let dismissed = false;
  let step1Done = false;
  try {
    dismissed = localStorage.getItem(WELCOME_HINT_DISMISSED_KEY) === '1';
    step1Done = localStorage.getItem(WELCOME_HINT_STEP1_KEY) === '1';
  } catch (e) {}
  const isFresh = isFreshFirstJourneyWelcome(data);
  if (!isFresh || dismissed) {
    card1.style.display = 'none';
    if (card2) card2.style.display = 'none';
    return;
  }
  if (!step1Done) {
    card1.style.display = 'block';
    if (card2) card2.style.display = 'none';
  } else {
    card1.style.display = 'none';
    if (card2) card2.style.display = 'block';
  }
}

function applyTestUIChrome() {
  const active = !!CONFIG.showTestUI;
  if (typeof syncNextDayTestBar === 'function') {
    syncNextDayTestBar(active);
  } else {
    document.body.classList.remove('test-ui-active');
  }
  updatePremiumLockTestBtn();
}

function applyDevChrome() {
  if (CONFIG.isProduction) {
    document.title = typeof APP_DISPLAY_NAME !== 'undefined' ? APP_DISPLAY_NAME : '10Drinks';
    applyTestUIChrome();
    return;
  }
  const banner = el('sjBuildBanner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = 'BUILD ' + (CONFIG.buildTag || 'dev');
  }
  applyTestUIChrome();
}


