/* ===== src/ui/timeline.js ===== */
'use strict';

function renderBodyTimeline(data) {
  const signal = el('streakSignal');
  const full = el('bodyTimelineFull');
  const signalValue = el('streakSignalValue');
  const signalSub = el('streakSignalSub');
  const signalStreak = getDisplayStreak(data) | 0;

  if (!hasPremiumAccess()) {
    if (full) full.hidden = true;
    if (signal) signal.classList.add('show');
    if (signalValue) {
      signalValue.textContent = signalStreak === 1 ? '1 day' : `${signalStreak} days`;
    }
    if (signalSub) {
      if (isStreakBroken(data)) {
        signalSub.textContent = 'Streak resets tomorrow — unlock the full weekly timeline with Premium';
      } else if (signalStreak <= 0) {
        signalSub.textContent = 'Log sober to start — unlock the full weekly timeline with Premium';
      } else {
        signalSub.textContent = 'Keep going — unlock the full weekly timeline with Premium';
      }
    }
    return;
  }

  if (full) full.hidden = false;
  if (signal) signal.classList.remove('show');

  const phase = getBodyTimelinePhase(data);
  const broken = isStreakBroken(data);
  const titleEl = el('bodyTimelineTitle');
  const textEl  = el('bodyTimelineText');
  const dotsEl  = el('bodyTimelineDots');
  const labelsEl = el('bodyTimelineLabels');
  if (!titleEl || !textEl || !dotsEl) return;

  if (broken) {
    titleEl.textContent = '🍺 Drinking Day Logged';
    textEl.textContent  = 'Tomorrow is a new opportunity to build your streak again. Your Journey continues. Beat your best score.';
  } else {
    applyBodyTimelineContent(titleEl, textEl, getBodyTimelineDisplayDay(data, phase));
  }

  const green = '#34c759';
  const amber = '#ff9500';
  const dim   = 'rgba(60,60,67,0.15)';
  const { start, end, streak, anchorDay, travel, frozen, amber: isAmber, progress,
          drinkBridgeProgress, showWeekAnchor, weekAnchor, travelFromWeekAnchor } = phase;
  const showStart = start === 1;
  let html = '';
  let labelHtml = '';

  const liveBridge = (extraClass) =>
    `<div class="body-timeline-bridge-to-next body-timeline-bridge--live${extraClass ? ' ' + extraClass : ''}" style="flex:1;display:flex;height:2px;align-self:center;">
      <div class="body-timeline-bridge-fill" style="width:0%;background:${green};height:2px;flex-shrink:0;"></div>
      <div style="flex:1;background:${dim};height:2px;"></div></div>`;

  const solidBridge = (color) =>
    `<div class="body-timeline-bridge-to-next" style="flex:1;height:2px;background:${color};align-self:center;"></div>`;

  // Start column (week-one strip)
  if (showStart) {
    const atStart = anchorDay === 0;
    const startPast = (phase.postDrinkRestart ? false : streak >= 1) || anchorDay > 0;
    if (isAmber && frozen && atStart) {
      html += `<div class="body-timeline-start-col"><div class="body-timeline-dot-fixed body-timeline-dot-fixed--drink"></div></div>`;
      html += bodyTimelineDrinkBridgeHtml(drinkBridgeProgress, green, amber, dim);
    } else if (isAmber && frozen && anchorDay === 1) {
      html += `<div class="body-timeline-past-col"><div class="body-timeline-start-dot body-timeline-start-dot--past"></div></div>`;
      html += bodyTimelineDrinkBridgeHtml(drinkBridgeProgress, green, amber, dim);
    } else if (atStart && travel && !frozen) {
      html += `<div class="body-timeline-start-col">
        <div class="body-timeline-dot-fixed"></div>
        <div class="body-timeline-dot-active-wrap" data-active="1" data-start-active="1" data-progress="${progress}">
          <div class="body-timeline-dot-active"></div></div></div>`;
      html += liveBridge('body-timeline-bridge--start');
    } else if (startPast) {
      html += `<div class="body-timeline-past-col"><div class="body-timeline-start-dot body-timeline-start-dot--past"></div></div>`;
      html += solidBridge(green);
    } else {
      html += `<div class="body-timeline-past-col"><div class="body-timeline-start-dot body-timeline-start-dot--idle"></div></div>`;
      html += solidBridge(dim);
    }
    labelHtml += `<div style="flex:0 0 12px;min-width:12px;display:flex;justify-content:flex-start;">
      <span class="body-timeline-day-label" style="color:${(isAmber && frozen && atStart) ? amber : (startPast ? green : dim)};">Start</span></div>`;
    labelHtml += `<div style="flex:1;"></div>`;
  }

  // Prior-week anchor column (7→8, 14→15, …)
  if (showWeekAnchor) {
    const atAnchor = anchorDay === weekAnchor;
    const anchorDrink = isAmber && frozen && atAnchor;
    const anchorTravel = travelFromWeekAnchor;
    const anchorFrozen = frozen && atAnchor && !isAmber;

    if (anchorDrink) {
      html += `<div class="body-timeline-start-col"><div class="body-timeline-dot-fixed body-timeline-dot-fixed--drink"></div></div>`;
      html += solidBridge(dim);
    } else if (isAmber && frozen && anchorDay === weekAnchor + 1) {
      html += `<div class="body-timeline-start-col"><div class="body-timeline-start-dot body-timeline-start-dot--past"></div></div>`;
      html += bodyTimelineDrinkBridgeHtml(drinkBridgeProgress, green, amber, dim);
    } else if (anchorTravel) {
      html += `<div class="body-timeline-start-col">
        <div class="body-timeline-start-dot body-timeline-start-dot--past"></div>
        <div class="body-timeline-dot-active-wrap" data-active="1" data-week-anchor-active="1" data-progress="${progress}">
          <div class="body-timeline-dot-active"></div></div></div>`;
      html += liveBridge('body-timeline-bridge--week-anchor');
    } else if (anchorFrozen) {
      html += `<div class="body-timeline-start-col"><div class="body-timeline-dot-fixed"></div></div>`;
      html += solidBridge(green);
    } else {
      html += `<div class="body-timeline-start-col"><div class="body-timeline-start-dot body-timeline-start-dot--past"></div></div>`;
      html += solidBridge(green);
    }
    labelHtml += `<div style="flex:0 0 12px;min-width:12px;display:flex;justify-content:flex-start;">
      <span class="body-timeline-day-label" style="color:${anchorDrink ? amber : green};">Day ${weekAnchor}</span></div>`;
    labelHtml += `<div style="flex:1;"></div>`;
  }

  for (let i = start; i <= end; i++) {
    if (showWeekAnchor && i === weekAnchor) continue;

    const isAnchor = anchorDay > 0 && i === anchorDay;
    const isPast = (streak > 0 && i < anchorDay) || (anchorDay > 0 && i < anchorDay);
    const onColumn = isAnchor || isPast || (isAmber && frozen && i === anchorDay);

    let labelColor = dim;
    if (isAmber && frozen && i === anchorDay) labelColor = amber;
    else if (isPast || isAnchor) labelColor = green;

    if (isAmber && frozen && i === anchorDay) {
      html += `<div class="body-timeline-current-col"><div class="body-timeline-dot-fixed body-timeline-dot-fixed--drink"></div></div>`;
    } else if (isAnchor && frozen) {
      html += `<div class="body-timeline-current-col"><div class="body-timeline-dot-fixed"></div></div>`;
    } else if (isAnchor && travel) {
      html += `<div class="body-timeline-current-col">
        <div class="body-timeline-dot-fixed"></div>
        <div class="body-timeline-dot-active-wrap" data-active="1" data-progress="${progress}">
          <div class="body-timeline-dot-active"></div></div></div>`;
    } else if (isPast) {
      html += `<div class="body-timeline-past-col"><div class="body-timeline-dot-fixed body-timeline-dot-fixed--sm"></div></div>`;
    } else {
      html += `<div style="flex:0 0 8px;min-width:8px;display:flex;justify-content:center;align-items:center;">
        <div style="width:8px;height:8px;border-radius:50%;background:${dim};flex-shrink:0;"></div></div>`;
    }

    const colW = (isAnchor && (travel || frozen)) ? '14px' : (isPast ? '12px' : '8px');
    const colFlex = (isAnchor && (travel || frozen)) ? '0 0 14px' : (isPast ? '0 0 12px' : '0 0 8px');
    const labelJustify = (i === start && !showStart && !showWeekAnchor) ? 'flex-start' : (i === end ? 'flex-end' : 'center');
    labelHtml += `<div style="flex:${colFlex};min-width:${colW};display:flex;justify-content:${labelJustify};">
      <span class="body-timeline-day-label" style="color:${labelColor};">Day ${i}</span></div>`;

    if (i < end) {
      const bridgeLive = isAnchor && travel && !frozen;
      const bridgeToDrink = isAmber && frozen && i === anchorDay - 1;
      if (bridgeLive) {
        html += liveBridge('');
      } else if (bridgeToDrink) {
        html += bodyTimelineDrinkBridgeHtml(drinkBridgeProgress, green, amber, dim);
      } else {
        html += solidBridge(isPast ? green : dim);
      }
      labelHtml += `<div style="flex:1;"></div>`;
    }
  }

  dotsEl.innerHTML = html;
  if (labelsEl) labelsEl.innerHTML = labelHtml;
  if (!(phase.amber && phase.frozen)) {
    positionBodyTimelineActiveDot(dotsEl);
    scheduleBodyTimelineDotPosition(dotsEl);
  }
}

function scheduleBodyTimelineDotPosition(dotsEl, data) {
  requestAnimationFrame(() => {
    positionBodyTimelineActiveDot(dotsEl, data);
    requestAnimationFrame(() => positionBodyTimelineActiveDot(dotsEl, data));
  });
}

