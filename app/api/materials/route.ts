import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function normalizeSku(inputSku: unknown): string {
  const normalized = typeof inputSku === "string" ? inputSku.trim() : "";

  if (normalized) {
    return normalized;
  }

  return `MAT-${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const sku = normalizeSku(body?.sku);
    const unit = typeof body?.unit === "string" ? body.unit.trim().toUpperCase() : "";
    const minimumStock =
      typeof body?.minimumStock === "number" ? body.minimumStock : null;
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

    if (!name || !unit) {
      return NextResponse.json(
        { error: "Name and unit are required" },
        { status: 400 },
      );
    }

    const material = await prisma.material.create({
      data: {
        name,
        sku,
        unit,
        minStock: minimumStock || null,
        notes: notes || null,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        quantity: true,
        minStock: true,
        notes: true,
      },
    });

    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    console.error("Create material error:", error);

    return NextResponse.json(
      { error: "Failed to create material" },
      { status: 500 },
    );
  }
}
