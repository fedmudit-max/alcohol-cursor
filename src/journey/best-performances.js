/* ===== src/journey/best-performances.js ===== */
'use strict';

// Top-3 historical streaks & journeys (read-only). Uses journey/streak persisted state.

const BEST_PERFORMANCES_RANK_COUNT = 3;
const BEST_PERFORMANCES_MEDALS = ['🥇', '🥈', '🥉'];

function isAwaitingNextJourney(data) {
  return !!(data && data.journeyPendingReset);
}

function streakRecordId(attempt, segmentIndex) {
  return 'streak:' + attempt + ':' + segmentIndex;
}

function liveStreakRecordId(attempt) {
  return 'streak:' + attempt + ':live';
}

function completedJourneyRecordId(attempt) {
  return 'journey:' + attempt + ':completed';
}

function liveJourneyRecordId(attempt) {
  return 'journey:' + attempt + ':live';
}

function collectStreakRecords(data) {
  data = data || {};
  const out = [];
  const past = data.pastJourneyStreaks || [];
  for (let pi = 0; pi < past.length; pi++) {
    const journey = past[pi];
    const attempt = Math.max(1, Math.floor(Number(journey.attempt) || 1));
    const streaks = journey.streaks || [];
    for (let si = 0; si < streaks.length; si++) {
      const days = Math.floor(Number(streaks[si]) || 0);
      if (days <= 0) continue;
      out.push({
        id: streakRecordId(attempt, si),
        days,
        attempt,
        segmentIndex: si,
        sortKey: attempt * 10000 + si,
      });
    }
  }

  if (!isAwaitingNextJourney(data)) {
    const curAttempt = Math.max(1, Math.floor(Number(data.attempt) || 1));
    const curSegments = data.currentJourneyStreaks || [];
    for (let ci = 0; ci < curSegments.length; ci++) {
      const cdays = Math.floor(Number(curSegments[ci]) || 0);
      if (cdays <= 0) continue;
      out.push({
        id: streakRecordId(curAttempt, ci),
        days: cdays,
        attempt: curAttempt,
        segmentIndex: ci,
        sortKey: curAttempt * 10000 + ci,
      });
    }
    const liveDays = Math.floor(Number(data.currentStreak) || 0);
    if (liveDays > 0) {
      out.push({
        id: liveStreakRecordId(curAttempt),
        days: liveDays,
        attempt: curAttempt,
        segmentIndex: -1,
        sortKey: curAttempt * 10000 + 9999,
      });
    }
  }

  return out;
}

function getActiveStreakRecordId(data) {
  data = data || {};
  if (isAwaitingNextJourney(data)) return null;
  const liveDays = Math.floor(Number(data.currentStreak) || 0);
  if (liveDays <= 0) return null;
  const attempt = Math.max(1, Math.floor(Number(data.attempt) || 1));
  return liveStreakRecordId(attempt);
}

function compareStreakRecords(a, b) {
  if (b.days !== a.days) return b.days - a.days;
  if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
  return String(a.id).localeCompare(String(b.id));
}

function hasActiveJourneySeriesForBest(data) {
  data = data || {};
  const score = data.currentScore || {};
  if ((score.success | 0) > 0) return true;
  if ((score.failures | 0) > 0) return true;
  if ((data.currentStreak | 0) > 0) return true;
  if ((data.currentJourneyStreaks || []).length > 0) return true;
  return false;
}

function collectJourneyRecords(data) {
  data = data || {};
  const out = [];
  const completed = data.completedJourneys || [];
  for (let i = 0; i < completed.length; i++) {
    const row = completed[i];
    const attempt = Math.max(1, Math.floor(Number(row.attempt) || 1));
    const score = row.score || {};
    const success = Math.floor(Number(score.success) || 0);
    const failures = Math.floor(Number(score.failures) || 0);
    out.push({
      id: completedJourneyRecordId(attempt),
      success,
      failures,
      attempt,
      endedAt: row.date || '',
    });
  }
  if (!isAwaitingNextJourney(data) && hasActiveJourneySeriesForBest(data)) {
    const attempt = Math.max(1, Math.floor(Number(data.attempt) || 1));
    const alreadyArchived = out.some((row) => row.attempt === attempt);
    if (!alreadyArchived) {
      const score = data.currentScore || {};
      out.push({
        id: liveJourneyRecordId(attempt),
        success: Math.floor(Number(score.success) || 0),
        failures: Math.floor(Number(score.failures) || 0),
        attempt,
        endedAt: '',
      });
    }
  }
  return out;
}

