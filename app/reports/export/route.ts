import { getReportsData } from '@/app/actions';
import { createWorkbookBuffer } from '@/lib/xlsx';

type CellValue = string | number | null | undefined;

function appendRow(rows: CellValue[][], values: CellValue[]) {
  rows.push(values);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildFilename(data: Awaited<ReturnType<typeof getReportsData>>['data']) {
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { data } = await getReportsData({
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    jobId: searchParams.get('jobId') ?? undefined,
    materialId: searchParams.get('materialId') ?? undefined
  });

  const rows: CellValue[][] = [];

  appendRow(rows, ['StockPilot Reports Export']);
  appendRow(rows, []);
  appendRow(rows, ['Report Metadata']);
  appendRow(rows, ['Mode', data.reportMetadata.mode]);
  appendRow(rows, ['Start Date', data.filters.startDate ?? 'All time']);
  appendRow(rows, ['End Date', data.filters.endDate ?? 'All time']);
  appendRow(
    rows,
    ['Selected Job', data.reportMetadata.selectedJob ? `${data.reportMetadata.selectedJob.number} — ${data.reportMetadata.selectedJob.name}` : 'All jobs']
  );
  appendRow(
    rows,
    ['Selected Material', data.reportMetadata.selectedMaterial ? `${data.reportMetadata.selectedMaterial.sku} — ${data.reportMetadata.selectedMaterial.name}` : 'All materials']
  );
  appendRow(rows, []);

  appendRow(rows, ['Summary Cards']);
  appendRow(rows, ['Materials Tracked', 'Transactions in Range', 'Issued Units in Range', 'Receipts in Range']);
  appendRow(rows, [
    data.inventorySummary.materialCount,
    data.activitySummary.totalTransactions,
    data.activitySummary.issueQuantity,
    data.activitySummary.receiveQuantity
  ]);
  appendRow(rows, []);

  appendRow(rows, ['Total Inventory by Material']);
  appendRow(rows, ['Material', 'SKU', 'Unit', 'Shop Quantity', 'Total Job Quantity', 'Total Inventory']);
  if (data.inventorySummary.rows.length === 0) {
    appendRow(rows, ['No inventory balances found']);
  } else {
    for (const row of data.inventorySummary.rows) {
      appendRow(rows, [row.materialName, row.materialSku, row.unit, row.shopQuantity, row.totalJobQuantity, row.totalQuantity]);
    }
  }
  appendRow(rows, []);

  appendRow(rows, ['Most Used Materials']);
  appendRow(rows, ['Material', 'SKU', 'Issue Transactions', 'Total Issued', 'Unit']);
  if (data.topMaterials.length === 0) {
    appendRow(rows, ['No issue activity found for this date range']);
  } else {
    for (const row of data.topMaterials) {
      appendRow(rows, [row.materialName, row.materialSku, row.issueCount, row.issuedQuantity, row.unit]);
    }
  }
  appendRow(rows, []);

  appendRow(rows, ['Recent Activity']);
  appendRow(rows, ['Date', 'Type', 'Material', 'SKU', 'Quantity', 'Unit', 'From', 'To', 'Invoice', 'Vendor', 'Notes']);
  if (data.recentActivity.length === 0) {
    appendRow(rows, ['No recent transactions found for this date range']);
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
        entry.notes
      ]);
    }
  }

  const workbook = createWorkbookBuffer('Reports', rows);

  return new Response(workbook, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${buildFilename(data)}"`,
      'Content-Length': String(workbook.byteLength),
      'Cache-Control': 'no-store'
    }
  });
}
