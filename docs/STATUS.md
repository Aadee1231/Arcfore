# Arcfore — implementation status report

*Generated at end of the autonomous build session. Honest ledger — nothing here is claimed verified unless it says so.*

## Verified working (checked by tests / typecheck / lint in this session)

| Check | Result |
|---|---|
| `npm test` (vitest) | **47/47 tests pass** — scoring engine, front/back nine, to-par, multi-player totals, 9-hole rounds, missing-score handling, edits, match play, geo math, outbox merge/dedupe, LWW sync, club recommendation boundaries, analytics, handicap estimate, zod API contracts, and an integration-level round lifecycle (start → group scoring → offline queue → sync → complete → stats). |
| `npx tsc --noEmit` (app) | **0 errors** |
| `npx tsc --noEmit` (server) | **0 errors** |
| `npx expo lint` | **0 errors**, 50 warnings (unused imports — cosmetic) |

Tests caught and fixed two real bugs: an outbox `enqueue` self-comparison that collapsed every queued score edit into one mutation, and a conservative club recommendation that picked the *worst* covering club instead of the tightest.

## Implemented, code-complete, NOT verified on a device or against live services

These are written end-to-end against the real SDKs/APIs (types checked against installed packages, not training data) but could not be exercised without credentials or a physical device:

- **Clerk auth (v4.12 signal hooks)** — email code + password, Google/Apple SSO via `useSSO`, sign-up with email verification, dev bypass when unconfigured. Needs `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and Clerk dashboard OAuth config for Apple.
- **Supabase schema + RLS** — migrations `0001`/`0002` cover every table (profiles, clubs, rounds, participants, hole_scores, invitations, videos, analyses, conversations, drills, sessions, one_thing) with Clerk-JWT-based RLS (`auth.jwt()->>'sub'`). Not yet applied to a live project.
- **Multi-device realtime** — postgres-changes channel merges remote scores into local state via updatedAt LWW; share-code join flow (`/round/join`).
- **Course discovery** — GCA search/nearby/detail via the server proxy with 6h caching + rate-limit awareness; manual course builder for missing courses; recent-courses on device.
- **GPS distances** — provider-abstracted; green centers fetched from `GET /v1/courses/:id/green-centers`. **Free-tier GCA does not include that endpoint** → the app shows published tee yardages labeled as such, never fabricated hole GPS. Haversine math is unit-tested; upgrading the GCA key enables real center-of-green distances with accuracy readout.
- **Gemini swing analysis** — `POST /v1/ai/swing-analyses` (multipart, ≤120s/120MB, per-user daily cap) → Gemini 2.5 Flash with `responseSchema` + medium media resolution (higher frame sampling for swing speed). Structured result: phases, strengths, improvements, top priority + drill, confidence, limitations, recording tip for unusable video. Analysis UI: video playback, phase timeline, drill card, "ask the coach" handoff.
- **AI coach** — `/v1/ai/coach` builds a permission-scoped context (profile, bag, rounds, analyses, practice) and instructs the model to never claim unprovided data. Persistent conversations in Supabase.
- **Post-round recap** — `/v1/ai/recap` fed by real hole-level stats (best/worst 3 holes, putts, FIR/GIR).
- **Ghost Round** — detects a previous completed round on the same course; previous scores shown beside current ones with a live comparison; honest empty state when none exists.
- **Share cards** — editorial forest/ivory scorecard rendered via `react-native-view-shot`, shared through the native share sheet; text fallback when sharing is unavailable.
- **Offline scoring** — active round + outbox persisted via AsyncStorage; pending-count/sync indicator; complete-cell snapshots make retries idempotent.

## Awaiting credentials (precise list)

| Provider | Credential | Where it goes | Config location |
|---|---|---|---|
| Clerk | Publishable key | app `.env` `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
| Clerk | Secret key + JWT issuer | `server/.env` `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER` | Clerk dashboard → API Keys |
| Supabase | URL + anon key | app `.env` `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| Supabase | service-role key | `server/.env` `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| Supabase | enable Clerk as third-party auth | dashboard (Auth → Third-party) | one-time console step |
| Golf Courses API | `GCA_API_KEY` | `server/.env` | golfcoursesapi.com account |
| Google AI Studio | `GEMINI_API_KEY` | `server/.env` | aistudio.google.com/apikey |

## Deferred / reduced scope (explicit)

- **MediaPipe pose estimation** — evaluated; skipped to keep the analysis pipeline shipping. The structured Gemini output already phases the swing; pose overlays are a later upgrade behind the same `SwingAnalysis` schema.
- **Match play** — engine `matchPlayState` is implemented and selectable in setup; UI is a light leaderboard treatment (still fine to play; deeper match UI deferred).
- **Apple sign-in** — code path implemented via Clerk SSO; requires the user's Apple Services ID configuration in Clerk.
- **Push notifications** — not in scope for v1.
- **Streaming coach replies** — single-shot responses with typed contract; streaming deferred.

## Known issues / honest gaps

- 50 lint warnings for unused imports (cosmetic; clean-up pass is safe).
- No live-device testing was possible in this environment — install, sign-in, camera, GPS, and realtime are all implemented but unverified on hardware. This is the top next step.
- `server/` runs via `tsx` (dev). For production, add a build step (tsc/tsup) + a hosted runtime; `EXPO_PUBLIC_API_URL` should point at the deployed domain (`api.aadeec.com` or similar).
- Legal text in `/legal` is a starter placeholder, not a reviewed policy.

## Next steps for physical-device testing

1. Fill app `.env` (Clerk publishable key, Supabase URL/anon, `EXPO_PUBLIC_API_URL=http://<LAN-IP>:8787`).
2. Fill `server/.env` (Clerk secret + issuer, Supabase service key, GCA + Gemini keys). Run the two migrations; enable Clerk third-party auth in Supabase.
3. `npm run server` then `npx expo run:ios` (or EAS dev build) on the iPhone.
4. Walk the definition-of-done flow: sign in → find a real course → start a round with 3 guests → record scores → background/reopen the app → finish → scorecard + recap → upload a swing video → coach follow-up → add clubs → second round.
5. First real-world check: the 30 req/day GCA free tier — cached responses stretch it, but a day of heavy testing can exhaust it.
