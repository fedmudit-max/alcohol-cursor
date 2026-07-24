/* ===== src/ui/dashboard.js ===== */
'use strict';

const UI = {
  renderPrimary(data) {
    el('calendarDay').textContent = data.calendarDay;
    el('currentScore').innerHTML  = formatScoreHTML(data.currentScore);
    el('bestScore').textContent   = formatScoreText(data.highestScore);
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
    document.title = CONFIG.isProduction ? 'Sober Journey' : ('Sober Journey · ' + (CONFIG.buildTag || 'dev'));
    el('currentCard').classList.toggle('inactive', data.currentScore.failures >= JOURNEY_MAX_FAILURES);
    renderWelcomeHint(data);
  },

  renderButtons(data) {
    const sb = el('successBtn'), fb = el('failBtn');
    if (data.journeyPendingReset || (data.currentScore.failures | 0) >= JOURNEY_MAX_FAILURES) {
      sb.disabled = true; sb.classList.remove('logged'); sb.textContent = 'Journey Ended';
      fb.disabled = true; fb.textContent = '🥃 Logged';
    } else if (data.todayStatus === 'failed') {
      sb.disabled = true;  sb.classList.remove('logged'); sb.textContent = 'Still in the game.';
      fb.disabled = true;  fb.textContent = '🥃 Logged';
    } else if (data.todaySuccessLogged) {
      sb.disabled = true; sb.classList.add('logged'); sb.textContent = '✓ Sober Today';
      fb.disabled = true; fb.textContent = '🥃 Blocked';
    } else {
      sb.disabled = false; sb.classList.remove('logged'); sb.textContent = '✓ I Did Not Drink Today';
      fb.disabled = false; fb.textContent = '🥃 I Drank Today';
    }
  },

  renderStreakMilestones(data) {
    const streak = getDisplayStreak(data);
    const best   = data.longestStreak;

    // Find index of next unachieved milestone
    const nextMilestone = getNextStreakMilestone(streak);
    const nextIdx = nextMilestone ? STREAK_MILESTONES.indexOf(nextMilestone) : -1;

    STREAK_MILESTONES.forEach((m, i) => {
      const row    = el(m.el); if (!row) return;
      const nameEl = row.querySelector('.milestone-name');
      const statEl = row.querySelector('.milestone-status');
      const subEl  = el(`${m.el}-sub`);

      if (streak >= m.days) {
        // Achieved
        row.classList.add('milestone-active');
        nameEl.className  = 'milestone-name achieved';
        statEl.className  = 'milestone-status achieved';
        nameEl.textContent = m.name;
        statEl.textContent = '✓';
        if (subEl) subEl.textContent = '';
      } else if (i === nextIdx) {
        // Next target — show label name only
        row.classList.remove('milestone-active');
        nameEl.className  = 'milestone-name';
        statEl.className  = 'milestone-status';
        nameEl.textContent = m.name;
        statEl.textContent = `${m.days - streak}d`;
        if (subEl) subEl.textContent = '';
      } else {
        // Future — just show day number
        row.classList.remove('milestone-active');
        nameEl.className  = 'milestone-name';
        statEl.className  = 'milestone-status';
        nameEl.textContent = `Day ${m.days}`;
        statEl.textContent = '—';
        if (subEl) subEl.textContent = '';
      }
    });

    // Personal best
    const bsi    = el('bestStreakItem');
    const bsd    = el('longestStreakDisplay');
    if (!bsi || !bsd) return;
    const nameEl = bsi.querySelector('.milestone-name');
    const statEl = bsi.querySelector('.milestone-status');
    bsd.textContent = best;
    if (data.inPersonalBest) {
      bsi.classList.add('personal-best-active');
      nameEl.className = 'milestone-name golden';
      statEl.className = 'milestone-status golden';
    } else if (best > 0) {
      bsi.classList.remove('personal-best-active');
      nameEl.className = 'milestone-name golden';
      statEl.className = 'milestone-status golden';
    } else {
      bsi.classList.remove('personal-best-active');
      nameEl.className = 'milestone-name';
      statEl.className = 'milestone-status';
    }
  },

  renderJourneyTrophies(data) {
    const current = data.currentScore.success;
    if (syncJourneyMilestonesRevealed(data)) DataManager.save(data);

    const showInControl = isInControlStageVisible(data);
    const inControlLabel = el('inControlStageLabel');
    const inControlStage = el('inControlStage');
    if (inControlLabel) {
      inControlLabel.style.display = showInControl ? '' : 'none';
      inControlLabel.classList.toggle('stage-incontrol-unlocked', showInControl);
    }
    if (inControlStage) inControlStage.style.display = showInControl ? '' : 'none';

    const visible = JOURNEY_TROPHIES.filter(m => isJourneyMilestoneVisible(data, m));
    const nextMilestone = visible.find(m => current < m.days);

    JOURNEY_TROPHIES.forEach(m => {
      const row = el(m.el); if (!row) return;
      if (!isJourneyMilestoneVisible(data, m)) {
        row.style.display = 'none';
        return;
      }
      row.style.display = '';

      const count  = (data.journeyTrophies && data.journeyTrophies[m.days]) || 0;
      const nameEl = row.querySelector('.milestone-name');
      const statEl = row.querySelector('.milestone-status');
      const alwaysShowLabel = m.days === 100 || m.days === 200;
      const milestoneLabel = alwaysShowLabel
        ? nameEl.dataset.label
        : nameEl.dataset.label.split(' — ')[0];
      const premLocked = isJourneyMilestonePremiumLocked(m.days);
      row.classList.toggle('milestone-premium-locked', premLocked);
      row.onclick = premLocked ? () => Tracker.openPremium() : null;
      if (premLocked) row.style.cursor = 'pointer';
      else row.style.cursor = '';

      if (current >= m.days) {
        row.classList.add('milestone-active');
        nameEl.className  = 'milestone-name achieved';
        statEl.className  = 'milestone-status achieved';
        nameEl.textContent = nameEl.dataset.label;
        statEl.textContent = premLocked ? 'Premium' : journeyTrophyStatusDisplay(m.days, count, true);
      } else if (nextMilestone && m.days === nextMilestone.days) {
        row.classList.remove('milestone-active');
        nameEl.className  = 'milestone-name';
        statEl.className  = 'milestone-status';
        nameEl.textContent = milestoneLabel;
        statEl.textContent = premLocked ? 'Premium' : journeyTrophyStatusDisplay(m.days, count, false);
      } else {
        row.classList.remove('milestone-active');
        nameEl.className  = 'milestone-name';
        statEl.className  = 'milestone-status';
        nameEl.textContent = milestoneLabel;
        statEl.textContent = premLocked ? 'Premium' : journeyTrophyStatusDisplay(m.days, count, false);
      }
    });

    const taking = el('takingControlStage');
    const stageLabel = taking && taking.previousElementSibling;
    if (stageLabel && stageLabel.classList.contains('stage-label')) {
      stageLabel.classList.toggle('stage-premium-locked', !hasPremiumAccess());
    }
  },

  showModal(msg) {
    el('modalMessage').textContent = msg;
    el('confirmModal').classList.add('active');
    document.body.classList.add('modal-open');
  },
  hideModal() { el('confirmModal').classList.remove('active'); document.body.classList.remove('modal-open'); }
};


