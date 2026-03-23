import { getReportsData } from "@/app/actions";
import {
  createWorkbookBuffer,
  type CellValue,
  type SheetDefinition,
} from "@/lib/xlsx";

export const dynamic = "force-dynamic";

function normalizeReversalFilter(value: string | null) {
  return value === "include" || value === "only" || value === "exclude"
    ? value
    : undefined;
}

function appendRow(rows: CellValue[][], values: CellValue[]) {
  rows.push(values);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildFilename(
  data: Awaited<ReturnType<typeof getReportsData>>["data"],
) {
  const today = new Date().toISOString().slice(0, 10);

  if (data.reportMetadata.selectedJob && data.reportMetadata.selectedMaterial) {
    return `stockpilot-report-job-material-${today}.xlsx`;
  }

  if (data.reportMetadata.selectedJob) {
    return `stockpilot-report-job-${slugify(data.reportMetadata.selectedJob.number)}-${today}.xlsx`;
  }

  if (data.reportMetadata.selectedMaterial) {
    return `stockpilot-report-material-${slugify(data.reportMetadata.selectedMaterial.sku)}-${today}.xlsx`;
  }

  return `stockpilot-report-general-${today}.xlsx`;
}

function buildMetadataRows(
  data: Awaited<ReturnType<typeof getReportsData>>["data"],
) {
  return [
    ["Mode", data.reportMetadata.mode],
    ["Start Date", data.filters.startDate ?? "All time"],
    ["End Date", data.filters.endDate ?? "All time"],
    [
      "Selected Job",
      data.reportMetadata.selectedJob
        ? `${data.reportMetadata.selectedJob.number} — ${data.reportMetadata.selectedJob.name}`
        : "All jobs",
    ],
    [
      "Selected Material",
      data.reportMetadata.selectedMaterial
        ? `${data.reportMetadata.selectedMaterial.sku} — ${data.reportMetadata.selectedMaterial.name}`
        : "All materials",
    ],
    ["Reversals", data.filters.reversalFilter],
  ] satisfies CellValue[][];
}

function buildSummarySheet(
  data: Awaited<ReturnType<typeof getReportsData>>["data"],
): SheetDefinition {
  const rows: CellValue[][] = [];

  appendRow(rows, ["StockPilot Report"]);
  appendRow(rows, []);
  for (const row of buildMetadataRows(data)) {
    appendRow(rows, row);
  }
  appendRow(rows, []);
  appendRow(rows, ["Summary"]);
  appendRow(rows, [
    "Materials Tracked",
    "Transactions in Range",
    "Issued Units in Range",
    "Receipts in Range",
    "Reversals in Range",
  ]);
  appendRow(rows, [
    data.inventorySummary.materialCount,
    data.activitySummary.totalTransactions,
    data.activitySummary.issueQuantity,
    data.activitySummary.receiveQuantity,
    data.activitySummary.reversalCount,
  ]);

  return {
    name: "Summary",
    rows,
    freezePane: "A12",
    autoFilter: "A11:E12",
    minColumnWidth: 18,
    metadataRows: [3, 4, 5, 6, 7, 8],
    titleRow: 1,
    sectionRows: [10],
    tableHeaderRows: [11],
    rightAlignedColumns: [0, 1, 2, 3, 4],
  };
}

function buildInventorySheet(
  data: Awaited<ReturnType<typeof getReportsData>>["data"],
): SheetDefinition {
  const rows: CellValue[][] = [];

  appendRow(rows, ["StockPilot Report"]);
  appendRow(rows, []);
  for (const row of buildMetadataRows(data)) {
    appendRow(rows, row);
  }
  appendRow(rows, []);
  appendRow(rows, ["Inventory"]);
  appendRow(rows, [
    "Material",
    "SKU",
    "Unit",
    "Shop Quantity",
    "Total Job Quantity",
    "Total Inventory",
  ]);

  if (data.inventorySummary.rows.length === 0) {
    appendRow(rows, ["No inventory balances found", "", "", "", "", ""]);
  } else {
    for (const row of data.inventorySummary.rows) {
      appendRow(rows, [
        row.materialName,
        row.materialSku,
        row.unit,
        row.shopQuantity,
        row.totalJobQuantity,
        row.totalQuantity,
      ]);
    }
  }

  return {
    name: "Inventory",
    rows,
    freezePane: "A12",
    autoFilter: `A11:F${rows.length}`,
    minColumnWidth: 14,
    metadataRows: [3, 4, 5, 6, 7, 8],
    titleRow: 1,
    sectionRows: [10],
    tableHeaderRows: [11],
    rightAlignedColumns: [3, 4, 5],
  };
}

function buildMostUsedSheet(
  data: Awaited<ReturnType<typeof getReportsData>>["data"],
): SheetDefinition {
  const rows: CellValue[][] = [];

  appendRow(rows, ["StockPilot Report"]);
  appendRow(rows, []);
  for (const row of buildMetadataRows(data)) {
    appendRow(rows, row);
  }
  appendRow(rows, []);
  appendRow(rows, ["Most Used Materials"]);
  appendRow(rows, [
    "Material",
    "SKU",
    "Issue Transactions",
    "Total Issued",
    "Unit",
  ]);

  if (data.topMaterials.length === 0) {
    appendRow(rows, [
      "No issue activity found for this date range",
      "",
      "",
      "",
      "",
    ]);
  } else {
    for (const row of data.topMaterials) {
      appendRow(rows, [
        row.materialName,
        row.materialSku,
        row.issueCount,
        row.issuedQuantity,
        row.unit,
      ]);
    }
  }

  return {
    name: "Most Used",
    rows,
    freezePane: "A12",
    autoFilter: `A11:E${rows.length}`,
    minColumnWidth: 14,
    metadataRows: [3, 4, 5, 6, 7, 8],
    titleRow: 1,
    sectionRows: [10],
    tableHeaderRows: [11],
    rightAlignedColumns: [2, 3],
  };
}

function buildActivitySheet(
  data: Awaited<ReturnType<typeof getReportsData>>["data"],
): SheetDefinition {
  const rows: CellValue[][] = [];

  appendRow(rows, ["StockPilot Report"]);
  appendRow(rows, []);
  for (const row of buildMetadataRows(data)) {
    appendRow(rows, row);
  }
  appendRow(rows, []);
  appendRow(rows, ["Recent Activity"]);
  appendRow(rows, [
    "Date",
    "Type",
    "Material",
    "SKU",
    "Quantity",
    "Unit",
    "From",
    "To",
    "Invoice",
    "Vendor",
    "Notes",
  ]);

  if (data.recentActivity.length === 0) {
    appendRow(rows, [
      "No recent transactions found for this date range",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  } else {
    for (const entry of data.recentActivity) {
      appendRow(rows, [
        new Date(entry.createdAt).toISOString(),
        entry.type,
        entry.materialName,
        entry.materialSku,
        entry.quantity,
        entry.unit,
        entry.locationFrom,
        entry.locationTo,
        entry.invoiceNumber,
        entry.vendorName,
        entry.notes,
      ]);
    }
  }

  return {
    name: "Activity",
    rows,
    freezePane: "A12",
    autoFilter: `A11:K${rows.length}`,
    minColumnWidth: 12,
    metadataRows: [3, 4, 5, 6, 7, 8],
    titleRow: 1,
    sectionRows: [10],
    tableHeaderRows: [11],
    rightAlignedColumns: [4],
  };
}

function buildReversalSheet(
  data: Awaited<ReturnType<typeof getReportsData>>["data"],
): SheetDefinition {
  const rows: CellValue[][] = [];

  appendRow(rows, ["StockPilot Report"]);
  appendRow(rows, []);
  for (const row of buildMetadataRows(data)) {
    appendRow(rows, row);
  }
  appendRow(rows, []);
  appendRow(rows, ["Reversal Activity"]);
  appendRow(rows, [
    "Date",
    "Original Transaction ID",
    "Type",
    "Material",
    "SKU",
    "Quantity",
    "Unit",
    "Reason",
    "Reversed By",
  ]);

  if (data.reversalActivity.length === 0) {
    appendRow(rows, ["No reversal activity found", "", "", "", "", "", "", "", ""]);
  } else {
    for (const entry of data.reversalActivity) {
      appendRow(rows, [
        new Date(entry.reversedAt ?? entry.createdAt).toISOString(),
        entry.originalTransactionId ?? "—",
        entry.transactionType,
        entry.materialName,
        entry.materialSku,
        entry.quantity,
        entry.unit,
        entry.reversalReason,
        entry.reversedByEmail,
      ]);
    }
  }

  return {
    name: "Reversals",
    rows,
    freezePane: "A12",
    autoFilter: `A11:I${rows.length}`,
    minColumnWidth: 14,
    metadataRows: [3, 4, 5, 6, 7, 8],
    titleRow: 1,
    sectionRows: [10],
    tableHeaderRows: [11],
    rightAlignedColumns: [5],
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { data } = await getReportsData({
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
    jobId: searchParams.get("jobId") ?? undefined,
    materialId: searchParams.get("materialId") ?? undefined,
    timeZoneOffsetMinutes:
      searchParams.get("timeZoneOffsetMinutes") ?? undefined,
    reversalFilter: normalizeReversalFilter(searchParams.get("reversalFilter")),
  });

  const workbook = createWorkbookBuffer([
    buildSummarySheet(data),
    buildInventorySheet(data),
    buildMostUsedSheet(data),
    buildActivitySheet(data),
    buildReversalSheet(data),
  ]);

  return new Response(workbook, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildFilename(data)}"`,
      "Content-Length": String(workbook.byteLength),
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
