/* ===== src/ui/body-timeline.js ===== */
'use strict';

// Body recovery timeline helpers (used by ui/timeline.js)
function getBodyTimelineWindow(timelineDay) {
  const WINDOW = 7;
  const day = timelineDay | 0;
  if (day <= 0) return { start: 1, end: WINDOW };
  const blockIndex = Math.floor((day - 1) / WINDOW);
  const start = blockIndex * WINDOW + 1;
  return { start, end: start + WINDOW - 1 };
}

function syncBodyTimelineWeekHold(data) {
  if (!data) return;
  const streak = data.currentStreak | 0;
  const cal = data.calendarDay | 0;
  if (streak >= 7 && streak % 7 === 0) {
    if ((data.bodyTimelineWeekBlock | 0) !== streak) {
      data.bodyTimelineWeekBlock   = streak;
      data.bodyTimelineWeekHoldCal = cal;
    }
  }
}

function getBodyTimelineTimelineDay(data, streak) {
  if ((streak | 0) <= 0) return 0;
  const cal = data.calendarDay | 0;
  const block   = data.bodyTimelineWeekBlock | 0;
  const holdCal = data.bodyTimelineWeekHoldCal | 0;
  if (block >= 7 && block % 7 === 0 && streak >= block && streak < block + 1 && holdCal > 0) {
    if (cal <= holdCal) return streak;
    return block + 1;
  }
  return streak;
}

// 0 before noon, 0.5 after — dot moves halfway toward the next target
function getHalfProgressAtTime(when) {
  const t = when instanceof Date ? when : new Date(when);
  if (isNaN(t.getTime())) return 0;
  const hours = t.getHours() + t.getMinutes() / 60 + t.getSeconds() / 3600;
  return hours >= 12 ? 0.5 : 0;
}

function getBodyTimelineHalfProgress(data) {
  if (CONFIG.showTestUI && data && data.simulatedToday) {
    const sim = new Date(data.simulatedToday);
    if (!isNaN(sim.getTime())) {
      const hours = sim.getHours() + sim.getMinutes() / 60;
      if (hours !== 12 || sim.getMinutes() !== 0) {
        return hours >= 12 ? 0.5 : 0;
      }
    }
  }
  return getHalfProgressAtTime(new Date());
}

// Half-progress frozen when the user logged a drink (wall-clock at tap time)
function getDrinkDayFrozenProgress(data) {
  if (!data || !isDrinkingDayToday(data)) return 0;
  const todayKey = dateKey(getAppToday(data));
  if (data.drinkDayFrozenKey !== todayKey) return 0;
  return Number(data.drinkDayFrozenProgress) >= 0.5 ? 0.5 : 0;
}

function bodyTimelineDrinkBridgeHtml(drinkProgress, green, amber, dim) {
  if (Number(drinkProgress) >= 0.5) {
    return `<div class="body-timeline-bridge-to-next body-timeline-bridge--drink-split" style="flex:1;display:flex;height:2px;align-self:center;">
      <div style="flex:1;background:${green};height:2px;"></div>
      <div style="flex:1;background:${amber};height:2px;"></div>
    </div>`;
  }
  return `<div class="body-timeline-bridge-to-next" style="flex:1;height:2px;background:${amber};align-self:center;"></div>`;
}

const BODY_TIMELINE_FIXED_COL = 14;
const BODY_TIMELINE_FIXED_R   = 7;
const BODY_TIMELINE_NEXT_R    = 4;
const BODY_TIMELINE_START_COL = 12;
const BODY_TIMELINE_START_R   = 6;

function bodyTimelineSpanToNext(bridgeW) {
  return bridgeW + (BODY_TIMELINE_FIXED_COL - BODY_TIMELINE_FIXED_R) + BODY_TIMELINE_NEXT_R;
}

function bodyTimelineSpanStartToDay1(bridgeW) {
  return bridgeW + (BODY_TIMELINE_START_COL - BODY_TIMELINE_START_R) + BODY_TIMELINE_NEXT_R;
}

function getBodyTimelineWeekAnchor(timelineDay) {
  if ((timelineDay | 0) <= 7) return null;
  const { start } = getBodyTimelineWindow(timelineDay);
  return start > 1 ? start - 1 : null;
}