function computeAuditScore(q1, q2, q3) {
  return (q1 || 0) + (q2 || 0) + (q3 || 0);
}

// Returns which drinking behaviour is the biggest contributor
// Used to give personalised feedback in the meter card
function getLever(q1, q2, q3) {
  if (q1 >= q2 && q1 >= q3) return 'Drink less frequently.';
  if (q2 >= q1 && q2 >= q3) return 'Have fewer drinks per session.';
  return 'Reduce heavy sessions.';
}


// Returns true if a journey trophy should be awarded right now
function isTrophyEarned(successCount, trophyDays, celebratedTrophies) {
  return successCount === trophyDays && !celebratedTrophies[trophyDays];
}

function isScienceMilestoneEarned(streak, nodeDay, celebratedScienceMilestones) {
  return streak === nodeDay && !celebratedScienceMilestones[nodeDay];
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

// ─────────────────────────────────────────────────────────────
// WHY THIS ZONE — detailed body impact for each AUDIT-C zone
// ─────────────────────────────────────────────────────────────
const ZONE_DETAILS = {
  'Sober': {
    color: '#1a7a34',
    bg:    'rgba(26,122,52,0.06)',
    items: [
      { organ:'🫀', system:'Heart',       impact:'Blood pressure at natural baseline. No alcohol-related cardiac stress.',                                                           cite:'' },
      { organ:'🧠', system:'Brain',       impact:'Natural dopamine and serotonin balance. No alcohol-induced cognitive suppression.',                                               cite:'' },
      { organ:'🫁', system:'Liver',       impact:'Liver enzymes within normal range. Zero alcohol processing load.',                                                                cite:'' },
      { organ:'🛡️', system:'Cancer risk', impact:'Lowest possible alcohol-attributable cancer risk across all organ systems.',                                                     cite:'IARC Monographs Vol. 100E, WHO' },
    ]
  },
  'Low Risk': {
    color: '#248a3d',
    bg:    'rgba(52,199,89,0.06)',
    items: [
      { organ:'🫀', system:'Heart',      impact:'Minimal additional cardiovascular risk at this frequency. Blood pressure marginally elevated on drinking days.',                   cite:'Ronksley et al., BMJ 2011' },
      { organ:'🧠', system:'Brain',      impact:'No measurable long-term cognitive impairment. Mild short-term suppression on drinking occasions.',                                cite:'Topiwala et al., BMJ 2017' },
      { organ:'🫁', system:'Liver',      impact:'Liver processing alcohol efficiently at this level. No clinically significant enzyme elevation.',                                  cite:'' },
      { organ:'⚠️', system:'Important', impact:'No level of alcohol is completely safe. Low Risk means lower risk — not zero risk.',                                              cite:'WHO Global Status Report on Alcohol, 2023' },
    ]
  },
  'Hazardous': {
    color: '#cc6600',
    bg:    'rgba(255,149,0,0.06)',
    items: [
      { organ:'🫀', system:'Heart',    impact:'Clinically significant blood pressure elevation. Risk of atrial fibrillation increases at this level.',                             cite:'Biddinger et al., JAMA 2022' },
      { organ:'🧠', system:'Brain',    impact:'Measurable reduction in brain grey matter volume. Memory and executive function impaired.',                                         cite:'Topiwala et al., BMJ 2017' },
      { organ:'🫁', system:'Liver',    impact:'Elevated liver enzymes (ALT, GGT) in most hazardous drinkers. Early fatty liver (steatosis) begins at this level.',               cite:'Naveau et al., Hepatology 1994' },
      { organ:'🛡️', system:'Cancer',  impact:'Risk of colorectal, breast, mouth and oesophageal cancers measurably elevated above Low Risk.',                                    cite:'IARC Monographs Vol. 100E, WHO' },
    ]
  },
  'Harmful': {
    color: '#cc2200',
    bg:    'rgba(255,59,48,0.06)',
    items: [
      { organ:'🫀', system:'Heart',    impact:'Alcoholic cardiomyopathy risk. Sustained blood pressure elevation leading to left ventricular hypertrophy.',                       cite:'Guzzo-Merello et al., World J Cardiol 2014' },
      { organ:'🧠', system:'Brain',    impact:'Progressive brain volume loss. Clinically significant memory impairment. Major depression and anxiety disorders confirmed.',        cite:'Oscar-Berman & Marinković, Alcohol Res Health 2007' },
      { organ:'🫁', system:'Liver',    impact:'Alcoholic hepatitis risk. Liver fibrosis confirmed in biopsy studies at this consumption level.',                                   cite:'Lackner et al., J Hepatol 2017' },
      { organ:'🛡️', system:'Cancer',  impact:'Significantly elevated risk of liver, colorectal, breast and oropharyngeal cancers. Risk increases linearly with consumption.',    cite:'IARC Monographs Vol. 100E, WHO' },
    ]
  },
  'Dependent': {
    color: '#7b0000',
    bg:    'rgba(123,0,0,0.06)',
    items: [
      { organ:'🫀', system:'Heart',       impact:'Dilated cardiomyopathy. Significantly elevated risk of stroke and sudden cardiac death.',                                        cite:'Piano, Alcohol Res 2017' },
      { organ:'🧠', system:'Brain',       impact:'Wernicke-Korsakoff syndrome risk (thiamine deficiency). Permanent memory loss possible. Structural brain atrophy on MRI.',     cite:'Thomson et al., Alcohol Alcohol 2012' },
      { organ:'🫁', system:'Liver',       impact:'Alcoholic cirrhosis risk. Liver failure and portal hypertension in long-term dependent drinkers.',                              cite:'Rehm et al., Lancet 2017' },
      { organ:'⚡', system:'Withdrawal',  impact:'Abrupt cessation causes GABA/glutamate imbalance — seizures and delirium tremens are life-threatening without medical support.',cite:'Bayard et al., Am Fam Physician 2004' },
    ]
  },
};

function getAuditZoneName(data) {
  if (!data || data.auditQ1 === null || data.auditQ1 === undefined) return null;
  if (data.auditQ2 === null || data.auditQ3 === null) return null;
  const score = typeof data.auditScore === 'number'
    ? data.auditScore
    : (data.auditQ1 + data.auditQ2 + data.auditQ3);
  return MeterController.ZONES[MeterController.getZoneIdx(score)].label;
}

function renderZoneDetailHtml(zoneDetail, items) {
  const list = items || zoneDetail.items;
  return list.map(item =>
    `<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid rgba(60,60,67,0.06);">
      <div style="font-size:16px;flex-shrink:0;width:22px;text-align:center;">${item.organ}</div>
      <div>
        <div style="font-size:11px;font-weight:700;color:${zoneDetail.color};margin-bottom:1px;">${item.system}</div>
        <div style="font-size:12px;color:rgba(60,60,67,0.65);line-height:1.5;">${item.impact}</div>
        ${item.cite ? `<div style="font-size:10px;color:rgba(60,60,67,0.35);margin-top:2px;">📄 ${item.cite}</div>` : ''}
      </div>
    </div>`
  ).join('');
}


// ═══════════════════════════════════════════════════════════════
// SCIENCE TIMELINE (Progress tab)
// Days 1–28 always visible; Day 30+ unlock progressively by streak.
// hiddenUntil = streak needed before milestone appears in the list.
// Drinking day resets streak → long-term milestones hide again.
// ═══════════════════════════════════════════════════════════════

const SCIENCE_NODES = [
  {
    day: 1, organ: '🫀', label: 'Day 1',
    title: 'Heart & Blood',
    change: 'Blood alcohol clears within 24 hours. Heart rate and blood pressure begin returning to baseline.',
    cite: '',
    c: { emoji: '🫀', title: 'Day 1 — Heart & Blood', msg: 'Blood alcohol is clearing. Heart rate and blood pressure are beginning to return to baseline.\n\nYour body noticed immediately.' }
  },
  {
    day: 3, organ: '🫁', label: 'Day 3',
    title: 'Liver & Bloodstream',
    change: 'Bloodstream fully alcohol-free. Liver enzymes (ALT, GGT) begin normalising. GABA receptors start rebalancing.',
    cite: '',
    c: { emoji: '🫁', title: 'Day 3 — Bloodstream Clear', msg: 'Your bloodstream is fully alcohol-free.\n\nLiver enzymes are normalising. GABA receptors are starting to rebalance.' }
  },
  {
    day: 7, organ: '🧠', label: 'Day 7',
    title: 'Brain Chemistry',
    change: 'Dopamine and serotonin systems measurably recovering. Anxiety significantly lower. Sleep architecture improving.',
    cite: '',
    c: { emoji: '🧠', title: 'Day 7 — Brain Chemistry', msg: 'One week. Dopamine and serotonin systems are measurably recovering.\n\nAnxiety is lower. Sleep architecture is improving.' }
  },
  {
    day: 14, organ: '🌿', label: 'Day 14',
    title: 'Liver & Blood Pressure',
    change: 'Early fatty liver reversal confirmed. Systolic blood pressure drops 5-10 mmHg on average. REM sleep restored.',
    cite: '',
    c: { emoji: '🌿', title: 'Day 14 — Two Weeks', msg: 'Early fatty liver reversal is confirmed. Blood pressure is dropping 5–10 mmHg on average.\n\nREM sleep is returning.' }
  },
  {
    day: 21, organ: '🛡️', label: 'Day 21',
    title: 'Immune System',
    change: 'NK cell activity and T-lymphocyte function measurably stronger. Inflammation markers (CRP) reduced. Gut microbiome recovering.',
    cite: '',
    c: { emoji: '🛡️', title: 'Day 21 — Immune System', msg: 'Three weeks. NK cell activity and T-lymphocyte function are measurably stronger.\n\nInflammation markers are down. Your gut microbiome is recovering.' }
  },
  {
    day: 28, organ: '💎', label: 'Day 28',
    title: 'Full Month',
    change: 'Liver enzymes within normal range for most hazardous drinkers. Brain grey matter volume stabilising. Cardiovascular risk measurably reduced.',
    cite: '',
    c: { emoji: '💎', title: 'Day 28 — Full Month', msg: 'Four weeks without alcohol.\n\nLiver enzymes are in normal range for most hazardous drinkers. Brain grey matter is stabilising. Cardiovascular risk is measurably reduced.' }
  },
  {
    day: 30, organ: '🫀', label: 'Day 30',
    title: 'Blood Pressure & Cancer Risk',
    change: 'Blood pressure reduction equivalent to one antihypertensive medication dose (Roerecke et al., Lancet 2017). Cancer risk reduction begins to be measurable.',
    cite: 'Roerecke et al., Lancet 2017',
    hiddenUntil: 28,
    c: { emoji: '🫀', title: 'Day 30 — Blood Pressure', msg: '30 days. Blood pressure reduction equivalent to one antihypertensive medication dose.\n\nCancer risk reduction is beginning to be measurable.' }
  },
  {
    day: 60, organ: '🧠', label: 'Day 60',
    title: 'Liver & Cognition',
    change: 'Liver fat largely cleared in moderate drinkers. Cognitive function — memory, processing speed — measurably improved (Rao et al., 2000).',
    cite: 'Rao et al., 2000',
    hiddenUntil: 30,
    c: { emoji: '🧠', title: 'Day 60 — Liver & Cognition', msg: '60 days. Liver fat is largely cleared in moderate drinkers.\n\nMemory and processing speed are measurably improved.' }
  },
  {
    day: 90, organ: '🧬', label: 'Day 90',
    title: 'Brain, Heart & Gut',
    change: 'Neuroplasticity significantly recovered. Risk of alcohol-related cardiac events reduced by 30%. Gut microbiome substantially restored (Leclercq et al., 2014).',
    cite: 'Leclercq et al., 2014',
    hiddenUntil: 60,
    c: { emoji: '🧬', title: 'Day 90 — Brain, Heart & Gut', msg: '90 days. Neuroplasticity has significantly recovered.\n\nCardiac event risk is down 30%. Your gut microbiome is substantially restored.' }
  },
  {
    day: 180, organ: '🫁', label: 'Day 180',
    title: 'Liver Recovery & Immunity',
    change: 'Liver fibrosis begins reversing in early-stage cases. Immune system largely restored.',
    cite: '',
    hiddenUntil: 60,
    c: { emoji: '🫁', title: 'Day 180 — Liver Recovery', msg: '180 days. Liver fibrosis is beginning to reverse in early-stage cases.\n\nYour immune system is largely restored.' }
  },
  {
    day: 365, organ: '💚', label: 'Day 365',
    title: 'Cardiovascular Reset',
    change: 'Cardiovascular risk profile equivalent to a non-drinker (Ronksley et al., BMJ 2011).',
    cite: 'Ronksley et al., BMJ 2011',
    hiddenUntil: 180,
    c: { emoji: '💚', title: 'Day 365 — One Full Year', msg: 'One year sober.\n\nCardiovascular risk profile equivalent to a non-drinker.\n\nThis is not luck. This is who you are.' }
  },
];

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

function renderScienceTimeline(currentStreak) {
  const container = el('scienceTimeline');
  if (!container) return;

  const nodes = getVisibleScienceNodes(currentStreak);
  let html = '';

  nodes.forEach((node, i) => {
    const achieved  = currentStreak >= node.day;
    const isCurrent = currentStreak > 0 && (
      i === nodes.length - 1
        ? achieved
        : currentStreak >= node.day && currentStreak < nodes[i + 1].day
    );
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
  console.error('SoberJourney error:', msg, 'at', src, line, col);
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
  console.error('SoberJourney unhandled promise:', e.reason);
});

// ═══════════════════════════════════════════════════════════════
// BOOT — runs once when page loads
// ═══════════════════════════════════════════════════════════════
function scrollToPostTestView() {
  function run() {
    const scoreEl = el('currentCard');
    const meterCard = el('assessBtn') && el('assessBtn').closest('.card');
    const reduction = el('reductionTargetCard');
    const lowRisk = el('lowRiskZoneCard');
    if (!meterCard) return;

    const vh = window.innerHeight;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

    const topStart = (scoreEl || meterCard).getBoundingClientRect().top + scrollY;
    const topEnd = meterCard.getBoundingClientRect().bottom + scrollY;

    let bottomStart = topEnd;
    if (reduction && reduction.style.display !== 'none') {
      bottomStart = reduction.getBoundingClientRect().top + scrollY;
    } else if (lowRisk) {
      bottomStart = lowRisk.getBoundingClientRect().top + scrollY;
    }

    const bottomEnd = lowRisk
      ? lowRisk.getBoundingClientRect().bottom + scrollY
      : (reduction && reduction.style.display !== 'none'
          ? reduction.getBoundingClientRect().bottom + scrollY
          : bottomStart + 140);

    // Place boundary between meter (top block) and targets (bottom block) at screen centre
    const splitY = (topEnd + bottomStart) / 2;
    let target = splitY - vh / 2;

    const minScroll = topStart - vh * 0.06;
    const maxScroll = Math.max(0, bottomEnd - vh * 0.94);
    target = Math.max(minScroll, Math.min(target, maxScroll));
    target = Math.max(0, target);

    window.scrollTo({ top: target, behavior: 'smooth' });
  }

  requestAnimationFrame(() => setTimeout(run, 80));
  setTimeout(run, 320);
}

function dismissWelcomeHint() {
  try { localStorage.setItem('sj_welcome_dismissed', '1'); } catch (e) {}
  const card = el('welcomeHint');
  if (card) card.style.display = 'none';
}

function renderWelcomeHint(data) {
  const card = el('welcomeHint');
  if (!card || !data || !data.currentScore) return;
  let dismissed = false;
  try { dismissed = localStorage.getItem('sj_welcome_dismissed') === '1'; } catch (e) {}
  const isFresh = data.attempt === 1
    && data.currentScore.success === 0
    && data.currentScore.failures === 0
    && data.todayStatus === 'none'
    && !data.journeyPendingReset;
  card.style.display = (!dismissed && isFresh) ? 'block' : 'none';
}

function applyTestUIChrome() {
  const active = !!CONFIG.showTestUI;
  document.body.classList.toggle('test-ui-active', active);
  const tb = el('testBtns');
  if (tb) tb.style.display = active ? 'block' : 'none';
  const tag = el('testBuildTag');
  if (tag) tag.textContent = active ? ('Build: ' + (CONFIG.buildTag || 'dev')) : '';
  updatePremiumLockTestBtn();
}

function applyDevChrome() {
  if (CONFIG.isProduction) {
    document.title = 'Sober Journey';
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


