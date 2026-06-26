# Sober Journey

Static PWA — one HTML file plus manifest, service worker, and icons. No build step, no backend.

## GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: **main** (or `master`) → **/ (root)**
3. Save. After a minute, open:

   `https://<your-username>.github.io/<repo-name>/`

4. On your phone: open that URL → **Add to Home Screen** (iOS) or **Install app** (Android).

## Files (all you need)

| File | Purpose |
|------|---------|
| `index.html` | App (HTML + CSS + JS) |
| `manifest.json` | PWA install metadata |
| `sw.js` | Offline cache |
| `icon-180.png` | iPhone home screen |
| `icon-192.png` | Android icon |
| `icon-512.png` | Install / splash |
| `.nojekyll` | Lets GitHub Pages serve static assets as-is |

## Local preview

Any static server works (service worker needs `http://`, not `file://`):

- VS Code **Live Server** extension, or  
- `npx serve .` if you have Node installed

## Settings in `index.html`

```javascript
const CONFIG = {
  isProduction:   true,
  showTestUI:     false,
  showOnboarding: true,
  buildTag:       'personal-v1',
};
```

- **Onboarding** — once per device (`sj_onboarded` in localStorage).
- **AUDIT test** — resets on each page reload.
- **Journey data** — saved in localStorage (`soberJourney_v1`).

To show dev test buttons again, set `showTestUI: true` and `isProduction: false`.
