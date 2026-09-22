/* ===== src/constants/milestones.js ===== */
'use strict';
const STREAK_MILESTONES = [
  { id:'day1', days:1, el:'cs-day1', name:'Day 1 — First Step',
    c:{ emoji:'🌞', title:'First Step!', msg:"The hardest step is the first. You took it.\n\n🫧 Blood alcohol clearing. Liver beginning to filter. Heart rate normalising." }},
  { id:'day2', days:2, el:'cs-day2', name:'Day 2 — Still Going',
    c:{ emoji:'🚶', title:'Still Going!', msg:"Day 2. Most people stop here. You didn't.\n\n💧 Fully hydrated. Blood alcohol at zero. Brain fog beginning to lift." }},
  { id:'day3', days:3, el:'cs-day3', name:'Day 3 — Bloodstream Clear',
    c:{ emoji:'🔥', title:'Breaking Through!', msg:"3 days strong! The physical withdrawal is easing.\n\n🧬 Alcohol fully cleared from bloodstream. Liver enzymes returning to normal." }},
  { id:'day4', days:4, el:'cs-day4', name:'Day 4 — Sleep Returns',
    c:{ emoji:'🌙', title:'Sleep Returns!', msg:"Day 4. Your body is starting to repair overnight.\n\n🌙 REM sleep returning. You will notice deeper, more restful sleep tonight." }},
  { id:'day5', days:5, el:'cs-day5', name:'Day 5 — Heart Easing',
    c:{ emoji:'💚', title:'Heart Easing!', msg:"5 days. You are halfway through your first week.\n\n❤️ Blood pressure measurably lower. Heart working less hard." }},
  { id:'day6', days:6, el:'cs-day6', name:'Day 6 — Energy Rising',
    c:{ emoji:'⚡', title:'Energy Rising!', msg:"6 days. One more and you have a full week.\n\n⚡ Natural energy returning. Less fatigue, more focus." }},
  { id:'day7', days:7, el:'cs-day7', name:'Day 7 — One Full Week',
    c:{ emoji:'🌟', title:'One Full Week!', msg:"7 days. One complete week without alcohol.\n\n🧠 Brain chemistry actively resetting. Dopamine receptors recovering. Anxiety measurably lower.\n\nBy WHO frequency standards — you are now out of the Hazardous zone for the week." }},
];

// Progress tab shares Day 1/3/7 with Streak — Streak popup wins; skip Progress celebration.
const STREAK_SCIENCE_OVERLAP_DAYS = new Set(STREAK_MILESTONES.map(m => m.days));

function markStreakOwnedScienceCelebrated(data, day) {
  if (!STREAK_SCIENCE_OVERLAP_DAYS.has(day)) return;
  if (!data.celebratedScienceMilestones) data.celebratedScienceMilestones = {};
  data.celebratedScienceMilestones[day] = true;
}

