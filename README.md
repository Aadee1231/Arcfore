# Arcfore

**Your game. Understood.**

Arcfore is a premium AI golf companion: real course discovery, offline-first scorekeeping, solo + multiplayer rounds, Gemini-powered swing video analysis, and a coach that only talks about the data you've actually given it.

iOS-first · Expo SDK 58 · React Native · TypeScript strict · Supabase · Clerk · Hono API · Gemini

---

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Expo app (src/app)         │  HTTPS │  Hono API (server/)          │
│  ─ expo-router, five tabs   ├───────►│  ─ Clerk JWT verify          │
│  ─ TanStack Query + zustand │        │  ─ GCA proxy + 6h cache      │
│  ─ offline outbox (AsyncSt.)│        │  ─ Gemini swing + coach      │
│  ─ Clerk email/SSO          │        │  ─ rate limits, zod contract │
└───────────┬─────────────────┘        └───────────┬──────────────────┘
            │                                      │
            ▼                                      ▼
     ┌─────────────────────────────────────────────────────┐
     │  Supabase Postgres + Realtime + Storage (RLS)       │
     │  rounds · participants · hole_scores · profiles     │
     │  clubs · drills · sessions · videos · analyses      │
     └─────────────────────────────────────────────────────┘
```

- **Secrets never touch the app.** GCA and Gemini keys live only in `server/.env`.
- **Offline-first scoring.** Every score cell writes to local state + a persisted outbox; pending mutations flush when connectivity returns (idempotent upserts, LWW by client timestamp).
- **Honest data.** No fake yardages, no fabricated stats — published tee yardages are labeled as such; GPS distances appear only when the provider supplies real hole coordinates.

## Quick start

### 1. Clone + install

```bash
cd Arcfore
npm install            # (.npmrc sets legacy-peer-deps for Clerk v4)
npm --prefix server install
cp .env.example .env   # fill in what you have (see "Credentials" below)
```

### 2. Database (one-time)

In your Supabase project's SQL editor, run the migrations in order:

```
supabase/migrations/0001_initial_schema.sql
supabase/migrations/0002_seed_drills_storage.sql
```

Then in Supabase **Auth → Third-party auth** add Clerk as a provider with your Clerk JWT issuer (`https://<app>.clerk.accounts.dev`) — the app sends the Clerk session token and RLS uses `auth.jwt()->>'sub'`.

### 3. Run

```bash
# terminal 1 — backend API
npm run server          # http://localhost:8787

# terminal 2 — Expo dev server
EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8787 npx expo start --dev-client
```

On a physical iPhone install the dev build (`npx expo run:ios` or EAS development profile), then press `s` in the Expo terminal to switch to the dev client and scan the QR code.

**Minimum viable config to see the app:** set `EXPO_PUBLIC_DEMO_MODE=true` and `EXPO_PUBLIC_DEV_USER_ID=dev` in `.env`, and `ALLOW_DEV_AUTH=true` in `server/.env` — the app renders with the preview dataset, no accounts needed. Unset all four for real use.

## Credentials checklist

| Where | Variable | Provider → location |
|---|---|---|
| app `.env` | `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys → Publishable key |
| app `.env` | `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` | Supabase → Settings → API |
| app `.env` | `EXPO_PUBLIC_API_URL` | your LAN IP in dev; `https://api.aadeec.com` (or chosen subdomain) in prod |
| server `.env` | `CLERK_SECRET_KEY` + `CLERK_JWT_ISSUER` | Clerk → API Keys → Secret key; issuer = your Clerk frontend URL |
| server `.env` | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (secret) |
| server `.env` | `GCA_API_KEY` | https://golfcoursesapi.com → API key (free tier OK) |
| server `.env` | `GEMINI_API_KEY` | https://aistudio.google.com/apikey |

Apple sign-in additionally needs a Clerk "Apple" OAuth provider configured with an Apple Services ID; Google sign-in uses Clerk's Google provider (dev keys work out of the box).

## What's inside

| Area | Status |
|---|---|
| Email + Google/Apple sign-in (Clerk v4 future API) | Implemented — needs keys |
| Course search / nearby / manual course | Implemented via GCA w/ server cache |
| Round setup (9/18, front/back nine, tees, guests, stroke/scramble/match) | Implemented |
| Live scoring (big steppers, undo, putts/FIR/GIR/penalties, autosave) | Implemented |
| Classic scorecard + leaderboard + AI recap | Implemented |
| Multi-device realtime + share codes | Implemented — needs Supabase |
| Offline outbox + restart restore | Implemented |
| Swing video record/upload → Gemini analysis → phases/drill | Implemented — needs `GEMINI_API_KEY` |
| AI coach chat (scoped context) | Implemented — needs `GEMINI_API_KEY` |
| Club bag + distance-based recommendations | Implemented |
| Practice drills + history + "One Thing" | Implemented |
| Analytics: trends, par-3/4/5, FIR/GIR, unofficial index | Implemented |
| Ghost round vs your previous round | Implemented |
| Share cards (editorial scorecard image) | Implemented |

See `docs/STATUS.md` for the honest, feature-by-feature verification report.

## Tests & checks

```bash
npm test                # vitest — 47 tests (scoring, geo, outbox, analytics, schemas, e2e round flow)
npm run typecheck       # tsc --noEmit — app + server
npm run lint            # expo lint
```

## Layout

```
src/app/            expo-router screens (auth, onboarding, 5 tabs, round/*, coach/*, bag/*, course/*)
src/components/     ui kit + golf components (ScoreStepper, ScorecardGrid, Celebration, TrendChart)
src/lib/            api clients, hooks, scoring engine, analytics, geo, offline outbox/sync, realtime
src/store/          zustand active-round store (persisted)
server/             Hono API: /v1/courses/* (GCA proxy), /v1/ai/* (Gemini), auth, rate limit, cache
supabase/migrations Postgres schema + RLS + drill seed + storage policies
tests/              vitest suites
docs/               PLAN.md · DESIGN.md · STATUS.md
```

## Privacy & security notes

- Clerk JWTs verified server-side for every protected route; Supabase RLS scopes every table to the owner/participants.
- Swing videos upload to a private `swing-videos` bucket through a signed server path; analyses run on Google's Gemini API only (the configured provider) and can be deleted from Profile.
- AI endpoints are rate-limited per user/day and capped on video size/duration — the client never sees the model key.
- Legal starter text lives at `/legal` in-app (placeholder terms — replace before public release).
