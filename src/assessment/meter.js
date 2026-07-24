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

// ═══════════════════════════════════════════════════════════════
// METER CONTROLLER
// ═══════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────
// METER CONTROLLER
// Draws the D3.js AUDIT-C arc meter and animates the needle.
// Zones: Sober, Low Risk, Hazardous, Harmful, Dependent
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
    { label:'Sober',     sub:'Best possible',       who:'No alcohol use',                         color:'#1a7a34', scoreMin:0,  scoreMax:1,  arcUnits:0.5  },
    { label:'Low Risk',  sub:'Your target',          who:'AUDIT-C: Low Risk drinking',             color:'#34c759', scoreMin:1,  scoreMax:4,  arcUnits:2.75 },
    { label:'Hazardous', sub:'Risk Rising',          who:'AUDIT-C: Hazardous — men ≥4, women ≥3', color:'#ff9500', scoreMin:4,  scoreMax:6,  arcUnits:2    },
    { label:'Harmful',   sub:'Body at risk',         who:'AUDIT-C: Harmful drinking',              color:'#ff3b30', scoreMin:6,  scoreMax:9,  arcUnits:2.75 },
    { label:'Dependent', sub:'Medical supervision',  who:'AUDIT-C: Possible dependence',           color:'#7b0000', scoreMin:9,  scoreMax:12, arcUnits:4    },
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
    this.initialized = true;

    const CX=150, CY=158, INNER=76, OUTER=135;
    const GAP=0.015, STEPS=20;
    const DEG = Math.PI / 12;

    const svg = d3.select('#meterSvg');
    const g   = svg.append('g').attr('transform', `translate(${CX},${CY})`);
    const arc = d3.arc().innerRadius(INNER).outerRadius(OUTER).cornerRadius(0);

    // Build cumulative arc positions based on arcUnits (visual width per zone)
    // Total arcUnits = 12, total arc = PI, so 1 arcUnit = PI/12 = DEG
    // Sober = leftmost (-PI/2 = rotate -90°), Dependent = rightmost (+PI/2 = rotate +90°)
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
    this.ZONES.forEach((z, i) => {
      const midDeg = z.arcMid * 180 / Math.PI;
      // Uniform anchor based on position — all labels point outward from arc center
      const anchor = midDeg < -15 ? 'end' : midDeg > 15 ? 'start' : 'middle';
      const lr  = OUTER + 16;
      const lx  = (lr * Math.sin(z.arcMid)).toFixed(1);
      const ly1 = (-lr * Math.cos(z.arcMid) - 9).toFixed(1);   // zone name
      const ly2 = (-lr * Math.cos(z.arcMid) + 1).toFixed(1);   // score range
      const ly3 = (-lr * Math.cos(z.arcMid) + 10).toFixed(1);  // sub-label

      // Zone name
      [{ fill:'none', stroke:'white', sw:'3' }, { fill:z.color, stroke:'none', sw:'0' }].forEach(st => {
        g.append('text')
          .attr('x', lx).attr('y', ly1)
          .attr('text-anchor', anchor).attr('dominant-baseline','middle')
          .attr('font-size','8px').attr('font-weight','700').attr('font-family','-apple-system,sans-serif')
          .attr('fill', st.fill).attr('stroke', st.stroke).attr('stroke-width', st.sw)
          .attr('stroke-linejoin','round').text(z.label);
      });
      // Score range
      [{ fill:'none', stroke:'white', sw:'3' }, { fill:z.color, stroke:'none', sw:'0', op:'0.7' }].forEach(st => {
        const t2 = g.append('text')
          .attr('x', lx).attr('y', ly2)
          .attr('text-anchor', anchor).attr('dominant-baseline','middle')
          .attr('font-size','7px').attr('font-family','-apple-system,sans-serif')
          .attr('fill', st.fill).attr('stroke', st.stroke).attr('stroke-width', st.sw)
          .attr('stroke-linejoin','round').text(RANGES[i]);
        if (st.op) t2.attr('opacity', st.op);
      });
      // Sub-label (e.g. "Your target", "Medical supervision")
      [{ fill:'none', stroke:'white', sw:'3' }, { fill:z.color, stroke:'none', sw:'0', op:'0.6' }].forEach(st => {
        const t3 = g.append('text')
          .attr('x', lx).attr('y', ly3)
          .attr('text-anchor', anchor).attr('dominant-baseline','middle')
          .attr('font-size','6.5px').attr('font-style','italic').attr('font-family','-apple-system,sans-serif')
          .attr('fill', st.fill).attr('stroke', st.stroke).attr('stroke-width', st.sw)
          .attr('stroke-linejoin','round').text(`(${z.sub})`);
        if (st.op) t3.attr('opacity', st.op);
      });
    });

    g.append('line').attr('id','mNeedle').attr('x1',0).attr('y1',0).attr('x2',0).attr('y2',-(INNER-8))
      .attr('stroke','#8e8e93').attr('stroke-width',2.5).attr('stroke-linecap','round');
    g.append('line').attr('id','mStub').attr('x1',0).attr('y1',0).attr('x2',0).attr('y2',13)
      .attr('stroke','rgba(150,150,160,0.3)').attr('stroke-width',2).attr('stroke-linecap','round');
    g.append('text').attr('id','mScore').attr('x',0).attr('y',-24)
      .attr('text-anchor','middle').attr('font-size','28px').attr('font-weight','800')
      .attr('font-family','-apple-system,sans-serif').attr('fill','#c7c7cc').text('—');
    g.append('text').attr('id','mScoreLabel').attr('x',0).attr('y',-8)
      .attr('text-anchor','middle').attr('font-size','9px').attr('font-family','-apple-system,sans-serif')
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
    const zoneName = this.ZONES[zoneIdx].label;
    const zoneColor = this.ZONES[zoneIdx].color;

    // Zone label line below SVG
    const zoneLine = el('meterZoneLine');
    if (zoneLine) zoneLine.style.display = 'block';
    const isLowRisk = zoneName === 'Low Risk' || zoneName === 'Sober';
    zoneLine.innerHTML = `
      <span style="font-size:13px;font-weight:700;color:${zoneColor};">${zoneName}</span>
      <span style="font-size:11px;color:rgba(60,60,67,0.35);margin:0 6px;">·</span>
      <span style="font-size:11px;color:rgba(60,60,67,0.45);">Score ${score} / 12</span>
      ${!isLowRisk ? `<div style="font-size:11px;color:#34c759;margin-top:3px;font-weight:600;">🎯 Target: Low Risk zone</div>` : ''}
      ${isLowRisk ? `<div style="font-size:11px;color:#34c759;margin-top:3px;">✓ You are in the Low Risk zone</div>` : ''}
    `;

    // button always says Take Test

    // Feedback — show zone-specific message below the arc
    const feedbackEl = el('meterFeedback');
    if (!feedbackEl) return;

    // Helper defined here (local scope) — called 4 times below
    function showFeedback(bg, border, color, html) {
      feedbackEl.style.display    = 'block';
      feedbackEl.style.background = bg;
      feedbackEl.style.borderLeft = `3px solid ${border}`;
      feedbackEl.style.color      = color;
      feedbackEl.innerHTML        = html;
    }

    // Which Q score is highest — tells user which behaviour to change
    const lever = getLever(q1, q2, q3);

    if (score >= AUDIT_DEPENDENT_SCORE) {
      showFeedback(
        'rgba(123,0,0,0.07)', '#7b0000', '#7b0000',
        `<strong>Dependent zone.</strong> Stopping or reducing suddenly can cause seizures — please see a doctor before making any changes. Medical supervision is required here.<br><br>
With medical support and daily tracking, you can move from <strong>Dependent → Low Risk</strong>.<br>
<span style="font-size:11px;opacity:0.75;display:block;margin-top:4px;">अचानक बंद करना या कम करना खतरनाक है — पहले डॉक्टर से मिलें।</span>`
      );
    } else if (score >= AUDIT_HARMFUL_SCORE) {
      const gap = score - 5;
      showFeedback(
        'rgba(255,59,48,0.07)', '#ff3b30', '#cc2200',
        `<strong>Harmful zone.</strong> Alcohol is actively damaging your body. ${lever} You are <strong>${gap} point${gap > 1 ? 's' : ''}</strong> from Hazardous — you can still enjoy alcohol in a lower zone. Doctor's support recommended.<br>Daily tracking gets you from <strong>Harmful → Low Risk</strong> — one journey at a time.<br>
<span style="font-size:11px;opacity:0.75;display:block;margin-top:4px;">शराब शरीर को नुकसान दे रही है। ${gap} अंक कम करें — Hazardous ज़ोन में आ जाएंगे। डॉक्टर की मदद लें।</span>`
      );
    } else if (score >= AUDIT_HAZARDOUS_SCORE) {
      const gap = score - 3;
      showFeedback(
        'rgba(255,149,0,0.07)', '#ff9500', '#cc6600',
        `<strong>Hazardous zone.</strong> Alcohol is affecting your body. ${lever} You are <strong>${gap} point${gap > 1 ? 's' : ''}</strong> from Low Risk — you can still enjoy alcohol there.<br>Track your days and score sober vs drinking — <strong>Hazardous → Low Risk</strong> is within reach.<br>
<span style="font-size:11px;opacity:0.75;display:block;margin-top:4px;">शराब का असर पड़ रहा है। ${gap} अंक कम करें — Low Risk में आ जाएंगे।</span>`
      );
    } else if (score >= AUDIT_LOW_RISK_SCORE) {
      showFeedback(
        'rgba(52,199,89,0.07)', '#34c759', '#248a3d',
        `<strong>Low Risk zone.</strong> Good — but Low Risk is not Risk Free. Any alcohol carries some risk. Less is always better.<br>You can go further — <strong>Low Risk → Sober</strong>. Every sober day counts.<br>
<span style="font-size:11px;opacity:0.75;display:block;margin-top:4px;">Low Risk का मतलब Risk Free नहीं है। जितना कम, उतना बेहतर।</span>`
      );
    } else {
      feedbackEl.style.display = 'none';
    }

    renderDidYouKnow(data);
  }
};
