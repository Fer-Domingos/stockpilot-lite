import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = process.env.DATABASE_URL?.trim();

const unavailableClient = new Proxy(function unavailablePrismaClient() {
  throw new Error('Database is unavailable. Set DATABASE_URL and run migrations to enable database-backed pages.');
}, {
  get() {
    return unavailableClient;
  },
  apply() {
    throw new Error('Database is unavailable. Set DATABASE_URL and run migrations to enable database-backed pages.');
  }
}) as unknown as PrismaClient;

export const prisma =
  globalForPrisma.prisma ??
  (databaseUrl
    ? new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl
          }
        },
        log: ['error', 'warn']
      })
    : unavailableClient);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
