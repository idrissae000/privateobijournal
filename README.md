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

`NEXT_PUBLIC_*` values are baked in at build time: redeploy after changing them.

## R2 CORS (required for uploads)

Bucket → Settings → CORS policy:

```json
[{
  "AllowedOrigins": ["http://localhost:3000", "https://<your-vercel-domain>"],
  "AllowedMethods": ["GET", "PUT"],
  "AllowedHeaders": ["Content-Type"],
  "MaxAgeSeconds": 3600
}]
```

## Database

Migrations live in `supabase/migrations/` (schema + RLS, anon revoke, single-user lock). The lock is a trigger on
`auth.users` that rejects any sign-up once an account exists, so public signup stays closed even if the dashboard
toggle is on.

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
