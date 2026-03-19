import { getReportsData } from '@/app/actions';

function escapeCsv(value: string | number | null | undefined) {
  const normalized = value == null ? '' : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function appendRow(lines: string[], values: Array<string | number | null | undefined>) {
  lines.push(values.map((value) => escapeCsv(value)).join(','));
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
    return `stockpilot-report-job-material-${today}.csv`;
  }

  if (data.reportMetadata.selectedJob) {
    return `stockpilot-report-job-${slugify(data.reportMetadata.selectedJob.number)}-${today}.csv`;
  }

  if (data.reportMetadata.selectedMaterial) {
    return `stockpilot-report-material-${slugify(data.reportMetadata.selectedMaterial.sku)}-${today}.csv`;
  }

  return `stockpilot-report-general-${today}.csv`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { data } = await getReportsData({
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    jobId: searchParams.get('jobId') ?? undefined,
    materialId: searchParams.get('materialId') ?? undefined
  });

  const lines: string[] = [];

  appendRow(lines, ['StockPilot Reports Export']);
  appendRow(lines, []);
  appendRow(lines, ['Report Metadata']);
  appendRow(lines, ['Mode', data.reportMetadata.mode]);
  appendRow(lines, ['Start Date', data.filters.startDate ?? 'All time']);
  appendRow(lines, ['End Date', data.filters.endDate ?? 'All time']);
  appendRow(
    lines,
    ['Selected Job', data.reportMetadata.selectedJob ? `${data.reportMetadata.selectedJob.number} — ${data.reportMetadata.selectedJob.name}` : 'All jobs']
  );
  appendRow(
    lines,
    ['Selected Material', data.reportMetadata.selectedMaterial ? `${data.reportMetadata.selectedMaterial.sku} — ${data.reportMetadata.selectedMaterial.name}` : 'All materials']
  );
  appendRow(lines, []);

  appendRow(lines, ['Summary Cards']);
  appendRow(lines, ['Materials Tracked', 'Transactions in Range', 'Issued Units in Range', 'Receipts in Range']);
  appendRow(lines, [
    data.inventorySummary.materialCount,
    data.activitySummary.totalTransactions,
    data.activitySummary.issueQuantity,
    data.activitySummary.receiveQuantity
  ]);
  appendRow(lines, []);

  appendRow(lines, ['Total Inventory by Material']);
  appendRow(lines, ['Material', 'SKU', 'Unit', 'Shop Quantity', 'Total Job Quantity', 'Total Inventory']);
  if (data.inventorySummary.rows.length === 0) {
    appendRow(lines, ['No inventory balances found']);
  } else {
    for (const row of data.inventorySummary.rows) {
      appendRow(lines, [row.materialName, row.materialSku, row.unit, row.shopQuantity, row.totalJobQuantity, row.totalQuantity]);
    }
  }
  appendRow(lines, []);

  appendRow(lines, ['Most Used Materials']);
  appendRow(lines, ['Material', 'SKU', 'Issue Transactions', 'Total Issued', 'Unit']);
  if (data.topMaterials.length === 0) {
    appendRow(lines, ['No issue activity found for this date range']);
  } else {
    for (const row of data.topMaterials) {
      appendRow(lines, [row.materialName, row.materialSku, row.issueCount, row.issuedQuantity, row.unit]);
    }
  }
  appendRow(lines, []);

  appendRow(lines, ['Recent Activity']);
  appendRow(lines, ['Date', 'Type', 'Material', 'SKU', 'Quantity', 'Unit', 'From', 'To', 'Invoice', 'Vendor', 'Notes']);
  if (data.recentActivity.length === 0) {
    appendRow(lines, ['No recent transactions found for this date range']);
  } else {
    for (const entry of data.recentActivity) {
      appendRow(lines, [
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

  return new Response(`${lines.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${buildFilename(data)}"`
    }
  });
}
