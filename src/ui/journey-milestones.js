/* ===== src/ui/journey-milestones.js ===== */
'use strict';

// Progressive journey milestone reveal — same model as King / laotzu101:
// revealed milestones render as full rows; unrevealed ones become locked placeholders.

function isJourneyMilestoneReviewMode(data) {
  return !!(
    data.journeyPendingReset
    || (data.currentScore?.failures | 0) >= JOURNEY_MAX_FAILURES
  );
}

function buildJourneyLockedPlaceholderHtml(unlockAt, showHint, hideDayHint, reviewMode) {
  let rowClass = 'milestone-row milestone-locked';
  let msg = 'Keep going to unlock';
  if (reviewMode) {
    msg = 'Unlock in your next journey';
  } else if (showHint && unlockAt > 0 && !hideDayHint) {
    msg = formatJourneyMilestoneUnlockHint(unlockAt);
  }
  return (
    `<div class="${rowClass}">` +
      '<div class="milestone-left">' +
        '<div class="milestone-icon">🔒</div>' +
        '<div class="milestone-text"><div class="milestone-name">' + msg + '</div></div>' +
      '</div>' +
    '</div>'
  );
}

function buildJourneyMilestoneRowHtml(data, m) {
  const current = data.currentScore.success | 0;
  const count = (data.journeyTrophies && data.journeyTrophies[m.days]) || 0;
  const fullLabel = m.label || (m.days + ' Days');
  const alwaysShowLabel = m.days === 100 || m.days === 200;
  const shortLabel = alwaysShowLabel ? fullLabel : fullLabel.split(' — ')[0];
  const reviewMode = isJourneyMilestoneReviewMode(data);
  const reached = current >= m.days;
  const previouslyAchieved = isJourneyMilestonePreviouslyAchieved(data, m.days);
  const premLocked = !reviewMode && !reached && !previouslyAchieved
    && isJourneyMilestonePremiumLocked(m.days);
  let rowClass = 'milestone-row';
  if (reached) {
    rowClass += reviewMode ? ' milestone-journey-ended' : ' milestone-active';
  }
  if (premLocked) rowClass += ' milestone-premium-locked';

  let nameClass = 'milestone-name';
  let statClass = 'milestone-status';
  if (reached) {
    nameClass += reviewMode ? ' journey-ended-achieved' : ' achieved';
    statClass += reviewMode ? ' journey-ended-achieved' : ' achieved';
  }

  let status;
  if (reviewMode) {
    if (reached) {
      status = journeyTrophyStatusDisplay(m.days, count, true);
    } else if (previouslyAchieved || count > 0) {
      status = journeyTrophyStatusDisplay(m.days, count, false);
    } else {
      status = '';
    }
  } else if (reached) {
    status = premLocked ? 'Premium' : journeyTrophyStatusDisplay(m.days, count, true);
  } else if (previouslyAchieved) {
    status = premLocked ? 'Premium' : journeyTrophyStatusDisplay(m.days, count, false);
  } else {
    status = premLocked ? 'Premium' : journeyTrophyStatusDisplay(m.days, count, false);
  }

  if (status && JOURNEY_TROPHY_COUNT_DAYS.has(m.days) && status.charAt(0) === '\u00d7') {
    statClass += ' milestone-trophy-count';
  }

  const nameText = reached ? fullLabel : shortLabel;
  const emoji = (m.c && m.c.emoji) || '•';
  const clickAttr = premLocked ? ' onclick="Tracker.openPremium()"' : '';
  const cursorStyle = premLocked ? ' style="cursor:pointer"' : '';
  const statusHtml = status
    ? `<div class="${statClass}">${status}</div>`
    : '';

  return (
    `<div class="${rowClass}" id="${m.el}"${clickAttr}${cursorStyle}>` +
      '<div class="milestone-left">' +
        `<div class="milestone-icon">${emoji}</div>` +
        `<div class="milestone-text"><div class="${nameClass}">${nameText}</div></div>` +
      '</div>' +
      statusHtml +
    '</div>'
  );
}

function buildJourneySectionHtml(data, section, unlockHintState) {
  const reviewMode = isJourneyMilestoneReviewMode(data);
  const milestones = expandJourneySectionMilestones(section);
  const sectionUnlockAt = getNextSectionUnlockAt(data, milestones);
  let lockedSlotsLeft = lockedMilestoneSlotsForSection(
    countUnrevealedJourneyMilestones(data, milestones),
  );

  let html = '';
  for (const m of milestones) {
    if (isJourneyMilestoneRevealed(data, m.unlockAt)) {
      html += buildJourneyMilestoneRowHtml(data, m);
    } else if (lockedSlotsLeft > 0) {
      const showCountHint = unlockHintState.showNextCountHint;
      const gate = m.unlockAt | 0;
      html += buildJourneyLockedPlaceholderHtml(
        gate > 0 ? gate : sectionUnlockAt,
        showCountHint,
        false,
        reviewMode,
      );
      if (showCountHint) unlockHintState.showNextCountHint = false;
      lockedSlotsLeft--;
    }
  }
  return html;
}

function renderJourneyMilestoneSections(data) {
  const reviewMode = isJourneyMilestoneReviewMode(data);
  const milestoneTab = el('journeyMilestoneList');
  if (milestoneTab) milestoneTab.classList.toggle('journey-ended', reviewMode);

  const unlockHintState = { showNextCountHint: true };

  JOURNEY_MILESTONE_SECTIONS.forEach(section => {
    const container = el(section.containerId);
    if (!container) return;

    const isInControl = section.containerId === 'journeySectionInControl';
    if (isInControl && !isTakingControlStageAchieved(data)) {
      container.innerHTML = '';
      const label = section.labelId ? el(section.labelId) : null;
      if (label) label.style.display = 'none';
      return;
    }

    const html = buildJourneySectionHtml(data, section, unlockHintState);
    if (container.innerHTML !== html) container.innerHTML = html;

    const label = section.labelId ? el(section.labelId) : null;
    const hasContent = html.length > 0;
    if (label) {
      label.style.display = hasContent ? '' : 'none';
      label.classList.toggle('stage-incontrol-unlocked', section.labelClass === 'stage-incontrol' && hasContent);
      if (section.labelClass === 'stage-safe') {
        label.classList.toggle('stage-premium-locked', !hasPremiumAccess() && !reviewMode);
      }
    }
  });

  const milestoneBtn = document.querySelectorAll('.seg-btn')[1];
  if (milestoneBtn) milestoneBtn.classList.toggle('seg-streak-broken', reviewMode);
}
