import { inflateRawSync } from "node:zlib";

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function findEndOfCentralDirectoryOffset(buffer: Buffer) {
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      return index;
    }
  }

  return -1;
}

function readZipEntries(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  const eocdOffset = findEndOfCentralDirectoryOffset(buffer);
  if (eocdOffset < 0) {
    throw new Error("Invalid .xlsx file: could not locate zip directory.");
  }

  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);

  let cursor = centralDirectoryOffset;
  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Invalid .xlsx file: malformed zip central directory.");
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraFieldLength = buffer.readUInt16LE(cursor + 30);
    const fileCommentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer
      .subarray(cursor + 46, cursor + 46 + fileNameLength)
      .toString("utf8");

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error("Invalid .xlsx file: malformed local zip header.");
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

    let data: Buffer;
    if (compressionMethod === 0) {
      data = compressedData;
    } else if (compressionMethod === 8) {
      data = inflateRawSync(compressedData);
    } else {
      throw new Error(`Unsupported zip compression method: ${compressionMethod}`);
    }

    entries.set(fileName, data);
    cursor += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function parseSharedStrings(xml: string) {
  const strings: string[] = [];
  const sharedStringRegex = /<si[\s\S]*?<\/si>/g;

  for (const sharedItem of xml.match(sharedStringRegex) ?? []) {
    const textNodes = [...sharedItem.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)];
    const value = textNodes.map((node) => decodeXmlEntities(node[1] ?? "")).join("");
    strings.push(value);
  }

  return strings;
}

function cellRefToColumnIndex(reference: string) {
  const letters = reference.match(/[A-Z]+/)?.[0] ?? "";
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return Math.max(0, index - 1);
}

function parseCellValue(cellXml: string, sharedStrings: string[]) {
  const type = cellXml.match(/\bt="([^"]+)"/)?.[1] ?? "";

  if (type === "inlineStr") {
    const inlineText = cellXml.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/)?.[1] ?? "";
    return decodeXmlEntities(inlineText);
  }

  const rawValue = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  if (type === "s") {
    const sharedIndex = Number.parseInt(rawValue, 10);
    return Number.isNaN(sharedIndex) ? "" : (sharedStrings[sharedIndex] ?? "");
  }

  return decodeXmlEntities(rawValue);
}

function parseSheetRows(xml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  const rowMatches = xml.match(/<row[\s\S]*?<\/row>/g) ?? [];

  for (const rowXml of rowMatches) {
    const rowValues: string[] = [];
    const cellMatches = rowXml.match(/<c[\s\S]*?<\/c>/g) ?? [];

    for (const cellXml of cellMatches) {
      const reference = cellXml.match(/\br="([A-Z]+\d+)"/)?.[1] ?? "";
      const columnIndex = reference ? cellRefToColumnIndex(reference) : rowValues.length;
      rowValues[columnIndex] = parseCellValue(cellXml, sharedStrings).trim();
    }

    rows.push(rowValues);
  }

  return rows;
}

function findFirstWorksheetPath(entries: Map<string, Buffer>) {
  const workbookXml = entries.get("xl/workbook.xml")?.toString("utf8");
  if (!workbookXml) {
    return "xl/worksheets/sheet1.xml";
  }

  const firstSheetRid = workbookXml.match(/<sheet[^>]*\br:id="([^"]+)"/)?.[1];
  if (!firstSheetRid) {
    return "xl/worksheets/sheet1.xml";
  }

  const relsXml = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (!relsXml) {
    return "xl/worksheets/sheet1.xml";
  }

  const relRegex = new RegExp(
    `<Relationship[^>]*Id="${firstSheetRid}"[^>]*Target="([^"]+)"`,
  );
  const target = relsXml.match(relRegex)?.[1];
  if (!target) {
    return "xl/worksheets/sheet1.xml";
  }

  return `xl/${target.replace(/^\/?xl\//, "")}`;
}

export function parseXlsxRows(buffer: Buffer): Array<Record<string, string>> {
  const entries = readZipEntries(buffer);
  const sharedStringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];

  const worksheetPath = findFirstWorksheetPath(entries);
  const worksheetXml = entries.get(worksheetPath)?.toString("utf8");
  if (!worksheetXml) {
    throw new Error("Unable to locate worksheet data in uploaded file.");
  }

  const rows = parseSheetRows(worksheetXml, sharedStrings);
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  const dataRows = rows.slice(1);
  return dataRows
    .map((row) => {
      const mapped: Record<string, string> = {};
      for (const [index, header] of headers.entries()) {
        if (!header) continue;
        mapped[header] = (row[index] ?? "").trim();
      }
      return mapped;
    })
    .filter((row) => Object.values(row).some((value) => value !== ""));
}
