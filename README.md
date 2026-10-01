# Obis Journal

A private, single-user scrapbook journal (PWA). Each month is a chapter, each day is a page.

**Stack:** Next.js 16 (App Router) on Vercel · Supabase (auth + Postgres, RLS on every table) · Cloudflare R2 (private photo storage via presigned URLs).

## Environment variables

Copy `.env.example` to `.env.local` (local) and add the same names in Vercel → Settings → Environment Variables:

| Name | What |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable key |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R2 S3 API credentials (bucket read + write) |
| `R2_BUCKET` | `journal-photos` |
| `IMAGE_SEARCH_MONTHLY_LIMIT` | *Optional.* Max web image searches per calendar month (default 800). Enforced in the database |
| `ANTHROPIC_API_KEY` | *Optional.* Turns on the insight layer (see below). Without it everything else works and the insight UI stays quiet |
| `INSIGHT_MODEL` | *Optional.* Defaults to `claude-sonnet-5`. Use `claude-opus-5-5` for the most capable reading |
| `INSIGHT_DAILY_CALL_LIMIT` | *Optional.* Max Claude calls per day (default 60), enforced in the database |
| `BRAVE_SEARCH_API_KEY` | *Optional.* Turns on web image search (Brave Search API). Without it, pasting an image link still works |

`NEXT_PUBLIC_*` values are baked in at build time: redeploy after changing them.

## R2 CORS (recommended for uploads)

Without it the app still works: if the browser can't upload directly, it uploads through the server instead (`/api/upload`). The rule below just makes uploads direct and faster.

Bucket → Settings → CORS policy:

```json
[{
  "AllowedOrigins": ["http://localhost:3000", "https://privateobijournal.vercel.app"],
  "AllowedMethods": ["GET", "PUT"],
  "AllowedHeaders": ["Content-Type"],
  "MaxAgeSeconds": 3600
}]
```

## Database

Migrations live in `supabase/migrations/` (schema + RLS, anon revoke, single-user lock, themes, search cap, insight layer). The lock is a trigger on
`auth.users` that rejects any sign-up once an account exists, so public signup stays closed even if the dashboard
toggle is on.

## Finding photos

Every photo slot that has a 🔍 button (influences, month cover) can search the web, or take a pasted image link or a copied image. Picked photos are fetched server-side (`/api/import-image`: public http(s) addresses only, images only, 12 MB cap), then compressed and uploaded to your own R2 bucket like any other photo. Nothing hotlinks.

## Themes

Characters and months carry free-form `#themes`. The month page suggests themes that two or more of its influences share, and the Library has a Themes view plus a theme filter.

## Insight layer (Claude API)

The app reflects back at you automatically, in the background, as part of normal use:

| What | When it runs |
| --- | --- |
| Suggested traits (3-5) for a new influence | when you add an influence; you keep, edit or discard them |
| In-character score (overall + per influence) and a one-line reflection | each time you save an entry whose content changed |
| Month-end conclusion alongside your own reflection | when you seal a month |
| Per-influence fidelity ("who I actually lived up to") | computed from the daily scores |
| Character sheet + Arc Watch (same theme, months apart, different stance) | `/archetype`, rewritten when your journal changed (at most every 5 minutes) |
| Foreshadowing (entries that sound like an influence before you named it) | every 3 days, when you open Today |
| Accuracy pass (duplicate characters, theme variants, shaky facts) | weekly, when you open Today, or on demand at `/admin`. It only raises flags |
| Drift / gap notes | computed on Today, dismissible, no notifications |

Rules it follows: AI output is stored in its own columns/tables and never overwrites what you wrote; every job is
skipped quietly if there's no key, the daily cap is hit, or the model declines; jobs use `after()` so saving never waits
on Claude. Requests use structured JSON output, effort tuned per job, and (on models that support it) the server-side refusal fallback. Your
journal text is sent to the Claude API to do this.

## Privacy rules

- Photos are never public: the bucket is private and every view goes through a short-lived presigned URL.
- Progress photos (`is_progress_photo`) are always `is_hidden` and only ever appear on `/progress`.
- Every request except `/login` needs a Supabase session (`src/proxy.ts`).

## Develop

```bash
npm install
npm run dev
```

First sign-in seeds the retrospective months (Mar/Apr/Jun/Jul 2025) and September 2026.
