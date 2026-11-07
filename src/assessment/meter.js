/* ===== src/assessment/meter.js ===== */
'use strict';

// COLOR HELPER
// ═══════════════════════════════════════════════════════════════
function lerpColor(hex1, hex2, t) {
  const parse = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const [r1,g1,b1] = parse(hex1);
  const [r2,g2,b2] = parse(hex2);
  return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
}

const METER_SVG_LAYOUT_VERSION = '10';

function meterTextBlockMetrics(centerY, lines, fontSize) {
  const lineHeight = fontSize * 1.12;
  const blockH = (lines.length - 1) * lineHeight + fontSize * 0.92;
  const top = centerY - blockH / 2;
  const bottom = centerY + blockH / 2;
  const firstBaseline = top + fontSize * 0.78;
  return { lineHeight, blockH, top, bottom, firstBaseline };
}

/** @param {d3.Selection} parent */
function appendMeterOutlinedText(parent, opts) {
  const {
    x, y, anchor, lines, fontSize, fontWeight, fontStyle, className,
    color, haloSw, opacity,
  } = opts;
  const { lineHeight, firstBaseline } = meterTextBlockMetrics(y, lines, fontSize);
  const styles = [
    { fill: 'none', stroke: 'white', sw: haloSw },
    { fill: color, stroke: 'none', sw: '0', op: opacity },
  ];
  styles.forEach(st => {
    const text = parent.append('text')
      .attr('class', className)
      .attr('x', x)
      .attr('y', firstBaseline)
      .attr('text-anchor', anchor)
      .attr('dominant-baseline', 'alphabetic')
      .attr('font-size', `${fontSize}px`)
      .attr('font-weight', fontWeight || '400')
      .attr('font-family', '-apple-system,sans-serif')
      .attr('fill', st.fill)
      .attr('stroke', st.stroke)
      .attr('stroke-width', st.sw)
      .attr('stroke-linejoin', 'round');
    if (fontStyle) text.attr('font-style', fontStyle);
    if (st.op != null) text.attr('opacity', st.op);
    lines.forEach((line, li) => {
      text.append('tspan')
        .attr('x', x)
        .attr('dy', li === 0 ? 0 : lineHeight)
        .text(line);
    });
  });
  return lineHeight * Math.max(0, lines.length - 1);
}

