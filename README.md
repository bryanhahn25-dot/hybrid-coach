# Hybrid Coach

An adaptive running coach: it builds a periodized training plan for your goal race, imports your
runs from Strava, and adjusts the plan when life happens -- through chat, not a rigid PDF.

## Stack

- Next.js 16 (App Router) + React 19
- Prisma + Postgres (built against [Neon](https://neon.com))
- `ai` (Vercel AI SDK) + `@ai-sdk/google` (Gemini 2.5 Flash) for the coach chat, with
  tool-calling that can actually edit the plan
- Strava API v3 (OAuth) for importing activities

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, GOOGLE_GENERATIVE_AI_API_KEY, STRAVA_CLIENT_ID/SECRET
npx prisma migrate deploy   # or `prisma migrate dev` for local development
npm run dev
```

### Strava app

Create an API app at https://www.strava.com/settings/api. Set its "Authorization Callback Domain"
to match `STRAVA_REDIRECT_URI` (host only, e.g. `localhost` or your deployed domain). The in-app
"Connect Strava" button starts the OAuth flow at `/api/strava/authorize`.

## How it works

- **Plan generation** (`lib/planGenerator.ts`): a transparent, rule-based periodization engine --
  base → build → peak → taper → race -- with cutback weeks and, for ultra distances (50k+),
  back-to-back long run days instead of one ever-growing single run. Not ML, not a black box.
- **Strava import** (`lib/strava.ts`, `app/api/strava/*`): OAuth token exchange/refresh and an
  activity sync that upserts runs and auto-links them to the matching day's planned workout.
- **Coach chat** (`app/api/chat/route.ts`): Gemini 2.5 Flash with two tools -- `getWorkouts` to look up the
  plan, `adjustWorkouts` to actually change it. Tell it "I woke up sick" and it edits today's (and
  the week's) workouts and explains why, instead of just talking about it.

## Current limitations

- Single-user only for now -- there's no login. Every request resolves to one bootstrapped account
  (`lib/currentUser.ts`). The schema is already keyed by `userId` throughout, so adding real auth
  (e.g. [Neon Auth](https://neon.com/docs/guides/auth)) later is additive, not a rewrite.
- No live GPS recording -- runs come in via Strava import, the same way Runna-tracked runs would.
- The plan generator is a heuristic, not a physiologist. It's meant to be transparent and easy to
  tune (see `lib/planGenerator.ts`), not a competitor to a coach's judgment.
