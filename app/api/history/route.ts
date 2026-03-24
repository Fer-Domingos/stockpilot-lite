import { NextResponse } from "next/server";

import { listInventoryTransactions } from "@/lib/inventory-transactions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const transactions = await listInventoryTransactions();

    return NextResponse.json(
      {
        data: transactions.map((entry) => ({
          id: entry.id,
          createdAt: entry.createdAt,
          type: entry.type,
          materialId: entry.materialId,
          materialName: `${entry.materialSku} — ${entry.materialName}`,
          quantity: entry.quantity,
          unit: entry.unit,
          locationFrom: entry.locationFrom,
          locationTo: entry.locationTo,
          invoiceNumber:
            entry.invoiceNumber === "—" ? null : entry.invoiceNumber,
          vendorName: entry.vendorName === "—" ? null : entry.vendorName,
          usedFor: entry.usedFor === "—" ? null : entry.usedFor,
          notes: entry.notes === "—" ? null : entry.notes,
          reversedTransactionId: entry.reversedTransactionId,
          reversalReason: entry.reversalReason === "—" ? null : entry.reversalReason,
          reversedAt: entry.reversedAt,
          reversedByEmail: entry.reversedByEmail === "—" ? null : entry.reversedByEmail,
          isReversal: entry.isReversal,
          isReversed: entry.isReversed,
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Failed to fetch history transactions:", error);

    return NextResponse.json(
      {
        error: "Failed to load history.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
