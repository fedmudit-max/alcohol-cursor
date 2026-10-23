# Google Play — internal testing

Use this checklist for the first **Internal testing** release of **10Drinks** (`com.tendrinks.app`).

## 1. Preconditions (repo)

```bash
npm test
npm run android:bundle
```

`android:bundle` runs tests, builds web assets, syncs Capacitor, then produces a **signed** AAB.

Current app config for store builds (see `src/config/app.config.js`):

- Premium paywall/subscribe UI is **hidden** (`showPremiumInApp` / `showPremiumSubscribe: false`) until Play Billing is wired.
- **Trial locks are enforced** (`enforceTrialEntitlement: true`) — Premium features lock after the 15-day free trial.
- **QA bars are not in `index.html` by default.** For local/device testing, add before `main.js`:
  - `src/dev/calendar-day-advance.js` + `src/dev/next-day-test.js` — **Next calendar day** (trial QA bar optional, not in default `index.html`)
  Release `dist/` excludes `src/dev/` (see `scripts/build-release.sh`).
- Medical disclaimer is in Settings under **How 10Drinks builds will-power**.

## 2. Upload keystore (one-time)

From the project root:

```bash
keytool -genkey -v \
  -keystore android/10drinks-upload.jks \
  # (Gradle reads it via android/keystore.properties → ../10drinks-upload.jks from app/)
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload
```

Then:

```bash
cp android/keystore.properties.example android/keystore.properties
```

Edit `android/keystore.properties` with your passwords and paths. **Never commit** `keystore.properties` or `*.jks`.

Back up `10drinks-upload.jks` and passwords in a password manager; you need the same key for every update.

## 3. Version for each upload

In `android/app/build.gradle`, bump before each Play upload:

- `versionCode` — integer, must increase every release (e.g. `1`, `2`, `3`).
- `versionName` — user-visible string (e.g. `1.0.0`, `1.0.1`).

## 4. Play Console — create app (if new)

1. [Google Play Console](https://play.google.com/console) → **Create app**.
2. **App name:** 10Drinks  
3. **Package name:** `com.tendrinks.app` (must match `applicationId`).  
4. Complete **App access**, **Ads** (typically “No ads”), **Content rating** (questionnaire), **Target audience**, **News app** (No), **COVID-19** (No), **Data safety** (on-device only; no account; optional notifications).

## 5. Store listing minimums

- **Short description** (80 chars) and **Full description**.
- **App icon** 512×512 (use `assets/icons/icon-512.png`).
- **Feature graphic** 1024×500.
- **Phone screenshots** — at least 2 (capture from device or emulator).
- **Privacy policy URL:** `https://10drinksprivacy.netlify.app/` (also in `src/config/app.config.js` as `PRIVACY_POLICY_URL`)

## 6. Upload internal build

1. **Testing** → **Internal testing** → **Create new release**.
2. Upload `android/app/build/outputs/bundle/release/app-release.aab`.
3. Add release notes → **Review release** → **Start rollout to Internal testing**.
4. **Testers** → create an email list → add testers → share the **opt-in link**.

Testers install from the Play Store link (not sideloaded APK), usually within minutes.

## 7. Device smoke test (internal)

- Onboarding → log sober / drank → calendar backfill → catch-up / yesterday prompt.
- Settings: disclaimer, privacy policy, export/import backup, reminder toggle (notifications + exact alarms if prompted).
- AUDIT meter: session-only; disclaimer copy (“For reference…”, standard drinks question).
- Delete all data → meter cleared; fresh defaults.

## 8. After internal

- Fix issues → bump `versionCode` → `npm run android:bundle` → new internal release.
- When ready: **Closed testing** or **Production** on the same signing key.
- Enable `showPremiumInApp` / `premiumBilling: 'store'` only after Play Billing is implemented.
