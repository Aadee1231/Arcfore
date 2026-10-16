# Arcfore — Implementation Plan

**Your game. Understood.** A premium AI golf companion: real course discovery, solo/multiplayer scorekeeping, Gemini-powered swing analysis and coaching, practice plans, analytics.

## Architecture

```
┌─────────────────────────────┐      ┌──────────────────────────────┐
│  Expo RN app (iOS-first)     │      │  Backend API (Hono/Node)      │
│  expo-router · Clerk auth    │─HTTPS│  /v1/courses/* (GCA proxy+    │
│  zustand · TanStack Query    │─────▶│   cache, rate-limit)          │
│  AsyncStorage offline outbox │      │  /v1/ai/swing-analyses        │
│  Supabase JS (Clerk JWT →    │      │  /v1/ai/coach (context-aware) │
│  third-party auth, RLS)      │      │  /v1/ai/recap                 │
└──────────┬──────────────────┘      └───────┬───────────┬───────────┘
           │  realtime (hole_scores)         │           │
           ▼                                 ▼           ▼
      Supabase (Postgres, RLS,          Golf Courses    Gemini API
      Storage, Realtime)                API (free 30/   (video
                                        day, paid GPS)  understanding)
```

- **Auth**: Clerk (`@clerk/expo` v4) — email + Google + Apple SSO via `useSSO`. Supabase third-party auth consumes the Clerk session JWT (`auth.jwt()->>'sub'` = Clerk user id). No fake auth.
- **Secrets**: GCA key + Gemini key live only in `server/.env`. App calls our API with the Clerk session token; never the provider keys.
- **Course data**: `GolfCourseProvider` interface → `GcaProvider` (server-side proxy + Postgres `api_cache` + in-flight dedupe). Manual-course escape hatch when the API misses a course. Free tier has no green-center GPS → UI shows published tee yardages labeled "tee yardage"; GPS rangefinding is wired behind the provider interface and auto-enables when `green_centers_available` + paid plan.
- **AI**: Gemini (`@google/genai`) video understanding with structured-output schema, fps sampling for fast swings, explicit uncertainty/visibility fields. Coach chat injects only data the user actually has (profile, clubs, round aggregates, analyses).
- **Offline**: active round + every score edit lives in a zustand store persisted to AsyncStorage; mutation outbox drains FIFO via upsert on reconnect; last-write-wins per (round, participant, hole) cell using client timestamps.
- **Multiplayer**: one-device-many-players (guests) always works offline; multi-device rounds sync over Supabase Realtime on `hole_scores`/`round_participants`, joined via share code.

## Design system (see docs/DESIGN.md)

Ivory editorial base `#F7F4EC`, forest `#102E25`, brass `#C8A46B`; Fraunces for display, Plus Jakarta Sans for UI, tabular numerals for all scores/yardages. One-hand-outdoor-usable scoring.

## Prioritized checklist

A. Foundation — scaffold ✓, theme+components, Clerk auth, onboarding, Supabase client, schema+migrations+RLS
B. Core golf — course search/nearby/manual, course detail, round setup, live scoring, scorecard, summary, stats engine
C. Multiplayer + resilience — guests, join codes, realtime sync, offline outbox, conflict handling
D. AI — record/upload, Gemini analysis, phase timeline, drill, history; coach chat; post-round recap; One Thing
E. Finish — club bag + recommendations, practice tracking, ghost round, share cards, polish, tests, docs, STATUS report

## Milestone verification

- `npx tsc --noEmit`, `npx expo lint`, `npx vitest run` green after each milestone.
- Unit tests: scoring, analytics, geo, club rec, schema validation, outbox merge, authz helpers.
- Integration test: start → score 18 holes × 3 players → finish → stats (in-memory).
- Server tests: GCA cache/dedupe, Gemini payload validation, rate limiter.