// Single source of truth for dot behaviour
function getBodyTimelinePhase(data) {
  const drinkingToday = isDrinkingDayToday(data);
  const today = getAppToday(data);
  const todayKey = dateKey(today);
  const log = data.dailyLog || {};
  const scored = data.scoredDays || {};
  const loggedSoberToday = log[todayKey] === 'sober' && !!scored[todayKey];

  const yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12, 0, 0);
  const yestKey = dateKey(yest);
  const yesterdaySober = log[yestKey] === 'sober';
  const postDrinkRestart = isPostDrinkRestartDay(data);

  let streak = getDisplayStreak(data);
  if (postDrinkRestart) streak = 0;

  syncBodyTimelineWeekHold(data);

  let anchorDay = 0;
  let travel = false;
  let frozen = false;
  let amber = false;

  if (drinkingToday) {
    const achievedBeforeDrink = getDisplayStreak(data);
    streak = achievedBeforeDrink;
    // Amber sits on the day being attempted (Day 3 after 2 sober days), not the last achieved day
    anchorDay = Math.max(1, achievedBeforeDrink + 1);
    frozen = true;
    amber = true;
  } else if (loggedSoberToday) {
    anchorDay = data.currentStreak | 0;
    streak = anchorDay;
    frozen = true;
  } else if (postDrinkRestart) {
    anchorDay = 0;
    travel = true;
  } else if ((streak | 0) > 0 && yesterdaySober) {
    anchorDay = streak;
    travel = true;
  } else {
    anchorDay = 0;
    travel = true;
  }

  // Post-drink and fresh journeys always use week-one strip with Start visible
  const timelineDay = postDrinkRestart ? 0 : ((streak | 0) > 0 ? getBodyTimelineTimelineDay(data, streak) : 0);
  let stripDay;
  if (postDrinkRestart || (anchorDay === 0 && travel && !frozen)) {
    stripDay = 1;
  } else if (amber && frozen && anchorDay > 0) {
    stripDay = Math.max(anchorDay, timelineDay > 0 ? timelineDay : 1);
  } else {
    stripDay = timelineDay > 0 ? timelineDay : 1;
  }
  const { start, end } = getBodyTimelineWindow(stripDay);
  const weekAnchor = getBodyTimelineWeekAnchor(stripDay);
  const showWeekAnchor = weekAnchor !== null;

  const holdBlock = data.bodyTimelineWeekBlock | 0;
  const holdCal = data.bodyTimelineWeekHoldCal | 0;
  const onMilestoneHold = holdBlock === streak && streak >= 7 && streak % 7 === 0 && (data.calendarDay | 0) <= holdCal;

  const progress = (travel && !frozen) ? getBodyTimelineHalfProgress(data) : 0;
  const drinkBridgeProgress = (amber && frozen) ? getDrinkDayFrozenProgress(data) : 0;
  const travelFromWeekAnchor = showWeekAnchor && travel && anchorDay === weekAnchor && !frozen;

  return {
    streak, anchorDay, travel, frozen, amber, progress, drinkBridgeProgress,
    timelineDay, start, end, weekAnchor, showWeekAnchor,
    travelFromWeekAnchor, onMilestoneHold, postDrinkRestart,
  };
}

function positionBodyTimelineActiveDot(dotsEl) {
  const wrap = dotsEl.querySelector('.body-timeline-dot-active-wrap[data-active="1"]');
  if (!wrap) return;

  const col = wrap.closest('.body-timeline-current-col, .body-timeline-start-col');
  if (!col) return;

  const isStart = wrap.dataset.startActive === '1';
  const isWeekAnchor = wrap.dataset.weekAnchorActive === '1';
  const bridgeOrigin = isStart || isWeekAnchor;
  const progress = parseFloat(wrap.dataset.progress || '0') || 0;
  const bridge = col.nextElementSibling;
  const fillEl = bridge?.querySelector('.body-timeline-bridge-fill');
  const spanFn = bridgeOrigin ? bodyTimelineSpanStartToDay1 : bodyTimelineSpanToNext;
  const originR = bridgeOrigin ? BODY_TIMELINE_START_R : BODY_TIMELINE_FIXED_R;
  const originCol = bridgeOrigin ? BODY_TIMELINE_START_COL : BODY_TIMELINE_FIXED_COL;
  const bridgeLive = bridge?.classList.contains('body-timeline-bridge--live');
  let centerX = originR;

  if (bridgeLive) {
    const bridgeW = bridge ? bridge.offsetWidth : 0;
    centerX = originR;
    if (progress > 0 && bridgeW > 0) {
      centerX = originR + progress * spanFn(bridgeW);
      if (fillEl) {
        const fillPx = Math.max(0, Math.min(bridgeW, centerX - originCol));
        fillEl.style.width = `${(fillPx / bridgeW) * 100}%`;
      }
    } else if (fillEl) {
      fillEl.style.width = '0%';
    }
  } else if (fillEl) {
    fillEl.style.width = '0%';
  }

  wrap.style.left = `${centerX}px`;
  wrap.style.top = '50%';
  wrap.style.transform = 'translate(-50%, -50%)';
}

function getBodyFact(day) {
  if (BODY_FACTS[day]) return BODY_FACTS[day];
  return {
    organ: '🌟',
    title: `Day ${day}`,
    text: 'Each sober day ahead can bring stronger circulation, a clearer mind, and a steadier mood — keep going.',
  };
}

function getBodyTimelineDisplayDay(data, phase) {
  const p = phase || getBodyTimelinePhase(data);
  if (p.amber && p.frozen) return Math.max(0, p.anchorDay);
  if (p.anchorDay <= 0) {
    if (isPostDrinkRestartDay(data)) return 1;
    if (p.travel && p.progress >= 0.5) return 1;
    return 0;
  }
  if (p.frozen || p.onMilestoneHold) return p.anchorDay;
  if (p.travelFromWeekAnchor) {
    const target = p.weekAnchor + 1;
    if (p.progress >= 0.5 && target <= p.end) return target;
    return p.anchorDay;
  }
  if (p.travel) {
    const target = p.anchorDay + 1;
    if (p.progress >= 0.5 && target <= p.end) return target;
    return p.anchorDay;
  }
  return p.anchorDay;
}

