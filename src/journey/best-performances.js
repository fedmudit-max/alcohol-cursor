/* ===== src/journey/best-performances.js ===== */
'use strict';

// Top-3 historical journeys (read-only). Streak segments remain in journey data for scoring.

const BEST_PERFORMANCES_RANK_COUNT = 3;
const BEST_PERFORMANCES_MEDALS = ['🥇', '🥈', '🥉'];

function isAwaitingNextJourney(data) {
  return !!(data && data.journeyPendingReset);
}

function completedJourneyRecordId(attempt) {
  return 'journey:' + attempt + ':completed';
}

function liveJourneyRecordId(attempt) {
  return 'journey:' + attempt + ':live';
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
  const completed = typeof completedJourneysForDisplay === 'function'
    ? completedJourneysForDisplay(data)
    : (data.completedJourneys || []);
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

function sortJourneyRecords(records) {
  return records.slice().sort(compareJourneyRecords);
}

function buildBestPerformanceSlots(records, activeId) {
  const top = sortJourneyRecords(records).slice(0, BEST_PERFORMANCES_RANK_COUNT);
  let maxVal = 0;
  for (let i = 0; i < top.length; i++) {
    const v = top[i].success;
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
        ariaLabel: 'Rank ' + rank + ', no journey yet',
        id: '',
      });
      continue;
    }
    const value = rec.success;
    let barPercent = maxVal > 0 ? Math.round((value / maxVal) * 100) : 0;
    if (barPercent < 4 && value > 0) barPercent = 4;
    const isActive = !!(activeId && rec.id === activeId);
    let label = 'Rank ' + rank + ', best journey, ' + value + ' days';
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

function buildBestJourneysBoard(data) {
  const records = collectJourneyRecords(data);
  const activeId = getActiveJourneyRecordId(data);
  return buildBestPerformanceSlots(records, activeId);
}

function archiveCurrentJourneyStreaks(data) {
  if (!data) return;
  if (!data.pastJourneyStreaks) data.pastJourneyStreaks = [];
  data.pastJourneyStreaks.push({
    attempt: data.attempt,
    streaks: [...(data.currentJourneyStreaks || [])],
    date: new Date().toISOString(),
  });
  data.currentJourneyStreaks = [];
}

function pushEndedStreakOnDrink(data) {
  if (!data) return;
  const ended = data.drinkDayFrozenStreak | 0;
  if (ended <= 0) return;
  if (!data.currentJourneyStreaks) data.currentJourneyStreaks = [];
  data.currentJourneyStreaks.push(ended);
}
