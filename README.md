# Café Passport

A cozy, gamified coffee-shop tracker. Every visit becomes a stamp in your passport, focus sessions fill a coffee cup, and all data lives on-device — no accounts, no cloud, no API keys.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. On first launch, a banner offers to load demo data (6 shops + visits + quests).

## Build & install as PWA

```bash
npm run build
npm run preview   # then use browser "Install app" / "Add to Home Screen"
```

For proper PWA icons, generate PNGs from the SVG:
```bash
magick public/icon.svg -resize 192x192 public/icon-192.png
magick public/icon.svg -resize 512x512 public/icon-512.png
```

## Stack

| Concern       | Library                         |
|---------------|---------------------------------|
| Framework     | React 19 + Vite 8 + TypeScript  |
| Styling       | Tailwind CSS v4                 |
| Animations    | Framer Motion                   |
| Local storage | Dexie (IndexedDB)               |
| PWA           | vite-plugin-pwa + Workbox       |
| Map (Phase 7) | Leaflet + OpenStreetMap (free)  |
| Nearby cafés  | Overpass API (free, no key)     |

## Build phases

| # | Feature                          | Status   |
|---|-------------------------------- -|----------|
| 1 | Scaffold, data model, nav shell  | Done     |
| 2 | Passport grid + shop detail      | Done     |
| 3 | Log a run                        | Done     |
| 4 | Ratings + breakdown              | Done     |
| 5 | Quests                           | Done     |
| 6 | Pomodoro coffee-pour timer       | Done     |
| 7 | Nearby map                       | Done     |
| 8 | Stats dashboard                  | Done     |
| 9 | Polish + create url using vercel | Done     |
