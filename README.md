# StockPilot Lite

StockPilot Lite is a simple SaaS-style inventory management app for cabinet shops.

## Stack
- Next.js (App Router)
- TypeScript
- Prisma
- PostgreSQL (Neon-compatible)

## Features
- Login screen
- Dashboard overview
- Materials catalog (PostgreSQL)
- Jobs catalog (PostgreSQL)
- Receive materials workflow (demo logic)
- Issue/transfer materials workflow (demo logic)
- Transaction history
- Seed data for Materials and Jobs

## Data Models
- `User`
- `Location`
- `Material`
- `Job`
- `InventoryTransaction`

See `prisma/schema.prisma` for full schema.

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env template and set your Neon connection string plus a stable auth secret:
   ```bash
   cp .env.example .env
   ```
3. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
4. Run local development migration:
   ```bash
   npx prisma migrate dev --name materials-jobs-postgres
   ```
5. Seed Materials and Jobs:
   ```bash
   npm run prisma:seed
   ```
6. Start app:
   ```bash
   npm run dev
   ```

## Production-safe update architecture

### Session and auth secret stability
- Set `AUTH_SECRET` in Vercel and keep it identical across preview and production deploys for the same environment.
- When rotating secrets, deploy once with both `AUTH_SECRET` and `AUTH_SECRET_PREVIOUS` set so existing signed cookies remain valid while new requests are re-issued with the new secret.
- Never rely on the built-in development fallback secret in production.

### Fresh auth/session reads
- Session-aware pages and data loaders should stay dynamic so users do not need to log out and back in after a deploy.
- API routes that return session-sensitive data should send `no-store` responses and use dynamic rendering.

### Vercel deployment workflow
1. Open a preview deployment for every pull request.
2. Validate preview with production-like environment variables, but keep `RUN_PRISMA_MIGRATIONS=false` so previews do not mutate the shared production database.
3. Merge only after preview validation passes.
4. In production, keep `RUN_PRISMA_MIGRATIONS=true` so the deployment runs `prisma migrate deploy` before `next build`.
5. If a schema change is risky, split it into expand/backfill/contract migrations across multiple deploys.

### Prisma migration safety
- Use `prisma migrate dev` only in local development.
- Use `prisma migrate deploy` for production rollouts.
- Avoid destructive schema changes in the same deployment that still serves old application code.
- Prefer backward-compatible migrations first, then app code, then cleanup migrations later.

## Build for Vercel
Required environment variables:
- `DATABASE_URL` (PostgreSQL)
- `AUTH_SECRET` (stable across deploys)
- `AUTH_SECRET_PREVIOUS` (optional, only during secret rotation)
- `RUN_PRISMA_MIGRATIONS` (`true` in production, `false` in preview)

Build command:
```bash
npm run build
```
