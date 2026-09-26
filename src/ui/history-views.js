/* ===== src/ui/history-views.js ===== */
'use strict';

function careerTotals(data) {
  return {
    journey:  data.attempt | 0,
    finished: (data.completedJourneys || []).length,
    sober:    data.totalSuccessfulDays | 0,
    drinks:   data.totalFailures | 0,
  };
}

// Lifetime stats — current journey # + all-time sober/drink days (each log adds to totals).
function renderLifetimeStats(data) {
  const card = el('lifetimeStatsCard');
  if (!card) return;
  card.style.display = 'block';
  const career = careerTotals(data);
  el('ltJourneys').textContent = career.journey;
  el('ltSober').textContent    = career.sober;
  el('ltDrink').textContent    = career.drinks;
}

// Personal bests panel
let _bestPerformancesMode = 'streaks';

function renderBestPerformanceList(containerId, board, valueSuffix) {
  const root = el(containerId);
  if (!root || typeof buildBestPerformancesViewModel !== 'function') return;
  const slots = board.slots || [];
  let html = '';
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const rankClass = 'best-perf-row--rank-' + slot.rank;
    const activeClass = slot.isActive ? ' best-perf-row--active' : '';
    const emptyClass = slot.empty ? ' best-perf-row--empty' : '';
    html += '<div class="best-perf-row ' + rankClass + activeClass + emptyClass + '" role="listitem" aria-label="' + slot.ariaLabel + '">';
    html += '<span class="best-perf-medal" aria-hidden="true">' + slot.medal + '</span>';
    if (slot.empty) {
      html += '<span class="best-perf-empty">—</span>';
    } else {
      html += '<div class="best-perf-bar-track" style="width:' + slot.barPercent + '%" aria-hidden="true">';
      html += '<div class="best-perf-bar-fill"></div>';
      html += '</div>';
      html += '<span class="best-perf-value">' + slot.value + ' ' + valueSuffix + '</span>';
    }
    html += '</div>';
  }
  root.innerHTML = html;
}

function renderBestPerformances(data) {
  const card = el('bestPerformancesCard');
  if (!card || typeof buildBestPerformancesViewModel !== 'function') return;
  card.style.display = 'block';
  data = data || Tracker.data || DataManager.load();

  const mode = _bestPerformancesMode === 'journeys' ? 'journeys' : 'streaks';
  const streaksBtn = el('bestPerfToggleStreaks');
  const journeysBtn = el('bestPerfToggleJourneys');
  if (streaksBtn) {
    streaksBtn.classList.toggle('active', mode === 'streaks');
    streaksBtn.setAttribute('aria-selected', mode === 'streaks' ? 'true' : 'false');
  }
  if (journeysBtn) {
    journeysBtn.classList.toggle('active', mode === 'journeys');
    journeysBtn.setAttribute('aria-selected', mode === 'journeys' ? 'true' : 'false');
  }
  const streaksPane = el('bestStreaksPane');
  const journeysPane = el('bestJourneysPane');
  if (streaksPane) streaksPane.hidden = mode !== 'streaks';
  if (journeysPane) journeysPane.hidden = mode !== 'journeys';

  const model = buildBestPerformancesViewModel(data);
  renderBestPerformanceList('bestStreaksList', model.streaks, 'days');
  renderBestPerformanceList('bestJourneysList', model.journeys, 'days');
}

// Calendar navigation state
let _calYear  = null;
let _calMonth = null;

function canLogCalendarDay(data, dayKey, realToday) {
  if (!data || !dayKey || data.journeyPendingReset) return false;
  const todayKey = dateKey(realToday);
  if (dayKey > todayKey) return false;
  const startKey = data.journeyStartKey;
  if (startKey && dayKey < startKey) return false;
  if (data.scoredDays && data.scoredDays[dayKey]) return false;
  return true;
}

