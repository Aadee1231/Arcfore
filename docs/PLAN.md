# Arcfore — Implementation Plan

> **Updated (local-first pivot):** Supabase and Gemini are out of the MVP. All app
> data lives in on-device SQLite (`src/lib/db/`), videos in `expo-file-system`,
> ids in `expo-secure-store`. The stateless Hono API proxies courses (GCA) and
> runs OpenAI (Responses API) for frame-based swing analysis, coach, and recaps.
> Clerk is optional; multi-device realtime rounds are deferred.

**Your game. Understood.** A premium AI golf companion: real course discovery, solo/multiplayer scorekeeping, OpenAI-powered swing analysis and coaching, practice plans, analytics.

## Architecture

```
┌─────────────────────────────┐      ┌──────────────────────────────┐
│  Expo RN app (iOS-first)     │      │  Backend API (Hono/Node)      │
│  expo-router · local-first   │─HTTPS│  /v1/courses/* (GCA proxy+    │
│  zustand · TanStack Query    │─────▶│   cache, rate-limit)          │
│  expo-sqlite (all data)      │      │  /v1/ai/swing-analyses        │
│  file-system (videos)        │      │   (frame upload → OpenAI      │
│  secure-store (device id)    │      │   vision, structured output)  │
│  Clerk optional              │      │  /v1/ai/coach · /v1/ai/recap  │
└─────────────────────────────┘      └───────┬───────────┬───────────┘
                                             ▼           ▼
                                     Golf Courses    OpenAI API
                                     API            (frames → vision)
```

- **Auth**: none required — a local profile row is the identity. Clerk (`@clerk/expo` v4) stays wired as an optional sign-in for future sync; the server verifies the JWT when present, else rate-limits by `x-device-id`.
- **Secrets**: GCA key + OpenAI key live only in `server/.env`. App calls our API with device id (+ optional Clerk token); never the provider keys.
- **Course data**: GCA proxy server-side (in-memory cache); successful detail fetches are cached in the app's `course_cache` table so previously-viewed courses work offline. Manual-course escape hatch when the API misses a course. Free tier has no green-center GPS → UI shows published tee yardages labeled "tee yardage".
- **AI**: OpenAI Responses API. The app extracts timestamped JPEG frames on-device and uploads only those; vision model returns strict `json_schema` output validated server-side. Coach chat sends a local-DB context block; conversations persist on-device.
- **Offline**: every score edit writes straight to SQLite via the round store's write-through persistence; resume-after-kill reads the `status='active'` round. Last-write-wins helpers remain for future sync.
- **Multiplayer**: one-device-many-players (named guests) fully works offline; multi-device rounds are deferred (no share codes in the UI).

## Design system (see docs/DESIGN.md)

Ivory editorial base `#F7F4EC`, forest `#102E25`, brass `#C8A46B`; Fraunces for display, Plus Jakarta Sans for UI, tabular numerals for all scores/yardages. One-hand-outdoor-usable scoring.

## Prioritized checklist

A. Foundation — scaffold ✓, theme+components, local profile onboarding, SQLite schema+migrations
B. Core golf — course search/nearby/manual, course detail, round setup, live scoring, scorecard, summary, stats engine
C. Multiplayer + resilience — same-device guests, offline persistence, restart recovery (realtime sync deferred)
D. AI — record/upload, frame extraction, OpenAI analysis, phase timeline, drill, history; coach chat; post-round recap; One Thing
E. Finish — club bag + recommendations, practice tracking, ghost round, share cards, polish, tests, docs, STATUS report

## Milestone verification

- `npx tsc --noEmit`, `npx expo lint`, `npx vitest run` green after each milestone.
- Unit tests: scoring, analytics, geo, club rec, schema validation, outbox merge, authz helpers.
- Integration test: start → score 18 holes × 3 players → finish → stats (in-memory).
- Server tests: GCA cache/dedupe, OpenAI payload validation, rate limiter.
