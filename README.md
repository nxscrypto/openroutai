# Open Rout AI — Public Website

Production marketing site for **Open Rout AI** (openroutai.com). Built from the designer's pixel-accurate prototype.

## Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router) + React 18
- **Language:** TypeScript (strict)
- **Styling:** [Tailwind CSS 3.4](https://tailwindcss.com/) with a custom theme mapping the designer's tokens
- **Fonts:** Space Grotesk + JetBrains Mono (Google Fonts)
- **Runtime:** Node.js 20 LTS (Railway default)

## Project layout

```
.
├── app/                       # Next.js App Router pages
│   ├── page.tsx               # Landing page (/)
│   ├── dashboard/page.tsx     # Dashboard stub (/dashboard)
│   ├── layout.tsx             # Root layout (fonts + metadata)
│   ├── globals.css            # Tailwind base layer + utilities
│   └── favicon.svg            # Accent-sphere logo
├── components/
│   └── HeroCanvas.tsx         # Animated node-orbit background
├── design-reference/          # Designer's source (gitignored; kept on disk)
├── railway.toml               # Explicit Railway build/deploy config
├── Procfile                   # Backup start command for non-Railway hosts
├── tailwind.config.js         # Design tokens (colors, fonts, keyframes, shadows)
├── tsconfig.json
├── next.config.js
├── postcss.config.js
└── package.json
```

## Develop

```bash
npm install
npm run dev          # → http://localhost:3000
```

## Build + run

```bash
npm run build        # builds to .next/
npm run start        # serves on $PORT (Railway sets this automatically)
```

## Deploy (Railway)

This repo is connected to a Railway service (`openroutai`). Every push to `main` triggers:

1. **Build** — Railway detects `package.json` and runs `npm install` + `npm run build`
2. **Start** — Runs `npm run start` (configured explicitly via `railway.toml`)
3. **Domain** — openroutai.com is bound via Railway's custom-domain settings

### Why Railpack was failing before

When the repo had no source files (empty `main` branch), Railpack analyzed `./` and couldn't find a `package.json` or `start.sh` to know it was a Node app. **This repo is now correctly structured: `package.json` at root, explicit `railway.toml`, and `Procfile` as a backup.** Any future push will build successfully.

## Custom domain (openroutai.com)

Set in Railway → Service → Settings → Networking → Custom Domain. Add the CNAME/A records Railway shows at your DNS registrar (wherever openroutai.com is registered). Railway auto-provisions Let's Encrypt TLS.

## Design source

See `design-reference/` (gitignored, kept on disk for reference) — contains the designer's `Open Rout AI.dc.html` prototype and the README handoff. Per the designer's README: **do not port the `<x-dc>` runtime**; the production code rebuilds the same UI in Next.js + Tailwind.

## Production checklist before launch

- [ ] Replace stub `window.location.href = '/dashboard'` in `app/page.tsx` with real auth (Auth.js / Clerk / Supabase)
- [ ] Build out `/dashboard` (Usage, Routing, API Keys, Credits, Payment sections from the prototype)
- [ ] Wire Stripe (test mode first) for the Checkout modal
- [ ] Replace `hello@openrout.ai` footer with real inbox once email forwarding is set up
- [ ] Honor `prefers-reduced-motion` in the canvas (already implemented in `HeroCanvas.tsx`)
- [ ] Add ARIA roles + keyboard navigation to the Auth modal's segmented control and switches (prototype-only, prototype spec notes these are required)