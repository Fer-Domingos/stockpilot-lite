# StockPilot Lite

StockPilot Lite is a simple SaaS-style inventory management app for cabinet shops.

## Stack
- Next.js (App Router)
- TypeScript
- Prisma
- PostgreSQL

## Features
- Login screen
- Dashboard overview
- Materials catalog
- Receive materials workflow
- Issue materials workflow
- Transaction history
- Seed data with default `Shop` location

## Data Models
- `User`
- `Material`
- `InventoryTransaction`
- `Location`

See `prisma/schema.prisma` for full schema.

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env template:
   ```bash
   cp .env.example .env
   ```
3. Run migrations:
   ```bash
   npx prisma migrate dev --name init
   ```
4. Seed demo data:
   ```bash
   npm run prisma:seed
   ```
5. Start app:
   ```bash
   npm run dev
   ```

## Build for Vercel
This project is ready for Vercel deployment.

Required environment variable:
- `DATABASE_URL` (PostgreSQL)

Build command:
```bash
npm run build
```
