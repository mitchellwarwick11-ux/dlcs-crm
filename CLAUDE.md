# DLCS CRM — Developer Guide

## Project Overview

Next.js 16 / Supabase CRM app for a land surveying firm (Delfs Lascelles Consulting Surveyors). Single office, ~20 staff, Queensland Australia.

## Local Development

- **Source code**: `C:\Projects\dlcs-crm`
- **Dev server**: `npm run dev` (localhost:3000)
- **Stack**: Next.js 16 (App Router, Turbopack), Supabase (Postgres + Auth), TypeScript, Tailwind CSS

## Git & Deployment

- **GitHub**: https://github.com/mitchellwarwick11-ux/dlcs-crm (private)
- **Branch**: `main`
- **Hosting**: Vercel (Hobby plan) — auto-deploys on every push to `main`
- **Production URL**: https://dlcs-crm.vercel.app

### Deploy workflow

1. Make changes in `C:\Projects\dlcs-crm`
2. `git add <files>` + `git commit -m "message"`
3. `git push origin main`
4. Vercel builds and deploys automatically (~1-2 minutes)

## Database

- **Supabase** (hosted, not local)
- Migration SQL files are in `supabase/migrations/` for reference
- Schema changes must be run manually in the **Supabase SQL Editor** (not via CLI)
- Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are in `.env.local` (gitignored) and set in Vercel dashboard

## Project Structure

```
src/
  app/
    (auth)/              — Login page
    (dashboard)/         — All authenticated pages (projects, clients, staff, etc.)
      my-work/           — PM task dashboard (cross-project task view)
      projects/          — Jobs list + [jobNumber] detail pages (tasks, time, invoices, quotes)
      clients/           — Client list + detail/edit
      fieldwork/         — Field schedule board (2-week view)
      timesheets/        — Weekly timesheet entry
      staff/             — Staff list + profiles
      quotes/            — Quotes + fee proposals
      reports/           — Financial reports
      settings/          — Company settings, equipment, access rights, imports
    field/               — Mobile field app for surveyors
    print/               — Print-friendly invoice/quote pages
    api/                 — API routes (invoice PDF, lot lookup)
  components/            — Client components organised by feature
  lib/
    constants/           — Status enums, job types, roles
    supabase/            — Server + client Supabase helpers
    utils/               — Formatters, rate calculator
    validations/         — Zod schemas
  types/
    database.ts          — All TypeScript types for DB tables
```

## Key Patterns

- **Auth guard**: Every page calls `supabase.auth.getUser()`, redirects to `/login` if null
- **Staff lookup**: Current user found via `staff_profiles.email = user.email`
- **Access levels**: `staff`, `project_manager`, `admin` — defined in `src/lib/preview-role.ts`
- **Role-based nav**: `ROLE_NAV` in `preview-role.ts` controls which pages each role sees
- **Supabase client**: Server pages use `createClient()` from `@/lib/supabase/server`, client components use `@/lib/supabase/client`
- **Type casting**: Supabase client is cast with `as any` for queries (no generated types)
- **Mutations**: Client components use `createClient() as any` then `router.refresh()`
