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
Required environment variable:
- `DATABASE_URL` (PostgreSQL)

Build command:
```bash
npm run build
```
