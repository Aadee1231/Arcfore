# Arcfore — Status

*Last updated: local-first + OpenAI architecture migration.*

## Working now (verified in code/tests)

- **Local-first persistence** — `src/lib/db/` is the source of truth: schema + `PRAGMA user_version` migrations (`schema.ts`), write queue (`database.ts`), typed repositories (`repo.ts`). `initDb()` is idempotent, retries once on failure, seeds the drill catalog, and imports the legacy AsyncStorage active round + outbox on first launch.
- **No-account flow** — app boots to local profile onboarding when no profile exists; every feature works without sign-in. Clerk remains optional (`isClerkConfigured()` gates only the provider mount + the sign-in screen).
- **Rounds** — setup (9/18, tees, guests, stroke/scramble/match), live scoring, undo, guest players, match play, and same-device head-to-head all write-through to SQLite. `getActiveRound()` restores the in-progress round after force-close; `setStatus('completed')` persists the scorecard.
- **Local multiplayer** — named guests are stored as `round_participants` with `is_guest=1`; scoring engine handles match/stroke for all participants. Cloud invite/share-code UI removed (deferred).
- **Swing analysis** — `src/lib/swing/pipeline.ts` copies the video into app storage, reads real duration via `expo-video`, extracts ~12 timestamped frames via `expo-video-thumbnails`, uploads **frames only** (`POST /v1/ai/swing-analyses` multipart), and persists video + structured result locally. Analysis screen plays the local file.
- **AI coach** — stateless server call; the app builds context from the local DB (`src/lib/coach/context.ts`), sends recent history, and persists conversations + messages in SQLite. `?conversation=<id>` resumes a saved chat.
- **Post-round recap** — deterministic stats computed locally; OpenAI writes the narrative only (`/v1/ai/recap`, structured JSON).
- **Course data** — GCA proxy unchanged; course details are cached in `course_cache` and served offline on refetch failure.
- **Data safety** — Profile → "Export my data (JSON)" dumps all tables via `expo-sharing`; "Erase all data" wipes local rows (drills reseed). `x-device-id` (SecureStore) gives the server a stable rate-limit identity without accounts.

## Server (`server/`)

- OpenAI Responses API only — `src/openai.ts` (`gpt-5.2` vision default, `gpt-5.4-mini` coach default, both overridable via env).
- Frame-based analysis: base64 JPEG frames + timestamps → `input_image` parts → strict `json_schema` structured output → validated against `swingAnalysisResultSchema` before returning.
- Prompt forbids fabricated measurements (clubhead speed, launch angle, ball speed) and requires `unusable` + `recordingTip` when frames can't support analysis.
- Rate limits: daily AI budget per client id (Clerk sub or device id); `API_SHARED_SECRET` optional header check; frame count/byte caps.
- Fully stateless — no database. Supabase + Gemini dependencies removed.

## Tests / checks

- `npm test` — 55 tests pass (scoring, geo, outbox, analytics, schemas, **db mappers + migration invariants + frame planning**, e2e round flow).
- `npx tsc --noEmit` — clean. `npm --prefix server run typecheck` — clean. `npx expo lint` — clean.

## Needs a physical device to verify

- [ ] Onboarding → round → score → force-close → resume.
- [ ] Screen lock / background during scoring — state must survive (writes are immediate, expected OK).
- [ ] Camera record + library upload → frame extraction → analysis → replay video.
- [ ] GPS nearby search + course detail offline fallback.
- [ ] JSON export share sheet.

## Blockers / required before real use

- **Deployed HTTPS backend** — `EXPO_PUBLIC_API_URL` points at `https://api.arcfore.aadeec.com` (from `app.json` extra). The new OpenAI server must actually be deployed there (or the env var pointed at the real host) before AI + course search work on the course. Local dev needs a LAN IP instead.
- **Rotate the OpenAI + GCA keys** — both were pasted in chat; treat as compromised, rotate, and update `server/.env`.
- **Model availability** — `gpt-5.2`/`gpt-5.4-mini` must be enabled on the OpenAI account; override via `OPENAI_VISION_MODEL`/`OPENAI_COACH_MODEL` if needed.
- Optional Clerk sign-in is stubbed (`(auth)/sign-in` remains) but nothing requires it.

## Known gaps (deferred, deliberate)

- Multi-device realtime rounds — removed from UI, out-of-scope for MVP.
- Cloud backup/sync of the local DB — export JSON is the interim answer.
- `supabase/migrations/` remains in-repo as historical reference only; nothing reads it.
