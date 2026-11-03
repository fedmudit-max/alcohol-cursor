# Dev-only QA scripts

`src/dev/` is excluded from release `dist/` (`scripts/build-release.sh` also removes dev `<script>` tags from shipped `index.html`).

## Optional: Next calendar day

**Files:** `calendar-day-advance.js` (logic) + `next-day-test.js` (one button) — **not loaded by default.** Add before `main.js` when testing:

```html
<script src="src/dev/calendar-day-advance.js"></script>
<script src="src/dev/next-day-test.js"></script>
```

Advances one in-app calendar day (`simulatedToday`, `calendarDay`). Does not change the install trial clock (`sj_trialStartedAt`).

## Optional: trial clock QA (full bar)

**File:** `trial-test-bar.js` — Next Day + Expire trial + Fresh trial. Same setup as above; do not load both bars unless you want two controls.