const JOURNEY_TROPHIES = [
  { days:10,  el:'jm-10',  label:'10 Days — First Win',          c:{ emoji:'⚡', title:'First Win!',          msg:"10 sober days. Your first real milestone. Sober days now equal your drinking days. You are no longer losing." }},
  { days:15,  el:'jm-15',  label:'15 Days — Holding Ground',     c:{ emoji:'🌿', title:'Holding Ground!',     msg:"15 sober days. Sober days now outnumber drinking days. For the first time — you are ahead. The tide has turned." }},
  { days:20,  el:'jm-20',  label:'20 Days — Getting Ahead',      c:{ emoji:'🌟', title:'Getting Ahead!',      msg:"20 sober days. Twice as many sober days as drinking days. Your liver is getting the recovery it needs." }},
  { days:30,  el:'jm-30',  label:'30 Days — Momentum',           c:{ emoji:'💪', title:'Momentum!',           msg:"30 sober days. Three sober days for every drinking day. Your brain is remembering what normal feels like. This is recovery." }},
  { days:40,  el:'jm-40',  label:'40 Days — Building Habit',     c:{ emoji:'🎯', title:'Building Habit!',     msg:"40 sober days. Four sober days for every drinking day. This is no longer a struggle. This is becoming who you are." }},
  { days:50,  el:'jm-50',  label:'50 Days — Half Century',       c:{ emoji:'🌱', title:'Half Century!',       msg:"50 sober days. Five for every one. You have built a pattern that your body now expects. Keep it." }},
  { days:60,  el:'jm-60',  label:'60 Days — Turning Point',      c:{ emoji:'✨', title:'Turning Point!',      msg:"60 sober days. Six sober days for every drinking day. You are approaching every clinical safe limit. The summit is visible." }},
  { days:80,  el:'jm-80',  label:'80 Days — Low Risk',           c:{ emoji:'🏔️', title:'Low Risk!',          msg:"80 sober days. You are drinking less often than most people globally.\n\nAt this frequency — you are low risk IF each drinking day stays within:\n🥃 Whisky — 1 peg (60ml) or 🍺 Beer — 1 bottle (330ml)\n\nYou control the days. Now control the pour." }},
  { days:100, el:'jm-100', label:'100 Days — Weekend Drinker',   c:{ emoji:'💎', title:'Weekend Drinker!', msg:"100 sober days. Weekend drinker by frequency — body fully recovers between occasions.\n\n2–4 drinking days a month, 3–4 pegs each, never binge. You control the days. Now control the pour." }},
  { days:150, el:'jm-150', label:'150 Days — Sustained Control', c:{ emoji:'🏆', title:'Sustained Control!', msg:"150 sober days in one journey. You are not just occasional — you are in control.\n\nYour body has had months to heal. This pattern is yours now." }},
  { days:200, el:'jm-200', label:'200 Days — Occasional Drinker', c:{ emoji:'👑', title:'Occasional Drinker!', msg:"200 sober days. Occasional drinker by every clinical definition.\n\nThey said quit. You said control. Less is always better — WHO: no level of alcohol is completely safe." }},
];

const JOURNEY_MILESTONE_SECTIONS = [
  {
    labelId: 'journeyStageEarly',
    labelClass: 'stage-building',
    containerId: 'journeySectionEarly',
    days: [10, 15, 20],
    alwaysVisibleDays: [10, 15],
  },
  {
    labelId: 'journeyStageForward',
    labelClass: 'stage-improving',
    containerId: 'journeySectionForward',
    days: [30, 40, 50],
  },
  {
    labelId: 'journeyStageControl',
    labelClass: 'stage-safe',
    containerId: 'journeySectionControl',
    days: [60, 80, 100],
  },
  {
    labelId: 'inControlStageLabel',
    labelClass: 'stage-incontrol',
    containerId: 'journeySectionInControl',
    days: [150, 200],
  },
];

const JOURNEY_SOBER_TARGET_DAYS = JOURNEY_TROPHIES.map(m => m.days);

// Popup-only sober-day targets per journey (not shown in Journey tab).
// Inserts prior best (e.g. 43) between standard milestones when beating last journey matters.
function buildJourneyTargetChain(beatTarget) {
  const chain = [...JOURNEY_SOBER_TARGET_DAYS];
  const beat = beatTarget | 0;
  if (beat <= 0 || chain.includes(beat)) return chain;
  if (beat <= chain[0]) return chain;
  const insertAt = chain.findIndex(d => d > beat);
  if (insertAt < 0) return chain;
  if (beat <= chain[insertAt - 1]) return chain;
  chain.splice(insertAt, 0, beat);
  return chain;
}

function ensureJourneyTargetChain(data) {
  if (!data.celebratedJourneyTargets) data.celebratedJourneyTargets = {};
  if (data.journeyTargetChain && data.journeyTargetChain.length) return;
  const beat = getBestCompletedJourneyScore(data).success;
  data.journeyBeatTarget = beat;
  data.journeyTargetChain = buildJourneyTargetChain(beat);
  const s = data.currentScore?.success | 0;
  if (s > 1) {
    data.journeyTargetStartShown = true;
    for (const days of data.journeyTargetChain) {
      if (days < s) data.celebratedJourneyTargets[days] = true;
      else break;
    }
  }
}

function journeyTargetNextMessage(nextDays, beatTarget) {
  const beat = beatTarget | 0;
  if (nextDays === beat && beat > 0) {
    return `Your next target is ${nextDays} sober days — beat your best score!`;
  }
  return `Your next target is ${nextDays} sober days.`;
}

