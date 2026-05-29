# Deploying FocusTrack

FocusTrack is now a **pure static site** — no server, no database. All your data
lives in your browser (IndexedDB) on the device you use it on. That means you can
host it for free on any static host.

## Build it

```bash
npm install      # first time only
npm run build    # outputs the static site to dist/public/
```

Everything you need to host is in **`dist/public/`** (HTML, JS, CSS, PWA manifest,
icons, and the offline service worker). You can also preview the production build
locally with `npm run preview`.

## Option A — Vercel (free)

1. Push this folder to a GitHub repo.
2. On vercel.com → "Add New Project" → import the repo.
3. Vercel reads `vercel.json` automatically:
   - Build command: `npm run build`
   - Output directory: `dist/public`
4. Deploy. You get a `*.vercel.app` URL (add a custom domain in Project Settings).

Or from the CLI: `npm i -g vercel && vercel` (then `vercel --prod`).

## Option B — Netlify (free)

1. Push this folder to a GitHub repo.
2. On netlify.com → "Add new site" → import the repo.
3. Netlify reads `netlify.toml` automatically (build `npm run build`, publish
   `dist/public`).

Or drag-and-drop: run `npm run build`, then drag the **`dist/public`** folder onto
the Netlify "Deploys" page — instant deploy, no Git needed.

## Option C — Cloudflare Pages (free)

1. Push to GitHub, then on Cloudflare Pages → "Create a project" → connect the repo.
2. Set:
   - Build command: `npm run build`
   - Build output directory: `dist/public`
3. Deploy.

## Option D — GitHub Pages / any static file host / S3+CloudFront

Run `npm run build` and upload the contents of `dist/public/` to your host. The app
uses hash-based routing (`/#/history`), so it works even without SPA rewrite rules —
no special server config required. If you serve it from a sub-path, that's fine too
because assets are referenced relatively.

## Backup & restore your data

Because data is per-device, use **Settings → Backup & restore** in the app:

- **Export** downloads a `focustrack-backup-YYYY-MM-DD.json` file.
- **Import** loads that file on another device/browser (this replaces existing data
  on that device).

## Going native later (optional)

The codebase is Capacitor-ready. To wrap it as a real iOS/Android app:

```bash
npm i -D @capacitor/cli @capacitor/core
npx cap init FocusTrack app.focustrack --web-dir=dist/public
npm i @capacitor/ios @capacitor/android
npx cap add ios && npx cap add android
npm run build && npx cap sync
npx cap open ios   # or android
```

The IndexedDB storage and entire UI carry over unchanged.
