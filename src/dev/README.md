# Dev-only QA scripts

`src/dev/` is excluded from release `dist/` (`scripts/build-release.sh` also removes dev `<script>` tags from shipped `index.html`).

## Optional: Next calendar day

**Files:** `calendar-day-advance.js` (logic) + `next-day-test.js` (one button) — **not loaded by default.** Add before `main.js` when testing:

```html
<script src="src/dev/calendar-day-advance.js"></script>
<script src="src/dev/next-day-test.js"></script>
```

Advances one in-app calendar day (`simulatedToday`, `calendarDay`). The 15-day trial counts **app calendar days** while this bar is loaded.

## Optional: trial clock QA

**File:** `trial-test-bar.js` — not loaded by default. Add manually if you need +1 trial day / expire trial / fresh trial.