function getActiveJourneyRecordId(data) {
  data = data || {};
  if (isAwaitingNextJourney(data)) return null;
  if (!hasActiveJourneySeriesForBest(data)) return null;
  const attempt = Math.max(1, Math.floor(Number(data.attempt) || 1));
  return liveJourneyRecordId(attempt);
}

function compareJourneyRecords(a, b) {
  if (b.success !== a.success) return b.success - a.success;
  if (a.failures !== b.failures) return a.failures - b.failures;
  if (b.attempt !== a.attempt) return b.attempt - a.attempt;
  return String(a.id).localeCompare(String(b.id));
}

function sortStreakRecords(records) {
  return records.slice().sort(compareStreakRecords);
}

function sortJourneyRecords(records) {
  return records.slice().sort(compareJourneyRecords);
}

function buildBestPerformanceSlots(records, activeId, kind) {
  const sorted = kind === 'journey' ? sortJourneyRecords(records) : sortStreakRecords(records);
  const top = sorted.slice(0, BEST_PERFORMANCES_RANK_COUNT);
  let maxVal = 0;
  for (let i = 0; i < top.length; i++) {
    const v = kind === 'journey' ? top[i].success : top[i].days;
    if (v > maxVal) maxVal = v;
  }

  const slots = [];
  for (let rank = 1; rank <= BEST_PERFORMANCES_RANK_COUNT; rank++) {
    const medal = BEST_PERFORMANCES_MEDALS[rank - 1];
    const rec = top[rank - 1];
    if (!rec) {
      slots.push({
        rank,
        medal,
        empty: true,
        value: 0,
        barPercent: 0,
        isActive: false,
        ariaLabel: 'Rank ' + rank + ', no ' + (kind === 'journey' ? 'journey' : 'streak') + ' yet',
        id: '',
      });
      continue;
    }
    const value = kind === 'journey' ? rec.success : rec.days;
    let barPercent = maxVal > 0 ? Math.round((value / maxVal) * 100) : 0;
    if (barPercent < 4 && value > 0) barPercent = 4;
    const isActive = !!(activeId && rec.id === activeId);
    let label = kind === 'journey'
      ? ('Rank ' + rank + ', best journey, ' + value + ' days')
      : ('Rank ' + rank + ', best streak, ' + value + ' days');
    if (isActive) label += ', currently active';
    slots.push({
      rank,
      medal,
      empty: false,
      value,
      barPercent,
      isActive,
      ariaLabel: label,
      id: rec.id,
    });
  }
  return { slots };
}

function buildBestStreaksBoard(data) {
  const records = collectStreakRecords(data);
  const activeId = getActiveStreakRecordId(data);
  return buildBestPerformanceSlots(records, activeId, 'streak');
}

function buildBestJourneysBoard(data) {
  const records = collectJourneyRecords(data);
  const activeId = getActiveJourneyRecordId(data);
  return buildBestPerformanceSlots(records, activeId, 'journey');
}

function buildBestPerformancesViewModel(data) {
  return {
    streaks: buildBestStreaksBoard(data),
    journeys: buildBestJourneysBoard(data),
  };
}

function archiveCurrentJourneyStreaks(data) {
  if (!data) return;
  if (!data.pastJourneyStreaks) data.pastJourneyStreaks = [];
  data.pastJourneyStreaks.push({
    attempt: data.attempt,
    streaks: [...(data.currentJourneyStreaks || [])],
    date: new Date().toISOString(),
  });
  const histCap = typeof journeyHistoryCap === 'function' ? journeyHistoryCap() : 50;
  if (data.pastJourneyStreaks.length > histCap) {
    data.pastJourneyStreaks = data.pastJourneyStreaks.slice(-histCap);
  }
  data.currentJourneyStreaks = [];
}

function pushEndedStreakOnDrink(data) {
  if (!data) return;
  const ended = data.drinkDayFrozenStreak | 0;
  if (ended <= 0) return;
  if (!data.currentJourneyStreaks) data.currentJourneyStreaks = [];
  data.currentJourneyStreaks.push(ended);
}