const JOURNEY_TROPHY_COUNT_DAYS = new Set([50, 100, 150, 200]);

function journeyTrophyStatusText(days, count) {
  if (!JOURNEY_TROPHY_COUNT_DAYS.has(days)) return '✓';
  if (count <= 0) return '';
  return `\u00d7${count}`;
}

function journeyTrophyStatusDisplay(days, count, achieved) {
  if (JOURNEY_TROPHY_COUNT_DAYS.has(days) && count > 0) {
    return journeyTrophyStatusText(days, count);
  }
  if (achieved) return journeyTrophyStatusText(days, count);
  return '';
}

function syncJourneyMilestonesRevealed(data) {
  if (!data.journeyMilestonesRevealed) data.journeyMilestonesRevealed = { 150: false, 200: false };
  const current = data.currentScore.success | 0;
  const trophies = data.journeyTrophies || {};
  let changed = false;
  if (current >= 100 || (trophies[150] || 0) > 0) {
    if (!data.journeyMilestonesRevealed[150]) { data.journeyMilestonesRevealed[150] = true; changed = true; }
  }
  if (current >= 150 || (trophies[200] || 0) > 0) {
    if (!data.journeyMilestonesRevealed[200]) { data.journeyMilestonesRevealed[200] = true; changed = true; }
  }
  return changed;
}

function maxJourneySoberDaysEver(data) {
  const current = data.currentScore?.success | 0;
  let max = current;
  for (const j of data.completedJourneys || []) {
    const s = j.score?.success | 0;
    if (s > max) max = s;
  }
  return max;
}

function getMilestoneUnlockAt(day, alwaysVisible) {
  if (alwaysVisible) return 0;
  const idx = JOURNEY_TROPHIES.findIndex(m => m.days === day);
  if (idx <= 0) return 0;
  return JOURNEY_TROPHIES[idx - 1].days;
}

function isJourneyMilestonePreviouslyAchieved(data, day) {
  const current = data.currentScore?.success | 0;
  if (current >= day) return false;
  return ((data.journeyTrophies && data.journeyTrophies[day]) || 0) > 0;
}

function isJourneyMilestoneRevealed(data, unlockAt) {
  const current = data.currentScore?.success | 0;
  const gate = unlockAt | 0;
  return current >= gate || maxJourneySoberDaysEver(data) >= gate;
}

function lockedMilestoneSlotsForSection(unrevealedCount) {
  if (unrevealedCount <= 0) return 0;
  if (unrevealedCount > 1) return Math.min(unrevealedCount - 1, 2);
  return 1;
}

function countUnrevealedJourneyMilestones(data, milestones) {
  let n = 0;
  for (const m of milestones) {
    if (!isJourneyMilestoneRevealed(data, m.unlockAt)) n++;
  }
  return n;
}

function getNextSectionUnlockAt(data, milestones) {
  for (const m of milestones) {
    if (!isJourneyMilestoneRevealed(data, m.unlockAt)) return m.unlockAt;
  }
  return 0;
}

function formatJourneyMilestoneUnlockHint(unlockAt) {
  const day = unlockAt | 0;
  if (day <= 0) return 'Keep going to unlock';
  return `Log ${day} sober day${day === 1 ? '' : 's'} to unlock`;
}

function isTakingControlStageAchieved(data) {
  const current = data.currentScore?.success | 0;
  if (current >= 100) return true;
  if (maxJourneySoberDaysEver(data) >= 100) return true;
  const trophies = data.journeyTrophies || {};
  return (trophies[100] || 0) > 0 || (trophies[150] || 0) > 0 || (trophies[200] || 0) > 0;
}

function expandJourneySectionMilestones(section) {
  const alwaysVisibleDays = section.alwaysVisibleDays || [];
  return section.days.map(day => {
    const meta = JOURNEY_TROPHIES.find(m => m.days === day);
    const alwaysVisible = alwaysVisibleDays.includes(day);
    return Object.assign({}, meta, {
      unlockAt: getMilestoneUnlockAt(day, alwaysVisible),
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// UI MANAGER
// ═══════════════════════════════════════════════════════════════
