import { InventoryLocationType, Prisma } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "@/lib/prisma";

export type InventoryTransactionView = {
  id: string;
  createdAt: string;
  type: "RECEIVE" | "TRANSFER" | "ISSUE" | "ADJUSTMENT";
  materialId: string;
  reversedTransactionId: string | null;
  reversalReason: string;
  reversedAt: string | null;
  reversedByUserId: string | null;
  reversedByEmail: string;
  isReversal: boolean;
  isReversed: boolean;
  materialSku: string;
  materialName: string;
  quantity: number;
  unit: string;
  locationFrom: string;
  locationTo: string;
  invoiceNumber: string;
  vendorName: string;
  usedFor: string;
  notes: string;
  hasPhoto: boolean;
};

function formatLocationLabel(
  locationType: InventoryLocationType | null,
  job: { number: string; name: string } | null | undefined,
): string {
  if (!locationType) {
    return "N/A";
  }

  if (locationType === "SHOP") {
    return "Shop";
  }

  if (job) {
    return `${job.number} — ${job.name}`;
  }

  return "Job";
}

export function mapInventoryTransaction(entry: {
  id: string;
  createdAt: Date;
  transactionType: InventoryTransactionView["type"];
  materialId: string;
  quantity: number;
  invoiceNumber: string | null;
  vendor: string | null;
  usedFor: string | null;
  notes: string | null;
  photoUrl: string | null;
  locationFromType: InventoryLocationType | null;
  locationToType: InventoryLocationType | null;
  material: { sku: string; name: string; unit: string };
  locationFromJob: { number: string; name: string } | null;
  locationToJob: { number: string; name: string } | null;
  reversedTransactionId: string | null;
  reversalReason: string | null;
  reversedAt: Date | null;
  reversedByUserId: string | null;
  reversedByUser: { email: string } | null;
  reversalTransaction: {
    id: string;
    reversalReason: string | null;
    reversedAt: Date | null;
    reversedByUserId: string | null;
    reversedByUser: { email: string } | null;
  } | null;
}): InventoryTransactionView {
  const reversalDetails = entry.reversalTransaction;
  const effectiveReversalReason = entry.reversedTransactionId
    ? entry.reversalReason
    : reversalDetails?.reversalReason ?? entry.reversalReason;
  const effectiveReversedAt = entry.reversedTransactionId
    ? entry.reversedAt
    : reversalDetails?.reversedAt ?? null;
  const effectiveReversedByUserId = entry.reversedTransactionId
    ? entry.reversedByUserId
    : reversalDetails?.reversedByUserId ?? null;
  const effectiveReversedByEmail = entry.reversedTransactionId
    ? entry.reversedByUser?.email
    : reversalDetails?.reversedByUser?.email ?? null;

  return {
    id: entry.id,
    createdAt: entry.createdAt.toISOString(),
    type: entry.transactionType,
    materialId: entry.materialId,
    reversedTransactionId: entry.reversedTransactionId,
    reversalReason: effectiveReversalReason ?? "—",
    reversedAt: effectiveReversedAt ? effectiveReversedAt.toISOString() : null,
    reversedByUserId: effectiveReversedByUserId,
    reversedByEmail: effectiveReversedByEmail ?? "—",
    isReversal: Boolean(entry.reversedTransactionId),
    isReversed: Boolean(entry.reversalTransaction),
    materialSku: entry.material.sku,
    materialName: entry.material.name,
    quantity: entry.quantity,
    unit: entry.material.unit,
    locationFrom: formatLocationLabel(
      entry.locationFromType,
      entry.locationFromJob,
    ),
    locationTo:
      entry.transactionType === "ISSUE"
        ? "Production / Consumption"
        : formatLocationLabel(entry.locationToType, entry.locationToJob),
    invoiceNumber: entry.invoiceNumber ?? "—",
    vendorName: entry.vendor ?? "—",
    usedFor: entry.usedFor ?? "—",
    notes: entry.notes ?? "—",
    hasPhoto: Boolean(entry.photoUrl),
  };
}

export async function listInventoryTransactions(
  options: {
    where?: Prisma.InventoryTransactionWhereInput;
    take?: number;
  } = {},
): Promise<InventoryTransactionView[]> {
  noStore();

  const transactions = await prisma.inventoryTransaction.findMany({
    where: options.where,
    include: {
      material: true,
      locationFromJob: true,
      locationToJob: true,
      reversedByUser: {
        select: { email: true },
      },
      reversalTransaction: {
        select: {
          id: true,
          reversalReason: true,
          reversedAt: true,
          reversedByUserId: true,
          reversedByUser: {
            select: { email: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    ...(typeof options.take === "number" ? { take: options.take } : {}),
  });

  return transactions.map(mapInventoryTransaction);
}