function applyBodyTimelineContent(titleEl, textEl, displayDay) {
  const fact = getBodyFact(displayDay);
  titleEl.textContent = `${fact.organ} ${fact.title}`;
  textEl.textContent  = fact.text;
}

const BODY_FACTS = {
  0:  { organ:'🕐', title:'Your body today',           text:'Start your streak to unlock what your body can do — one day at a time.' },
  1:  { organ:'🫧', title:'Day 1 — Clearing',          text:'Your heart rate will begin to settle. Alcohol will start leaving your system. The first step unlocks everything ahead.' },
  2:  { organ:'💧', title:'Day 2 — Hydrating',         text:'Your body will rehydrate fully. Blood alcohol can drop to zero. Brain fog will start to lift.' },
  3:  { organ:'🧬', title:'Day 3 — Bloodstream clear', text:'Alcohol can clear from your bloodstream. Liver enzymes will move back toward normal.' },
  4:  { organ:'🌙', title:'Day 4 — Sleep returns',     text:'REM sleep can return. Deeper, more restful nights lie ahead.' },
  5:  { organ:'❤️', title:'Day 5 — Heart easing',      text:'Blood pressure can fall measurably. Your heart will work less hard.' },
  6:  { organ:'⚡', title:'Day 6 — Energy rising',     text:'Natural energy will return. Less fatigue, more focus — within reach.' },
  7:  { organ:'🧠', title:'Day 7 — Brain resetting',   text:'Brain chemistry will reset. Dopamine receptors recover. Anxiety can drop measurably.' },
  8:  { organ:'💧', title:'Day 8 — Clarity',           text:'Mental clarity sharpens. Kidneys can work at full efficiency again.' },
  9:  { organ:'🫁', title:'Day 9 — Breathing',         text:'Lung function improves. Immune cells rebuild — your body fighting back.' },
  10: { organ:'🌱', title:'Day 10 — Rebuilding',       text:'Liver cells repair actively. Fatty deposits begin to clear. Blood sugar steadies.' },
  11: { organ:'🧠', title:'Day 11 — Mood',             text:'Serotonin rises naturally. Mood can stabilise — a reward worth chasing.' },
  12: { organ:'🫀', title:'Day 12 — Circulation',      text:'Blood circulation improves. Skin hydration looks visibly better.' },
  13: { organ:'😴', title:'Day 13 — Deep sleep',       text:'Deep sleep cycles lengthen. Your body repairs more each night.' },
  14: { organ:'🌿', title:'Day 14 — Two weeks',        text:'Real change takes hold. Liver can clear fatty buildup. Blood pressure may drop 5–10 mmHg. Brain fog fades.' },
  15: { organ:'💪', title:'Day 15 — Strength',         text:'Muscle recovery improves. Better physical performance awaits.' },
  16: { organ:'🧠', title:'Day 16 — Memory',           text:'Working memory improves measurably. Concentration spans grow longer.' },
  17: { organ:'🫁', title:'Day 17 — Immunity',         text:'White blood cells normalise. Immune response grows stronger.' },
  18: { organ:'🌱', title:'Day 18 — Gut health',       text:'Gut microbiome recovers. Bloating and discomfort ease.' },
  19: { organ:'🫀', title:'Day 19 — Cholesterol',      text:'LDL cholesterol begins to drop. Cardiovascular risk falls.' },
  20: { organ:'⚡', title:'Day 20 — Vitality',         text:'Energy rises well above Day 1. Natural dopamine system comes back online.' },
  21: { organ:'💚', title:'Day 21 — Three weeks',      text:'Immune system grows stronger. Inflammation markers can fall — keep going.' },
  22: { organ:'🧠', title:'Day 22 — Rewiring',         text:'Brain rewires reward pathways. Cravings grow weaker day by day.' },
  23: { organ:'🫁', title:'Day 23 — Oxygen',           text:'Oxygen-carrying capacity improves. You will feel measurably fitter than three weeks ago.' },
  24: { organ:'🌿', title:'Day 24 — Skin',             text:'Skin collagen production rises. Puffiness fades.' },
  25: { organ:'🫀', title:'Day 25 — Heart',            text:'Coronary arteries dilate better. Heart attack risk can fall measurably.' },
  26: { organ:'💧', title:'Day 26 — Liver',            text:'Liver enzymes can sit in the normal range — for most people, within reach.' },
  27: { organ:'😴', title:'Day 27 — Rest',             text:'Sleep architecture restores fully. Night waking drops significantly.' },
  28: { organ:'💎', title:'Day 28 — One month',        text:'Liver function largely restores. Brain chemistry stabilises. You will be measurably healthier than Day 1.' },
};
