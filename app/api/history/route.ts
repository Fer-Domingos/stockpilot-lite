import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export async function GET() {
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
