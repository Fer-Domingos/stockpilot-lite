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
2. Copy env template and set your Neon connection string:
   ```bash
   cp .env.example .env
   ```
   `DATABASE_URL="postgresql://..."`
   `DIRECT_URL="postgresql://..."`
3. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
4. Run migration:
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

## Build for Vercel
Required environment variables:
- `DATABASE_URL` for the app/runtime connection (PostgreSQL; pooled Neon string is fine)
- `DIRECT_URL` for Prisma migrations/introspection (use the direct, non-pooled Neon string)

Build command:
```bash
npm run build
```

Migration command (run only when this deploy includes committed Prisma migration files):
```bash
npm run prisma:migrate:deploy
```

Recommended Vercel setup:
- Keep the Vercel build command as `npm run build` so regular deploys do not try to acquire Prisma migration advisory locks.
- Set `DATABASE_URL` for runtime queries.
- Set `DIRECT_URL` for migration commands such as `prisma migrate deploy`.
- Only run `npm run prisma:migrate:deploy` for releases that actually include new migration files in `prisma/migrations/`.

## CMD environment bootstrap (safe production workflow)

Use this for a brand-new database (for example the `stockpilot-cmd` Neon project) without touching your existing `stockpilot-lite` database.

1. Set shell env vars to the **CMD** database only:
   ```bash
   export DATABASE_URL='postgresql://...stockpilot-cmd...'
   export DIRECT_URL='postgresql://...stockpilot-cmd...'
   ```
2. Apply all committed migrations (non-destructive):
   ```bash
   npm run prisma:migrate:deploy
   ```
3. Verify migration status:
   ```bash
   npx prisma migrate status
   ```
4. Create the first admin user (one-time bootstrap guard):
   ```bash
   export CMD_DATABASE_GUARD='stockpilot-cmd'
   export ADMIN_EMAIL='admin@your-company.com'
   export ADMIN_PASSWORD='a-very-strong-password'
   export ADMIN_NAME='StockPilot CMD Admin'
   npm run admin:create:initial
   ```

Notes:
- `admin:create:initial` refuses to run if `DATABASE_URL` does not contain `CMD_DATABASE_GUARD`.
- `admin:create:initial` refuses to run if an admin user already exists.
- No reset command is used in this workflow.
