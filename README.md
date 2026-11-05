# 10Drinks

Alcohol journey tracker — **PWA** at [https://10drinks.com/](https://10drinks.com/) and **Android** app (`com.tendrinks.app`).

Privacy policy: [https://10drinksprivacy.netlify.app/](https://10drinksprivacy.netlify.app/)

## Project structure

```text
src/
├── main.js                 — boot
├── config/app.config.js    — trial, billing mode, Play/RevenueCat ids
├── data/local-storage.js   — DataManager
├── journey/journey.js      — Tracker (TenDrinksTracker / legacy SoberTracker alias)
├── ui/renderAll.js
├── assessment/             — AUDIT-C meter + questions
├── premium/                — trial locks, RevenueCat entitlement (Android store)
├── capacitor/              — native + RevenueCat bundles (built to dist/)
├── onboarding/onboarding.js
├── constants/
└── utils/
css/base.css
index.html                  — app shell (HTML + script tags)
docs/                       — REVENUECAT, Play internal testing, pre-registration checklist
```

## Billing and trial (defaults)

| Mode | Config | Who sees it |
|------|--------|-------------|
| **Trial-only PWA / trial AAB** | `PREMIUM_BILLING_MODE = 'local-stub'`, paywall hidden | GitHub Pages / `npm run android:bundle` |
| **Store subscriptions** | `PREMIUM_BILLING_MODE = 'store'`, `goog_…` RC key, premium UI on | `npm run android:bundle:store` only |

- **15-day trial** — local clock (`enforceTrialEntitlement`); journey data stays on device.
- **Premium (Android)** — RevenueCat + Google Play; entitlement in memory, not forged via `localStorage`.
- **Dev unlock** — `local-stub` only when `showTestUI: true` (not shipped).

Details: [docs/REVENUECAT.md](docs/REVENUECAT.md), [docs/PRE_REGISTRATION_CHECKLIST.md](docs/PRE_REGISTRATION_CHECKLIST.md).

## Tests and release build

```bash
npm ci
npm test                    # journey, backup, RevenueCat entitlement, release-config
npm run build               # dist/ + native bridge bundles
```

**Android (signed AAB):**

| Command | Preflight | Upload artifact |
|---------|-----------|-----------------|
| `npm run android:bundle` | `--trial` | `app-release-vc*-trial.aab` |
| `npm run android:bundle:store` | `--store` | `app-release-vc*-store.aab` |

Both run tests, `cap:sync`, and `verify-android-assets` before Gradle. See [docs/PLAY_INTERNAL_TESTING.md](docs/PLAY_INTERNAL_TESTING.md).

**Storage sanity:** `node scripts/storage-sanity.mjs`

**Catch-up tests:** `node tests/catchup-check.js`

## Deploy PWA (10drinks.com)

Point your host at the contents of **`dist/`** after `npm run build` (or sync the same tree you use for Capacitor):

- `index.html`, `manifest.json`, `sw.js`, `css/`, `src/`, `assets/`, `d3.min.js`
- `.nojekyll` if using GitHub Pages as a mirror

`manifest.json` uses relative `start_url` / `scope`; **`id`** is `https://10drinks.com/` for install identity. Changing `id` creates a new PWA identity — users may need to reinstall after a domain migration.

**Legacy URL:** `https://fedmudit-max.github.io/alcohol-cursor/` — retire after DNS cutover; clear old site data on test devices if icons or cache look stale.

## Install PWA on phone

1. Open **https://10drinks.com/** in Chrome (Android) or Safari (iPhone).
2. **Android:** Menu → **Install app** / **Add to Home screen**.
3. **iPhone:** Share → **Add to Home Screen**.

If an old install misbehaves: remove the shortcut, clear site data for the old origin, reinstall from the live URL.

## Local preview

Live Server or `npx serve .` — service worker needs `http://`, not `file://`. For production-like assets use `npm run build` and serve `dist/`.

## Android (Capacitor)

**Prerequisites:** Node.js 20+, Android Studio (SDK 34+, JDK 17).

```bash
npm install
npm run android          # build, sync, open Android Studio
```

- **App ID:** `com.tendrinks.app`
- **Web assets:** `dist/` (regenerate before each native release)
- **Service worker** is for the PWA only; the WebView loads packaged assets.
- **Daily reminder:** Settings UI + Android `AlarmManager` / notifications (`TenDrinksReminder` plugin).

Configure `android/keystore.properties` for Play uploads (never commit `.jks` or passwords).

## Naming and compatibility

- **App:** `10Drinks` (`APP_DISPLAY_NAME`, `manifest.json`)
- **Unchanged for data compat:** `localStorage` key `soberJourney_v1`, HTML `SoberTracker` onclick alias, legacy `sober-journey-backup` import format

## Config snapshot (`src/config/app.config.js`)

```javascript
const PREMIUM_BILLING_MODE = 'local-stub'; // 'store' for Play + RevenueCat internal tests
const CONFIG = {
  isProduction: true,
  showTestUI: false,
  premiumBilling: PREMIUM_BILLING_MODE,
  showPremiumInApp: false,      // true with store billing
  showPremiumSubscribe: false,
  showPremiumInSettings: false,
  enforceTrialEntitlement: true,
};
```

---

## Product notes (journey model)

The app is for users who are addicted to alcohol. We don't want to log quantity, as we are suggesting it via drinking risk test.
A user will take a journey and will track his sober days and drinking days.
Journey = sober days + drinking days.

Drinking days has condition. Only 10 drinking days allowed. Like 10 wickets in cricket.
Against 10 drinking days , a user will have a sober day score. Let say x.

There are two journeys.
Current journey and Best Score.
Best Score is best of all the journeys previously taken.
For the first journey, there is no previous journey, so best score will be better than current journey.
Logic here, less drinking days if sober days score is same. else current journey = sober journey.

Second journey onwards , first journey will become the Best Score
and user will have the target to beat his best score.

There are 2 types of achievements.
Streak and Journey
Streak is continuous sober days
Journey is sober days until user consumes 10 drinking days.

**Science** is a tab (body recovery timeline on streak basis). **Streak** and **Journey** are separate tabs.

**Missed days (current behavior):** If a user forgets to log on the 2nd, 3rd and 4th and today is the 5th, the missed days remain **unlogged**. The user can tap each unlogged day on the **Calendar** and choose **Mark Sober** or **I Drank**. **Yesterday** may also be prompted separately when they return. **Unlogged days never automatically affect the journey score or streak** — only explicit log entries (today’s buttons, yesterday modal, or calendar backfill) update score and streak.

**Catch-up (`Tracker._catchUp`):** Advances the in-app calendar to today and may show the yesterday modal; it does **not** auto-fill `dailyLog` or auto-count sober/drinking days. See `src/journey/catchup.js` and `src/journey/journey-score.js`.

When drinking day 10 is used, the journey ends, scores freeze, new journey starts fresh with score 0 - 0 from next calendar day.
MUST: journeyTrophies -50,100,150,200 counts persist across journeys; celebratedTrophies resets each journey.
