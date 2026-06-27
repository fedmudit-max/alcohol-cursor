# Sober Journey

Static PWA for GitHub Pages: `https://fedmudit-max.github.io/alcohol-cursor/`

## Deploy

Push these files to GitHub (branch **main**, Pages source **/ root**):

- `index.html`, `manifest.json`, `sw.js`
- `icon-180.png`, `icon-192.png`, `icon-512.png`
- `.nojekyll` (must be committed — do not gitignore it)

## Install on phone

1. Open **https://fedmudit-max.github.io/alcohol-cursor/** in Chrome (Android) or Safari (iPhone).
2. **Android:** Menu → **Install app** (or **Add to Home screen**).
3. **iPhone:** Share → **Add to Home Screen**.

## Android 404 or old icon?

This usually means an **old install** or **old service worker** is still on the phone.

1. **Remove** the old home-screen shortcut (long-press → Uninstall / Remove).
2. Chrome → **Settings → Site settings → All sites** → find `fedmudit-max.github.io` → **Clear & reset**.
3. Open the URL again in Chrome (not the old shortcut).
4. Install again.

After pushing updates to GitHub, wait ~1 minute, then repeat step 2 if the icon or page still looks wrong.

## If you rename the GitHub repo

Update full URLs in `manifest.json` (`start_url`, `scope`, `id`, icon `src` paths) to match `/your-new-repo-name/`.

## Local preview

Use Live Server or `npx serve .` — open the folder URL. Service worker needs `http://`, not `file://`.

## Config (`index.html`)

```javascript
const CONFIG = {
  isProduction:   true,
  showTestUI:     false,
  showOnboarding: true,
  buildTag:       'personal-v1',
};
```
