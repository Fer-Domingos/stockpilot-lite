import { unstable_noStore as noStore } from 'next/cache';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  noStore();

  try {
    const transactions = await prisma.inventoryTransaction.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ data: transactions });
  } catch (error) {
    console.error('Failed to fetch history transactions:', error);

    return NextResponse.json(
      {
        error: 'Failed to load history.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
