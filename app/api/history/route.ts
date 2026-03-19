import { InventoryLocationType } from '@prisma/client';
import { unstable_noStore as noStore } from 'next/cache';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function formatLocationLabel(
  locationType: InventoryLocationType | null,
  job: { number: string; name: string } | null | undefined
): string {
  if (!locationType) {
    return 'N/A';
  }

  if (locationType === 'SHOP') {
    return 'Shop';
  }

  if (job) {
    return `${job.number} — ${job.name}`;
  }

  return 'Job';
}

function formatMaterialLabel(material: { sku: string; name: string }): string {
  const sku = material.sku.trim();
  const name = material.name.trim();

  if (sku && name) {
    return `${sku} — ${name}`;
  }

  return name || sku || '—';
}

export async function GET() {
  noStore();

  try {
    const transactions = await prisma.inventoryTransaction.findMany({
      include: {
        material: true,
        locationFromJob: true,
        locationToJob: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      data: transactions.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt.toISOString(),
        type: entry.transactionType,
        materialId: entry.materialId,
        materialName: formatMaterialLabel(entry.material),
        quantity: entry.quantity,
        unit: entry.material.unit,
        locationFrom: formatLocationLabel(entry.locationFromType, entry.locationFromJob),
        locationTo:
          entry.transactionType === 'ISSUE'
            ? 'Production / Consumption'
            : formatLocationLabel(entry.locationToType, entry.locationToJob),
        invoiceNumber: entry.invoiceNumber,
        vendorName: entry.vendor,
        notes: entry.notes
      }))
    });
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
