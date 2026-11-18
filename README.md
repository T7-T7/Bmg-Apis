# BMG APIs

TypeScript-first API platform interface built with Next.js App Router.

## Stack
- Next.js 16.4.6
- React 19
- TypeScript strict mode
- Node.js runtime for server-side operations
- CSS responsive interface

## Requirements
- Node.js 20.9+
- npm

## Local development
```bash
npm install
npm run dev
```

## Validation
```bash
npm run typecheck
npm run lint
npm run build
```

GitHub Actions CI runs these checks on pushes and pull requests to `main`.

## Pages
- Dashboard: `/`
- API catalog: `/apis`
- API details: `/apis/[slug]`
- Builder preview: `/create`
- Workspace: `/my-apis`
- Documentation: `/docs`
- Status: `/status`

## Project tree
```
app/
  apis/
    [slug]/page.tsx
    page.tsx
  create/page.tsx
  docs/page.tsx
  my-apis/page.tsx
  status/page.tsx
  globals.css
  layout.tsx
  loading.tsx
  not-found.tsx
components/
  app-shell.tsx
  api-card.tsx
lib/
  api-data.ts
backend/
  README.md
public/
  bmg-apis-mark.svg
```

All application source files use TypeScript (`.ts` / `.tsx`). API runtime, storage, authentication and publishing are not implemented yet; the catalog is sample data.

## Hosting target
Target: Vercel Hobby free plan, subject to its free-plan limits and personal/non-commercial use policy. Prefer short serverless-compatible requests; do not depend on long-running processes, background workers, or persistent local filesystem writes. Use external durable storage only after selecting a free-tier-compatible service and reviewing its limits. Keep secrets in server-side environment variables only.