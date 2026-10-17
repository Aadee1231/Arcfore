# Deploying `arcfore-api` to Vercel

The Hono app in `src/index.ts` exports `app` as the default export — Vercel's
zero-config backend support detects it automatically and serves it as a
Vercel Function (Fluid compute, Node.js runtime). The `@hono/node-server`
listener only starts outside Vercel/test, so `npm run dev` keeps working
locally unchanged.

## 1. Upstash Redis — required before AI works in production

AI endpoints are **blocked by design** (`503 protection_not_configured`) in
production until persistent rate limiting exists. Set it up first:

1. https://console.upstash.com → **Create Database** (free tier is fine).
2. Pick a region near your Vercel function region (`iad1` default → `us-east-1`).
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

This also gives the GCA course cache a shared L2 across instances, which
protects the 30-req/day free-tier quota.

## 2. Create the Vercel project

```bash
npm i -g vercel        # or: brew install vercel-cli
cd server
vercel link          # create new project, e.g. "arcfore-api"
```

Or in the dashboard: **Add New → Project → Import this repo** and set
**Root Directory = `server`**. Framework is auto-detected (Hono); leave
Build/Output settings at their defaults — no build command needed.

## 3. Environment variables (dashboard → Settings → Environment Variables)

Set for **Production** (and Preview if you want parity). Values mirror your
local `server/.env` — never commit it; it's gitignored and excluded from
deployments.

| Variable | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | yes | platform.openai.com |
| `OPENAI_VISION_MODEL` | yes | `gpt-5.2` (verified in /v1/models) |
| `OPENAI_COACH_MODEL` | yes | `gpt-5.4-mini` (verified in /v1/models) |
| `GCA_API_KEY` | yes | golfcoursesapi.com |
| `GCA_BASE_URL` | yes | `https://golfcoursesapi.com/api/v1` |
| `UPSTASH_REDIS_REST_URL` | **yes** | without it AI returns 503 |
| `UPSTASH_REDIS_REST_TOKEN` | **yes** | without it AI returns 503 |
| `API_SHARED_SECRET` | recommended | set same value as app's `EXPO_PUBLIC_API_TOKEN`; all API calls then require `x-arcfore-key` |
| `AI_DAILY_LIMIT_PER_CLIENT` | no | default 10/day per client |
| `AI_DAILY_LIMIT_PER_IP` | no | default 30/day per IP (anti device-id rotation) |
| `AI_DAILY_GLOBAL_LIMIT` | no | default 200/day total — hard OpenAI spend cap |
| `AI_REQUIRE_AUTH` | no | `true` = AI endpoints need a verified Clerk JWT |
| `MAX_FRAME_COUNT` | yes for Vercel | `12` (app sends ≤12 frames) |
| `MAX_FRAME_BYTES` | yes for Vercel | `368640` (360KB × 12 ≈ 4.2MB — under Vercel's 4.5MB request-body cap) |
| `COURSE_CACHE_TTL_SECONDS` | no | default 21600 |
| `CLERK_SECRET_KEY` / `CLERK_JWT_ISSUER` | optional | enables Clerk JWT verification |
| `CORS_ORIGINS` | no | `*` is fine — native app, no browser Origin |
| `PORT` | no | ignored on Vercel |

Or via CLI, e.g.:

```bash
vercel env add OPENAI_API_KEY production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
# ... repeat for each row above
```

## 4. Deploy

```bash
cd server
vercel --prod
```

This runs automatically on every push if you imported the repo via Git.

Verify:

```bash
curl https://<project>.vercel.app/v1/health
# → {"ok":true,"service":"arcfore-api","providers":{...},"aiProtection":"upstash-redis"}
```

`aiProtection` must be `"upstash-redis"` — `"blocked"` means Upstash env vars
are missing, `"in-memory"` shouldn't appear in production.

## 5. Domain: `api.arcfore.aadeec.com` via Route 53

1. **Vercel**: Project → Settings → Domains → Add `api.arcfore.aadeec.com`.
   Vercel reports "Invalid Configuration" until DNS exists — that's expected.
2. **Route 53**: Hosted zones → `aadeec.com` → **Create record**:
   - Record name: `api.arcfore`
   - Record type: **CNAME**
   - Value: `cname.vercel-dns.com`
   - TTL: `300`
3. Back in Vercel → Domains → **Refresh**. It issues a TLS cert automatically
   (a few minutes). Then `https://api.arcfore.aadeec.com/v1/health` should
   answer.

The app already targets this URL (`app.json → extra.apiUrl`), so no app-side
change is needed — just ship a build/update after the domain is live.

## Limits to know

- **Request body**: 4.5MB hard cap at Vercel's edge (multipart swing uploads
  are why `MAX_FRAME_COUNT`/`MAX_FRAME_BYTES` above must stay sized down;
  oversize totals get a Vercel `413 FUNCTION_PAYLOAD_TOO_LARGE` before your
  code runs — the app surfaces it via its normal error path).
- **Duration**: 300s max (Hobby and Pro default) — set in `vercel.json`; the
  app's 240s upload timeout fits inside it.
- **OpenAI outbound**: works normally from functions; the vision call streams
  its result back inside the same invocation, no sockets/callbacks needed.
