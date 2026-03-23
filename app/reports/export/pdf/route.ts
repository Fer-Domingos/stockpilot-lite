import { getReportsData } from "@/app/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeReversalFilter(value: string | null) {
  return value === "include" || value === "only" || value === "exclude"
    ? value
    : undefined;
}

type ReportsData = Awaited<ReturnType<typeof getReportsData>>["data"];

type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  gapBefore?: number;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildFilename(data: ReportsData) {
  const today = new Date().toISOString().slice(0, 10);

  if (data.reportMetadata.selectedJob && data.reportMetadata.selectedMaterial) {
    return `stockpilot-report-job-material-${today}.pdf`;
  }

  if (data.reportMetadata.selectedJob) {
    return `stockpilot-report-job-${slugify(data.reportMetadata.selectedJob.number)}-${today}.pdf`;
  }

  if (data.reportMetadata.selectedMaterial) {
    return `stockpilot-report-material-${slugify(data.reportMetadata.selectedMaterial.sku)}-${today}.pdf`;
  }

  return `stockpilot-report-general-${today}.pdf`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "All time";
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function wrapText(text: string, maxChars: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [""];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }

      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function pushWrappedLine(
  lines: PdfLine[],
  text: string,
  options: Omit<PdfLine, "text"> = {},
  maxChars = 92,
) {
  const wrapped = wrapText(text, maxChars);
  wrapped.forEach((entry, index) => {
    lines.push({
      text: entry,
      size: options.size,
      bold: options.bold,
      gapBefore: index === 0 ? options.gapBefore : 0,
    });
  });
}

function pad(value: string, width: number, align: "left" | "right" = "left") {
  if (value.length >= width) {
    return value.slice(0, width - 1).trimEnd() + "…";
  }

  return align === "right"
    ? value.padStart(width, " ")
    : value.padEnd(width, " ");
}

function tableRow(
  columns: Array<{ value: string; width: number; align?: "left" | "right" }>,
) {
  return columns
    .map((column) => pad(column.value, column.width, column.align))
    .join(" | ");
}

function buildReportLines(data: ReportsData) {
  const lines: PdfLine[] = [];
  const generatedAt = new Date().toISOString();

  lines.push({ text: "StockPilot Reports Export", size: 18, bold: true });
  pushWrappedLine(
    lines,
    `Generated: ${formatDateTime(generatedAt)} UTC`,
    { size: 10, gapBefore: 4 },
    100,
  );

  lines.push({ text: "Report Metadata", size: 14, bold: true, gapBefore: 14 });
  pushWrappedLine(lines, `Mode: ${data.reportMetadata.mode}`);
  pushWrappedLine(lines, `Start Date: ${formatDate(data.filters.startDate)}`);
  pushWrappedLine(lines, `End Date: ${formatDate(data.filters.endDate)}`);
  pushWrappedLine(
    lines,
    `Selected Job: ${data.reportMetadata.selectedJob ? `${data.reportMetadata.selectedJob.number} — ${data.reportMetadata.selectedJob.name}` : "All jobs"}`,
  );
  pushWrappedLine(
    lines,
    `Selected Material: ${data.reportMetadata.selectedMaterial ? `${data.reportMetadata.selectedMaterial.sku} — ${data.reportMetadata.selectedMaterial.name}` : "All materials"}`,
  );
  pushWrappedLine(lines, `Reversals: ${data.filters.reversalFilter}`);

  lines.push({ text: "Summary Cards", size: 14, bold: true, gapBefore: 14 });
  pushWrappedLine(
    lines,
    `Materials tracked: ${data.inventorySummary.materialCount}`,
  );
  pushWrappedLine(
    lines,
    `Transactions in range: ${data.activitySummary.totalTransactions}`,
  );
  pushWrappedLine(
    lines,
    `Issued units in range: ${data.activitySummary.issueQuantity}`,
  );
  pushWrappedLine(
    lines,
    `Receipts in range: ${data.activitySummary.receiveQuantity}`,
  );
  pushWrappedLine(
    lines,
    `Reversals in range: ${data.activitySummary.reversalCount}`,
  );

  lines.push({
    text: "Total Inventory by Material",
    size: 14,
    bold: true,
    gapBefore: 14,
  });
  lines.push({
    text: tableRow([
      { value: "Material", width: 24 },
      { value: "SKU", width: 14 },
      { value: "Unit", width: 8 },
      { value: "Shop", width: 8, align: "right" },
      { value: "Jobs", width: 8, align: "right" },
      { value: "Total", width: 8, align: "right" },
    ]),
    bold: true,
    size: 10,
    gapBefore: 4,
  });
  lines.push({ text: "-".repeat(87), size: 10 });
  if (data.inventorySummary.rows.length === 0) {
    pushWrappedLine(lines, "No inventory balances found.", { size: 10 });
  } else {
    data.inventorySummary.rows.forEach((row) => {
      lines.push({
        text: tableRow([
          { value: row.materialName, width: 24 },
          { value: row.materialSku, width: 14 },
          { value: row.unit, width: 8 },
          { value: String(row.shopQuantity), width: 8, align: "right" },
          { value: String(row.totalJobQuantity), width: 8, align: "right" },
          { value: String(row.totalQuantity), width: 8, align: "right" },
        ]),
        size: 10,
      });
    });
  }

  lines.push({
    text: "Most Used Materials",
    size: 14,
    bold: true,
    gapBefore: 14,
  });
  lines.push({
    text: tableRow([
      { value: "Material", width: 28 },
      { value: "SKU", width: 14 },
      { value: "Issues", width: 8, align: "right" },
      { value: "Total Used", width: 12, align: "right" },
      { value: "Unit", width: 8 },
    ]),
    bold: true,
    size: 10,
    gapBefore: 4,
  });
  lines.push({ text: "-".repeat(82), size: 10 });
  if (data.topMaterials.length === 0) {
    pushWrappedLine(lines, "No issue activity found for this date range.", {
      size: 10,
    });
  } else {
    data.topMaterials.forEach((row) => {
      lines.push({
        text: tableRow([
          { value: row.materialName, width: 28 },
          { value: row.materialSku, width: 14 },
          { value: String(row.issueCount), width: 8, align: "right" },
          { value: String(row.issuedQuantity), width: 12, align: "right" },
          { value: row.unit, width: 8 },
        ]),
        size: 10,
      });
    });
  }

  lines.push({
    text: "Reversal Activity",
    size: 14,
    bold: true,
    gapBefore: 14,
  });
  if (data.reversalActivity.length === 0) {
    pushWrappedLine(lines, "No reversal activity found for this filter.", {
      size: 10,
      gapBefore: 4,
    });
  } else {
    data.reversalActivity.forEach((entry, index) => {
      lines.push({
        text: `Reversal ${index + 1}`,
        size: 11,
        bold: true,
        gapBefore: index === 0 ? 4 : 10,
      });
      pushWrappedLine(lines, `Date: ${formatDateTime(entry.reversedAt ?? entry.createdAt)} UTC`, {
        size: 10,
      });
      pushWrappedLine(lines, `Original Transaction ID: ${entry.originalTransactionId ?? "—"}`, { size: 10 });
      pushWrappedLine(lines, `Type: ${entry.transactionType}`, { size: 10 });
      pushWrappedLine(lines, `Material: ${entry.materialName} (${entry.materialSku})`, {
        size: 10,
      });
      pushWrappedLine(lines, `Quantity: ${entry.quantity} ${entry.unit}`, {
        size: 10,
      });
      pushWrappedLine(lines, `Reason: ${entry.reversalReason}`, { size: 10 }, 96);
      pushWrappedLine(lines, `Reversed By: ${entry.reversedByEmail}`, { size: 10 });
    });
  }

  lines.push({
    text: "Recent Activity Table",
    size: 14,
    bold: true,
    gapBefore: 14,
  });
  if (data.recentActivity.length === 0) {
    pushWrappedLine(
      lines,
      "No recent transactions found for this date range.",
      { size: 10, gapBefore: 4 },
    );
  } else {
    data.recentActivity.forEach((entry, index) => {
      lines.push({
        text: `Activity ${index + 1}`,
        size: 11,
        bold: true,
        gapBefore: index === 0 ? 4 : 10,
      });
      pushWrappedLine(lines, `Date: ${formatDateTime(entry.createdAt)} UTC`, {
        size: 10,
      });
      pushWrappedLine(lines, `Type: ${entry.type}`, { size: 10 });
      pushWrappedLine(
        lines,
        `Material: ${entry.materialName} (${entry.materialSku})`,
        { size: 10 },
      );
      pushWrappedLine(lines, `Quantity: ${entry.quantity} ${entry.unit}`, {
        size: 10,
      });
      pushWrappedLine(lines, `From: ${entry.locationFrom}`, { size: 10 });
      pushWrappedLine(lines, `To: ${entry.locationTo}`, { size: 10 });
      pushWrappedLine(lines, `Invoice: ${entry.invoiceNumber}`, { size: 10 });
      pushWrappedLine(lines, `Vendor: ${entry.vendorName}`, { size: 10 });
      pushWrappedLine(lines, `Notes: ${entry.notes}`, { size: 10 }, 96);
    });
  }

  return lines;
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPdfBuffer(lines: PdfLine[]) {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 48;
  const marginTop = 50;
  const marginBottom = 48;
  const defaultFontSize = 10;
  const defaultLeading = 14;

  const pages: string[] = [];
  let pageCommands = "";
  let y = pageHeight - marginTop;

  const flushPage = () => {
    if (pageCommands) {
      pages.push(pageCommands);
      pageCommands = "";
    }
    y = pageHeight - marginTop;
  };

  for (const line of lines) {
    const fontSize = line.size ?? defaultFontSize;
    const leading = Math.max(defaultLeading, Math.round(fontSize * 1.45));
    y -= line.gapBefore ?? 0;

    if (y - leading < marginBottom) {
      flushPage();
    }

    const fontName = line.bold ? "/F2" : "/F1";
    const safeText = escapePdfText(line.text);
    pageCommands += "BT\n";
    pageCommands += `${fontName} ${fontSize} Tf\n`;
    pageCommands += `1 0 0 1 ${marginX} ${y} Tm\n`;
    pageCommands += `(${safeText}) Tj\n`;
    pageCommands += "ET\n";
    y -= leading;
  }

  flushPage();

  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  const fontRegularId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  );
  const fontBoldId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>",
  );
  const pageIds: number[] = [];

  for (const pageContent of pages) {
    const streamId = addObject(
      `<< /Length ${Buffer.byteLength(pageContent, "utf8")} >>\nstream\n${pageContent}endstream`,
    );
    const pageId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${streamId} 0 R >>`,
    );
    pageIds.push(pageId);
  }

  const pagesId = addObject(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  );

  pageIds.forEach((pageId) => {
    objects[pageId - 1] = objects[pageId - 1].replace(
      "/Parent 0 0 R",
      `/Parent ${pagesId} 0 R`,
    );
  });

  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
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

  const pdf = buildPdfBuffer(buildReportLines(data));

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildFilename(data)}"`,
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
