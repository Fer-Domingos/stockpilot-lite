import { InventoryTransactionType } from '@prisma/client';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

type JobSummary = {
  id: string;
  number: string;
  name: string;
};

function formatJobLabel(job: JobSummary | null): string | null {
  if (!job) {
    return null;
  }

  return `${job.number} — ${job.name}`;
}

export async function GET() {
  try {
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        transactionType: {
          in: [
            InventoryTransactionType.RECEIVE,
            InventoryTransactionType.TRANSFER,
            InventoryTransactionType.ISSUE,
            InventoryTransactionType.ADJUSTMENT
          ]
        }
      },
      include: {
        material: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true
          }
        },
        locationFromJob: {
          select: {
            id: true,
            number: true,
            name: true
          }
        },
        locationToJob: {
          select: {
            id: true,
            number: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const rows = transactions.map((entry) => {
      const fromJobLabel = formatJobLabel(entry.locationFromJob);
      const toJobLabel = formatJobLabel(entry.locationToJob);

      return {
        id: entry.id,
        createdAt: entry.createdAt.toISOString(),
        type: entry.transactionType,
        materialId: entry.materialId,
        materialSku: entry.material.sku,
        materialName: entry.material.name,
        quantity: entry.quantity,
        unit: entry.material.unit,
        locationFrom: entry.locationFromType === 'SHOP' ? 'Shop' : fromJobLabel ?? 'Job',
        locationTo:
          entry.transactionType === 'ISSUE'
            ? 'Production / Consumption'
            : entry.locationToType === 'SHOP'
              ? 'Shop'
              : toJobLabel ?? 'Job',
        locationFromJobName: fromJobLabel,
        locationToJobName: toJobLabel,
        invoiceNumber: entry.invoiceNumber,
        vendorName: entry.vendor,
        notes: entry.notes,
        hasPhoto: Boolean(entry.photoUrl)
      };
    });

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('Failed to fetch history transactions:', error);
    return NextResponse.json({ error: 'Failed to load history.' }, { status: 500 });
  }
}
