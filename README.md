# Arcfore

**Your game. Understood.**

Arcfore is a premium AI golf companion: real course discovery, local-first scorekeeping, solo + same-device multiplayer rounds, OpenAI-powered swing frame analysis, and a coach that only talks about the data you've actually given it.

iOS-first · Expo SDK 58 · React Native · TypeScript strict · local-first (SQLite) · Hono API · OpenAI

---

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Expo app (src/app)         │  HTTPS │  Hono API (server/)          │
│  ─ expo-router, five tabs   ├───────►│  ─ device-id / optional      │
│  ─ TanStack Query + zustand │        │    Clerk JWT identity        │
│  ─ expo-sqlite (all data)   │        │  ─ GCA course proxy + cache  │
│  ─ expo-file-system (video) │        │  ─ OpenAI vision + coach     │
│  ─ expo-secure-store (ids)  │        │  ─ rate limits, zod contract │
└─────────────────────────────┘        └──────────────────────────────┘
```

**Local-first.** Everything — profile, bag, rounds, scores, swing analyses, practice, coach chats — lives in an on-device SQLite database (`src/lib/db/`). No account is required for any feature; the app works fully offline except course search and AI calls.

- **Secrets never touch the app.** `GCA_API_KEY` and `OPENAI_API_KEY` live only in `server/.env`.
- **Swing videos stay on the phone.** The app copies recordings into app storage, extracts ~12 timestamped JPEG frames, and uploads *only those frames* for vision analysis — never the video file.
- **Honest data.** No fake yardages, no fabricated stats — the AI is instructed never to invent clubhead speed / launch angle / ball speed, and every claim carries a confidence + timestamp.
- **Clerk is optional.** When a publishable key is configured, users can sign in for future cloud sync; nothing is gated on it.

## Quick start

### 1. Clone + install

```bash
cd Arcfore
npm install            # (.npmrc sets legacy-peer-deps for Clerk v4)
npm --prefix server install
cp .env.example .env            # app config (public values only)
cp server/.env.example server/.env   # backend secrets
```

### 2. Backend env

Fill `server/.env` (see `server/.env.example`):

- `GCA_API_KEY` — https://golfcoursesapi.com (free tier OK)
- `OPENAI_API_KEY` — https://platform.openai.com/api-keys
- `OPENAI_VISION_MODEL` / `OPENAI_COACH_MODEL` — defaults are fine
- `CLERK_SECRET_KEY` / `CLERK_JWT_ISSUER` — optional, only if sign-in is enabled
- `API_SHARED_SECRET` — optional abuse deterrent; must match `EXPO_PUBLIC_API_TOKEN` in app `.env` when set

### 3. Run

```bash
# terminal 1 — backend API
npm run server          # http://localhost:8787

# terminal 2 — Expo dev server
EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8787 npx expo start --dev-client
```

On a physical iPhone install the dev build (`npx expo run:ios` or an EAS development profile) — **localhost will not work**, use your Mac's LAN IP or the deployed API domain.

**No database setup is needed** — SQLite migrations run automatically on first launch. No account is needed either: onboarding creates a local profile on-device.

## Credentials checklist

| Where | Variable | Provider → location |
|---|---|---|
| app `.env` | `EXPO_PUBLIC_API_URL` | your LAN IP in dev; `https://api.arcfore.aadeec.com` in prod |
| app `.env` | `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | *(optional)* Clerk → API Keys → Publishable key |
| app `.env` | `EXPO_PUBLIC_API_TOKEN` | *(optional)* must match `API_SHARED_SECRET` on server |
| server `.env` | `GCA_API_KEY` | https://golfcoursesapi.com → API key |
| server `.env` | `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| server `.env` | `CLERK_SECRET_KEY` + `CLERK_JWT_ISSUER` | *(optional)* Clerk → API Keys |

## What's inside

| Area | Status |
|---|---|
| Local profile onboarding (no account) | Implemented |
| Course search / nearby / manual course | Implemented via GCA + on-device cache |
| Round setup (9/18, front/back nine, tees, guests, stroke/scramble/match) | Implemented |
| Same-device multiplayer (named guests, match play, head-to-head) | Implemented |
| Live scoring (big steppers, undo, putts/FIR/GIR/penalties, autosave) | Implemented — writes straight to SQLite |
| Resume after force-close / restart | Implemented |
| Classic scorecard + leaderboard + AI recap | Implemented — recap needs `OPENAI_API_KEY` |
| Swing record/upload → frame extraction → OpenAI vision analysis | Implemented — needs `OPENAI_API_KEY` |
| Local swing-analysis history + on-device video playback | Implemented |
| AI coach chat (local context, persisted conversations) | Implemented — needs `OPENAI_API_KEY` |
| Club bag + distance-based recommendations | Implemented |
| Practice drills + history + "One Thing" | Implemented |
| Analytics: trends, par-3/4/5, FIR/GIR, unofficial index | Implemented — computed locally |
| JSON export of all data (Profile → Export) | Implemented |
| Multi-device realtime rounds | Deferred — removed from the UI |

See `docs/STATUS.md` for the honest, feature-by-feature verification report.

## Tests & checks

```bash
npm test                # vitest — scoring, geo, outbox, analytics, schemas, db mappers, e2e round flow
npm run typecheck       # tsc --noEmit — app
npm --prefix server run typecheck
npm run lint            # expo lint
```

## Layout

```
src/app/            expo-router screens (onboarding, 5 tabs, round/*, coach/*, bag/*, course/*)
src/components/     ui kit + golf components (ScoreStepper, ScorecardGrid, Celebration, TrendChart)
src/lib/db/         SQLite schema+migrations, row mappers, repository layer
src/lib/            api clients, hooks, scoring engine, analytics, geo, swing pipeline, coach context
src/store/          zustand active-round store (write-through to SQLite)
server/             Hono API: /v1/courses/* (GCA proxy), /v1/ai/* (OpenAI), device-id auth, rate limit
tests/              vitest suites
docs/               PLAN.md · DESIGN.md · STATUS.md
```

## Privacy & security notes

- All golf data lives on-device in SQLite; the API is stateless and stores nothing per-user.
- Swing videos never leave the phone — only sampled frames go to OpenAI for analysis.
- The server identifies clients by a per-install `x-device-id` (SecureStore) for rate limiting; signed-in users are identified by their verified Clerk JWT instead.
- AI endpoints are rate-limited per client/day, capped on frame count/size — the client never sees the model key.
- Legal starter text lives at `/legal` in-app (placeholder terms — replace before public release).