function renderMonthGrid(data, targetYear, targetMonth) {
  const log   = data.dailyLog || {};
  // Calendar always uses real today — test Next Day / 3-Day Gap must not move this forward
  const today = getRealToday();

  // Keep the month the user picked; only default to today on first render
  if (targetYear == null) {
    targetYear = _calYear != null ? _calYear : today.getFullYear();
  }
  if (targetMonth == null) {
    targetMonth = _calMonth != null ? _calMonth : today.getMonth();
  }

  // Never show or stay on a month after real today (e.g. after test day advance)
  if (targetYear > today.getFullYear() ||
      (targetYear === today.getFullYear() && targetMonth > today.getMonth())) {
    targetYear = today.getFullYear();
    targetMonth = today.getMonth();
  }

  // Store for navigation
  _calYear  = targetYear;
  _calMonth = targetMonth;

  const days  = new Date(targetYear, targetMonth + 1, 0).getDate();
  const first = new Date(targetYear, targetMonth, 1).getDay();

  // Find app start date
  const allKeys = Object.keys(log).sort();
  const startKey = allKeys.length > 0 ? allKeys[0] : dateKey(new Date(data.lastDayCheck));
  const startDate = new Date(startKey + 'T00:00:00');
  const startYear  = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const startDay   = startDate.getDate();

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const isCurrentMonth = (targetYear === today.getFullYear() && targetMonth === today.getMonth());
  const isStartMonth   = (targetYear === startYear && targetMonth === startMonth);

  // Month label
  const mlEl = el('monthGridMonthLabel');
  if (mlEl) mlEl.textContent = `${MONTHS[targetMonth]} ${targetYear}`;

  // Prev/next arrow visibility
  const prevBtn = el('calPrevBtn');
  const nextBtn = el('calNextBtn');
  // Can't go before app start month
  const atStart = (targetYear === startYear && targetMonth === startMonth);
  // Can't go past current month
  const atEnd   = isCurrentMonth;
  if (prevBtn) prevBtn.disabled = atStart;
  if (nextBtn) nextBtn.disabled = atEnd;

  // Count sober/drinking
  let soberN = 0, drinkN = 0;
  for (let d = 1; d <= days; d++) {
    const k = `${targetYear}-${String(targetMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (log[k]==='sober')    soberN++;
    if (log[k]==='drinking') drinkN++;
  }
  // Counts go into legend labels
  const soberLbl = el('calLegendSober');
  const drinkLbl = el('calLegendDrink');
  if (soberLbl) soberLbl.textContent = soberN > 0 ? `Sober ${soberN}` : 'Sober';
  if (drinkLbl) drinkLbl.textContent = drinkN > 0 ? `Drinking ${drinkN}` : 'Drinking';

  // Day labels
  el('monthDayLabels').innerHTML = ['S','M','T','W','T','F','S'].map(d =>
    `<div style="font-size:9px;font-weight:600;color:rgba(60,60,67,0.35);text-align:center;">${d}</div>`
  ).join('');

  // Grid
  let html = Array(first).fill('<div></div>').join('');
  for (let d = 1; d <= days; d++) {
    const k = `${targetYear}-${String(targetMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday     = isCurrentMonth && d === today.getDate();
    const isFuture    = isCurrentMonth && d > today.getDate();
    const beforeStart = isStartMonth && d < startDay;
    const status      = log[k];

    let bg='rgba(60,60,67,0.06)', border='1px solid rgba(60,60,67,0.10)', color='rgba(60,60,67,0.35)';
    let cls = 'cal-cell';
    if (status==='sober')    { bg='#34c759'; border='1px solid #248a3d'; color='white'; cls += ' cal-cell--sober'; }
    if (status==='drinking') { bg='rgba(255,149,0,0.18)'; border='1px solid rgba(255,149,0,0.45)'; color='#cc6600'; cls += ' cal-cell--drink'; }
    if (isFuture || beforeStart) { bg='rgba(60,60,67,0.03)'; border='1px solid rgba(60,60,67,0.06)'; color='rgba(60,60,67,0.18)'; }
    if (isToday && !isFuture && !beforeStart) {
      cls += ' cal-cell--today';
      if (!status) {
        bg = 'rgba(60,60,67,0.08)';
        color = 'rgba(60,60,67,0.55)';
      }
      border = '2px solid #34c759';
    }

    const tappable = !isFuture && !beforeStart && canLogCalendarDay(data, k, today);
    if (tappable) cls += ' cal-cell--tappable';
    const style = `background:${bg};border:${border};color:${color};`;
    if (tappable) {
      const label = `Log ${formatCalendarDayLabel(k)}`;
      html += `<button type="button" class="${cls}" style="${style}" onclick="SoberTracker.promptCalendarDay('${k}')" aria-label="${label}">${d}</button>`;
    } else {
      html += `<div class="${cls}" style="${style}">${d}</div>`;
    }
  }
  el('monthGrid').innerHTML = html;

  const empty = el('monthEmptyState');
  if (empty) empty.style.display = (soberN===0 && drinkN===0 && !isCurrentMonth) ? 'block' : 'none';

  // Show card from Day 2 onwards
  const card = el('monthGridCard');
  if (card) card.style.display = 'block';
}

// ═══════════════════════════════════════════════════════════════
// JOURNEY HISTORY CHART
// ═══════════════════════════════════════════════════════════════
const JOURNEY_CHART_WINDOW = 6;
let _journeyChartOffset = 0; // 0 = newest window; higher = older journeys
let _journeyChartPtsCount = 0;

function journeyChartVisibleSlice(pts) {
  const n = pts.length;
  if (n <= JOURNEY_CHART_WINDOW) {
    return { visible: pts, start: 0, maxOffset: 0, offset: 0 };
  }
  const maxOffset = n - JOURNEY_CHART_WINDOW;
  const offset = Math.min(Math.max(0, _journeyChartOffset), maxOffset);
  _journeyChartOffset = offset;
  const start = n - JOURNEY_CHART_WINDOW - offset;
  return { visible: pts.slice(start, start + JOURNEY_CHART_WINDOW), start, maxOffset, offset };
}

function journeyChartSlotIndex(pointIndex, pointCount, windowSize) {
  if (pointCount <= 1) return Math.floor((windowSize - 1) / 2);
  return pointIndex;
}

function clearJourneyChart(message) {
  const yAxis = el('journeyYAxis');
  const inner = el('journeyChartInner');
  const navRow = el('journeyChartNav');
  if (yAxis) yAxis.innerHTML = '';
  if (inner) {
    inner.innerHTML = message
      ? `<text x="200" y="70" text-anchor="middle" font-size="12" fill="rgba(134,134,139,0.8)" font-family="-apple-system,sans-serif">${message}</text>`
      : '';
  }
  if (navRow) navRow.style.display = 'none';
}

// JOURNEY HISTORY CHART
// ═══════════════════════════════════════════════════════════════
// Draws the journey history line chart.
// One dot per completed journey (+ live current). Arrow nav scrolls windows of 6.
function renderJourneyChart(data) {
  const yAxis = el('journeyYAxis');
  const inner = el('journeyChartInner');
  if (!yAxis || !inner) return;

  const completed = (data.completedJourneys || []).filter(j => j && j.score && typeof j.score.success === 'number');
  const card = el('journeyChartCard');
  if (card) card.style.display = 'block';

  const pts = completed.map(j => ({ val:j.score.success, label:`J${j.attempt}` }));
  const currentAlreadyCompleted = completed.some(j => j.attempt === data.attempt);
  if (!data.journeyPendingReset && !currentAlreadyCompleted) {
    const current = data.currentScore?.success | 0;
    pts.push({ val:current, label:`J${data.attempt}`, live:true });
  }

  if (pts.length < 1) {
    clearJourneyChart('Log your first journey to see history');
    return;
  }

  if (pts.length > _journeyChartPtsCount) _journeyChartOffset = 0;
  _journeyChartPtsCount = pts.length;

  const { visible: visiblePts, maxOffset, offset } = journeyChartVisibleSlice(pts);

  const navRow = el('journeyChartNav');
  const prevBtn = el('journeyChartPrevBtn');
  const nextBtn = el('journeyChartNextBtn');
  if (navRow) navRow.style.display = pts.length > JOURNEY_CHART_WINDOW ? 'flex' : 'none';
  if (prevBtn) prevBtn.disabled = offset >= maxOffset;
  if (nextBtn) nextBtn.disabled = offset <= 0;

  const H=140, padT=20, padB=28, VW=400, padX=20, cH=H-padT-padB;
  const chartW = VW - padX * 2;
  const slotStep = chartW / (JOURNEY_CHART_WINDOW - 1);
  const yMax  = Math.max(...pts.map(p=>p.val), 5);
  const yMaxR = Math.max(10, Math.ceil(yMax * 1.25 / 5) * 5);
  const fracs = [0, 0.25, 0.5, 0.75, 1];

  yAxis.setAttribute('height', H);
  yAxis.innerHTML = `
    <line x1="30" y1="${padT}" x2="30" y2="${padT + cH}" stroke="rgba(0,0,0,0.04)" stroke-width="1"/>
    ${fracs.map(f => {
      const y = padT + cH - f*cH;
      return `<text x="22" y="${y+4}" text-anchor="end" font-size="9" font-weight="500" fill="rgba(134,134,139,0.8)" font-family="-apple-system,sans-serif">${Math.round(f*yMaxR)}</text>`;
    }).join('')}`;

  const grid = fracs.map(f => {
    const y = padT + cH - f*cH;
    return `<line x1="${padX}" y1="${y}" x2="${VW-padX}" y2="${y}" stroke="rgba(0,0,0,0.04)" stroke-width="1"/>`;
  }).join('');

  const best   = Math.max(...pts.map(p=>p.val));
  const visibleCount = visiblePts.length;
  const coords = visiblePts.map((p,i) => ({
    ...p,
    x: padX + journeyChartSlotIndex(i, visibleCount, JOURNEY_CHART_WINDOW) * slotStep,
    y: padT + cH - (p.val/yMaxR)*cH,
  }));

  const poly = coords.length > 1
    ? `${coords.map(p=>`${p.x},${p.y}`).join(' ')} ${coords[coords.length-1].x},${padT+cH} ${coords[0].x},${padT+cH}` : '';
  const line = coords.map((p,i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ');

  const nodes = coords.map(p => {
    const isBest = !p.live && p.val === best && best > 0;
    const color  = p.live ? 'rgba(52,199,89,0.6)' : isBest ? '#ff9500' : '#34c759';
    const r      = isBest ? 6 : 5;
    return `<circle cx="${p.x}" cy="${p.y}" r="${r+5}" fill="${isBest?'rgba(255,149,0,0.1)':'rgba(52,199,89,0.08)'}"/>
            <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="white" stroke="${color}" stroke-width="2.5"/>
            <text x="${p.x}" y="${p.y-11}" text-anchor="middle" font-size="11" font-weight="700" fill="${color}" font-family="-apple-system,sans-serif">${p.val}</text>
            <text x="${p.x}" y="${padT+cH+16}" text-anchor="middle" font-size="10" fill="rgba(134,134,139,0.9)" font-family="-apple-system,sans-serif">${p.label}</text>`;
  }).join('');

  inner.innerHTML = `
    <defs>
      <linearGradient id="jGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#34c759" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#34c759" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${grid}
    ${coords.length>1?`<polygon points="${poly}" fill="url(#jGrad)"/>`:''}
    ${coords.length>1?`<path d="${line}" fill="none" stroke="#34c759" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`:''}
    ${nodes}`;
}