// ═══════════════════════════════════════════════════════════════
// METER CONTROLLER
// ═══════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────
// METER CONTROLLER
// Draws the D3.js AUDIT-C arc meter and animates the needle.
// Zones: No alcohol reported, Lower-risk range, Hazardous range, Harmful range, Seek support (9–12)
// Score from test → needle position → feedback message
// ─────────────────────────────────────────────
const MeterController = {
  initialized:   false,
  currentAngle:  0,
  targetAngle:   0,
  activeZoneIdx: -1,
  raf:           null,
  lastQ1: null, lastQ2: null, lastQ3: null, lastScore: null,

  ZONES: [
    { label:'No alcohol reported', labelLines:['No alcohol','reported'], sub:'', who:'No alcohol reported on screening', color:'#1a7a34', scoreMin:0,  scoreMax:1,  arcUnits:0.5  },
    { label:'Lower-risk range', labelLines:['Lower-risk','range'], sub:'', who:'AUDIT-C score 1–3', color:'#34c759', scoreMin:1,  scoreMax:4,  arcUnits:2.75 },
    { label:'Hazardous range', labelLines:['Hazardous','range'], sub:'', who:'AUDIT-C score 4–5', color:'#ff9500', scoreMin:4,  scoreMax:6,  arcUnits:2    },
    { label:'Harmful range', labelLines:['Harmful','range'], sub:'', who:'AUDIT-C score 6–8', color:'#ff3b30', scoreMin:6,  scoreMax:9,  arcUnits:2.75 },
    { label:'Seek support', labelLines:['Seek','support'], sub:'', who:'AUDIT-C: Seek support range', color:'#7b0000', scoreMin:9,  scoreMax:12, arcUnits:4    },
  ],

  GRADIENTS: [
    ['#55dd88','#1a7a34'],
    ['#88ee55','#1a7a34'],
    ['#ffdd88','#cc6600'],
    ['#ff8866','#cc1100'],
    ['#cc2200','#550000'],
  ],

  getZoneIdx(score) {
    for (let i = this.ZONES.length - 1; i >= 0; i--) {
      if (score >= this.ZONES[i].scoreMin) return i;
    }
    return 0;
  },

  syncHeaderTeaser(data) {
    const teaser = el('riskMeterTeaser');
    if (!teaser) return;
    teaser.textContent = '';
    teaser.style.color = '';
  },

  hasAuditSession(data) {
    if (!data) return false;
    return data.auditQ1 != null && data.auditQ2 != null && data.auditQ3 != null;
  },

  clearDisplay() {
    if (!this.initialized) this.init();
    if (!this.initialized || typeof d3 === 'undefined') return;

    this.lastQ1 = null;
    this.lastQ2 = null;
    this.lastQ3 = null;
    this.lastScore = null;
    this.activeZoneIdx = -1;
    this.currentAngle = -90;
    this.targetAngle = -90;
    cancelAnimationFrame(this.raf);
    this._applyNeedle(-90);
    d3.select('#mScore').text('—').attr('fill', '#c7c7cc');

    const zoneLine = el('meterZoneLine');
    if (zoneLine) {
      zoneLine.style.display = 'none';
      zoneLine.innerHTML = '';
    }
    const reduction = document.getElementById('reductionTargetCard');
    if (reduction) reduction.style.display = 'none';
  },

  syncFromData(data) {
    if (this.hasAuditSession(data)) this.updateFromJourney(data);
    else this.clearDisplay();
  },

  scoreToAngle(score) {
    // Score 12 = maximum = needle at far right end of arc (90°)
    if (score >= 12) return 90;
    // Score 0 = minimum = needle at far left end of arc (-90°)
    if (score <= 0) return -90;
    // Map score to visual angle by interpolating within the correct zone
    const s = score;
    // Find zone containing this score
    let zone = this.ZONES[0];
    for (let i = this.ZONES.length - 1; i >= 0; i--) {
      if (s >= this.ZONES[i].scoreMin) { zone = this.ZONES[i]; break; }
    }
    // Inset offset: needle stays 15% from each edge of its zone arc
    const INSET = 0.15;
    const scoreRange = zone.scoreMax - zone.scoreMin;
    const t = scoreRange > 0
      ? (s - zone.scoreMin) / scoreRange  // 0..1 within zone
      : 0.5;
    // Apply inset so t=0 → 0.15, t=1 → 0.85
    const tInset = INSET + t * (1 - 2 * INSET);
    // Map to visual arc angle (arcStart..arcEnd)
    const radians = zone.arcStart + tInset * (zone.arcEnd - zone.arcStart);
    return radians * 180 / Math.PI;
  },

  init() {
    if (this.initialized || typeof d3 === 'undefined') return;
    const svgNode = document.getElementById('meterSvg');
    if (!svgNode) return;
    if (svgNode.dataset.meterLayoutVersion !== METER_SVG_LAYOUT_VERSION) {
      while (svgNode.firstChild) svgNode.removeChild(svgNode.firstChild);
      svgNode.dataset.meterLayoutVersion = METER_SVG_LAYOUT_VERSION;
    } else if (svgNode.childNodes.length > 0) {
      this.initialized = true;
      return;
    }
    this.initialized = true;

    const CX=150, CY=158, INNER=76, OUTER=135;
    const GAP=0.015, STEPS=20;
    const DEG = Math.PI / 12;
    const VB_WIDTH = 400;
    const capCss = typeof getComputedStyle === 'function'
      ? getComputedStyle(document.documentElement).getPropertyValue('--meter-caption-size').trim()
      : '';
    const METER_CAPTION_SCREEN_PX = parseFloat(capCss) || 10; /* .meter-screening-disclaimer */
    let renderW = svgNode.getBoundingClientRect().width;
    if (!renderW || renderW < 80) renderW = 360;
    const labelFont = (METER_CAPTION_SCREEN_PX * VB_WIDTH) / renderW;
    const labelScale = labelFont / 7;

    const svg = d3.select('#meterSvg');
    const g   = svg.append('g').attr('transform', `translate(${CX},${CY})`);
    const arc = d3.arc().innerRadius(INNER).outerRadius(OUTER).cornerRadius(0);

    // Build cumulative arc positions based on arcUnits (visual width per zone)
    // Total arcUnits = 12, total arc = PI, so 1 arcUnit = PI/12 = DEG
    // No alcohol reported = leftmost (-PI/2 = rotate -90°), Seek support = rightmost (+PI/2 = rotate +90°)
    let cursor = -Math.PI/2; // left edge of semicircle
    this.ZONES.forEach(z => {
      z.arcStart = cursor;
      z.arcEnd   = cursor + z.arcUnits * DEG;
      z.arcMid   = (z.arcStart + z.arcEnd) / 2;
      cursor     = z.arcEnd;
    });

    this.ZONES.forEach((z, i) => {
      const s0 = z.arcStart + (i === this.ZONES.length-1 ? 0 : GAP/2);
      const s1 = z.arcEnd   - (i === 0 ? 0 : GAP/2);
      if (i === 0) {
        g.append('path').attr('d', arc({ startAngle:s0, endAngle:s1 })).attr('fill', z.color);
        return;
      }
      const [cA, cB] = this.GRADIENTS[i];
      const span = s1 - s0;
      for (let s = 0; s < STEPS; s++) {
        const start = s0 + s * (span/STEPS);
        const end   = s0 + (s+1) * (span/STEPS);
        const t     = s / (STEPS-1);
        const color = i <= 1 ? lerpColor(cA, cB, 1-t) : lerpColor(cA, cB, t);
        g.append('path').attr('d', arc({ startAngle:start, endAngle:end })).attr('fill', color);
      }
    });

    const RANGES = ['0','1-3','4-5','6-8','9-12'];
    const nameToRangeGap = labelFont * 0.4455;
    this.ZONES.forEach((z, i) => {
      const midDeg = z.arcMid * 180 / Math.PI;
      const anchor = midDeg < -20 ? 'end' : midDeg > 20 ? 'start' : 'middle';
      const lr  = OUTER + 10.395 * labelScale;
      const lx  = +(lr * Math.sin(z.arcMid)).toFixed(1);
      const baseY = -lr * Math.cos(z.arcMid);
      const nameLines = z.labelLines && z.labelLines.length ? z.labelLines : [z.label];
      const nameExtra = (nameLines.length - 1) * labelFont * 1.12 * 0.2079;
      const lyName = baseY - 5.94 * labelScale - nameExtra;
      const nameGeom = meterTextBlockMetrics(lyName, nameLines, labelFont);
      const rangeGeom = meterTextBlockMetrics(0, [RANGES[i]], labelFont);
      const lyRange = nameGeom.bottom + nameToRangeGap + rangeGeom.blockH / 2;
      const lySub = lyRange + nameGeom.lineHeight * 0.72 + rangeGeom.blockH / 2;
      const haloSw = Math.max(3, 3 * labelScale).toFixed(1);

      appendMeterOutlinedText(g, {
        x: lx, y: lyName, anchor, lines: nameLines, fontSize: labelFont,
        fontWeight: '700', className: 'meter-arc-label', color: z.color, haloSw,
      });

      if (!z.hideArcRange) {
        appendMeterOutlinedText(g, {
          x: lx, y: lyRange, anchor, lines: [RANGES[i]], fontSize: labelFont,
          fontWeight: '500', className: 'meter-arc-range', color: z.color, haloSw, opacity: 0.7,
        });
      }

      if (z.sub) {
        const subFont = labelFont * 0.92;
        appendMeterOutlinedText(g, {
          x: lx, y: lySub, anchor, lines: [`(${z.sub})`], fontSize: subFont,
          fontStyle: 'italic', className: 'meter-arc-sub', color: z.color, haloSw, opacity: 0.6,
        });
      }
    });

    g.append('line').attr('id','mNeedle').attr('x1',0).attr('y1',0).attr('x2',0).attr('y2',-(INNER-8))
      .attr('stroke','#8e8e93').attr('stroke-width',2.5).attr('stroke-linecap','round');
    g.append('line').attr('id','mStub').attr('x1',0).attr('y1',0).attr('x2',0).attr('y2',13)
      .attr('stroke','rgba(150,150,160,0.3)').attr('stroke-width',2).attr('stroke-linecap','round');
    g.append('text').attr('id','mScore').attr('x',0).attr('y',-24)
      .attr('text-anchor','middle').attr('font-size','28px').attr('font-weight','800')
      .attr('font-family','-apple-system,sans-serif').attr('fill','#c7c7cc').text('—');
    g.append('text').attr('id','mScoreLabel').attr('x',0).attr('y',-8)
      .attr('text-anchor','middle').attr('font-size', `${labelFont}px`).attr('font-family','-apple-system,sans-serif')
      .attr('fill','rgba(60,60,67,0.35)').text('score / 12');
    g.append('circle').attr('r',10).attr('fill','white').attr('stroke','#8e8e93').attr('stroke-width',2).attr('id','mHubRing');
    g.append('circle').attr('r',4).attr('fill','#8e8e93').attr('id','mHubDot');
  },

  _applyNeedle(angle) {
    // Guard against -1 initial state before first _moveTo call
    const color = (this.activeZoneIdx >= 0 && this.ZONES[this.activeZoneIdx])
      ? this.ZONES[this.activeZoneIdx].color : '#8e8e93';
    d3.select('#mNeedle').attr('transform',`rotate(${angle})`).attr('stroke', color);
    d3.select('#mStub').attr('transform',`rotate(${angle})`);
    d3.select('#mHubRing').attr('stroke', color);
    d3.select('#mHubDot').attr('fill', color);
  },

  _animate() {
    const diff = this.targetAngle - this.currentAngle;
    if (Math.abs(diff) < 0.3) {
      this.currentAngle = this.targetAngle;
      this._applyNeedle(this.currentAngle);
      return;
    }
    this.currentAngle += diff * 0.1;
    this._applyNeedle(this.currentAngle);
    this.raf = requestAnimationFrame(() => this._animate());
  },

  _moveTo(score) {
    this.activeZoneIdx = this.getZoneIdx(score);
    this.targetAngle   = this.scoreToAngle(score);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this._animate());
    const zone = this.ZONES[this.activeZoneIdx];
    d3.select('#mScore').text(score).attr('fill', zone.color);
  },

  updateFromJourney(data) {
    if (!this.initialized) this.init();
    if (data.auditQ2 === null || data.auditQ2 === undefined) return;
    if (data.auditQ3 === null || data.auditQ3 === undefined) return;
    if (data.auditQ1 === null || data.auditQ1 === undefined) return;

    // Score is purely from the test — user controls when to retake
    const q1 = data.auditQ1;
    const q2 = data.auditQ2;
    const q3 = data.auditQ3;
    const score = q1 + q2 + q3;

    this.lastQ1 = q1; this.lastQ2 = q2; this.lastQ3 = q3; this.lastScore = score;
    this._moveTo(score);

    // Show current zone + target clearly below the arc
    const zoneIdx  = this.getZoneIdx(score);
    const zone     = this.ZONES[zoneIdx];
    const zoneName = zone.label;
    const zoneColor = zone.color;

    // Zone label line below SVG
    const zoneLine = el('meterZoneLine');
    if (zoneLine) zoneLine.style.display = 'block';
    const scoreLine = zone.hideArcRange
      ? ''
      : `<span style="font-size:11px;color:rgba(60,60,67,0.35);margin:0 6px;">·</span>
      <span style="font-size:11px;color:rgba(60,60,67,0.45);">Score ${score} / 12</span>`;
    const zoneFeedback = zone.feedback
      ? `<div style="margin-top:8px;padding:10px 12px;background:rgba(60,60,67,0.04);border-radius:10px;max-width:320px;margin-left:auto;margin-right:auto;text-align:left;line-height:1.55;">
          <div style="font-size:11px;font-weight:600;color:${zoneColor};margin-bottom:4px;">${zone.who || zoneName}</div>
          <div style="font-size:11px;color:rgba(60,60,67,0.65);">${zone.feedback}</div>
        </div>`
      : '';
    zoneLine.innerHTML = `
      <span style="font-size:13px;font-weight:700;color:${zoneColor};">${zoneName}</span>
      ${scoreLine}
      ${zoneFeedback}
    `;

    this.syncHeaderTeaser(data);

    renderDidYouKnow(data);
  }
};
