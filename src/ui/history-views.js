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

function renderJourneyEndCard(data) {
  const card = el('journeyEndCard');
  if (!card) return;

  // Only show when journey has ended
  if (!data.journeyPendingReset) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  const completed = data.completedJourneys || [];
  const latest    = completed[completed.length - 1];
  if (!latest) return;

  const thisSober  = latest.score.success;
  const attempt    = latest.attempt;
  const nextTarget = getNextJourneyTarget(data);
  const prevBest   = completed.length >= 2
    ? Math.max(...completed.slice(0, -1).map(j => j.score.success | 0))
    : 0;
  const isNewBest  = attempt > 1 && thisSober > prevBest;

  // Title
  el('journeyEndTitle').textContent = `Journey ${attempt} Complete`;

  // Scores
  el('journeyEndCurrent').textContent = thisSober;
  el('journeyEndBest').textContent    = nextTarget;

  // Verdict — mirrors journey-end popup
  const dayWord = (n) => n === 1 ? 'day' : 'days';
  let verdict = `Your journey score: ${thisSober} sober ${dayWord(thisSober)}. `;
  if (isNewBest) {
    verdict += `New personal best! Your next target is to beat ${nextTarget} sober ${dayWord(nextTarget)} in your next journey.`;
  } else {
    verdict += `Your next target is to beat ${nextTarget} sober ${dayWord(nextTarget)} in your next journey.`;
  }
  el('journeyEndVerdict').textContent = verdict;

  const career = careerTotals(data);
  el('journeyEndTotal').textContent      = career.finished;
  el('journeyEndTotalSober').textContent = career.sober;
  el('journeyEndTotalDrink').textContent = career.drinks;
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

// Calendar navigation state
let _calYear  = null;
let _calMonth = null;

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

    html += `<div class="${cls}" style="background:${bg};border:${border};color:${color};">${d}</div>`;
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

// JOURNEY HISTORY CHART
// ═══════════════════════════════════════════════════════════════
// Draws the journey history line chart.
// One dot per completed journey (+ live current). Arrow nav scrolls windows of 6.
function renderJourneyChart(data) {
  const completed = (data.completedJourneys || []).filter(j => j && j.score && typeof j.score.success === 'number');
  const card = el('journeyChartCard');
  if (card) card.style.display = 'block';

  const pts = completed.map(j => ({ val:j.score.success, label:`J${j.attempt}` }));
  const currentAlreadyCompleted = completed.some(j => j.attempt === data.attempt);
  if (!data.journeyPendingReset && !currentAlreadyCompleted) {
    pts.push({ val:data.currentScore.success, label:`J${data.attempt}`, live:true });
  }

  if (pts.length < 1) return;

  if (pts.length > _journeyChartPtsCount) _journeyChartOffset = 0;
  _journeyChartPtsCount = pts.length;

  const { visible: visiblePts, start, maxOffset, offset } = journeyChartVisibleSlice(pts);

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
  const yMaxR = Math.ceil(yMax * 1.25 / 5) * 5;
  const fracs = [0, 0.25, 0.5, 0.75, 1];

  el('journeyYAxis').setAttribute('height', H);
  el('journeyYAxis').innerHTML = `
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
  const coords = visiblePts.map((p,i) => ({
    ...p,
    x: padX + i * slotStep,
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

  el('journeyChartInner').innerHTML = `
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


