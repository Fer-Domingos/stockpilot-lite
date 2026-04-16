import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const sku = typeof body?.sku === "string" ? body.sku.trim() : "";
  const unit = typeof body?.unit === "string" ? body.unit.trim() : "";
  const minimumStockValue = body?.minimumStock;
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

  const minimumStock =
    minimumStockValue === null ||
    minimumStockValue === undefined ||
    String(minimumStockValue).trim() === ""
      ? null
      : Number(minimumStockValue);

  console.log("Incoming data:", { name, sku, unit, minimumStock, notes });

  try {
    const material = await prisma.material.create({
      data: {
        name,
        sku,
        unit,
        minStock:
          minimumStock === null || Number.isNaN(minimumStock)
            ? null
            : Math.max(0, Math.floor(minimumStock)),
        notes: notes || "",
      },
    });

    console.log("Material created:", material);

    return NextResponse.json(material);
  } catch (error) {
    console.error("CREATE MATERIAL ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create material",
      },
      { status: 500 },
    );
  }
}
