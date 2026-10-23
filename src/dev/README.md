# Dev-only QA scripts

`src/dev/` is excluded from release `dist/` (`scripts/build-release.sh` also removes dev `<script>` tags from shipped `index.html`).

## Next calendar day (default in repo `index.html`)

**Files:** `calendar-day-advance.js` (logic) + `next-day-test.js` (one button)

Advances one in-app calendar day (`simulatedToday`, `calendarDay`). The 15-day free trial counts **app calendar days** while this bar is loaded (same as real days in production without the bar).

```html
<script src="src/dev/calendar-day-advance.js"></script>
<script src="src/dev/next-day-test.js"></script>
```

## Optional: trial clock QA

**File:** `trial-test-bar.js` — not loaded by default. Add manually if you need +1 trial day / expire trial / fresh trial.
