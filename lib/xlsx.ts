const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

type CellValue = string | number | null | undefined;
type SheetRow = CellValue[];

type ZipEntry = {
  name: string;
  data: Buffer;
  crc32: number;
  size: number;
  offset: number;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number) {
  let current = index + 1;
  let result = '';

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

function buildSharedStrings(rows: SheetRow[]) {
  const values: string[] = [];
  const lookup = new Map<string, number>();

  for (const row of rows) {
    for (const cell of row) {
      if (typeof cell !== 'string') continue;
      if (!lookup.has(cell)) {
        lookup.set(cell, values.length);
        values.push(cell);
      }
    }
  }

  return { values, lookup };
}

function buildSheetXml(rows: SheetRow[], lookup: Map<string, number>) {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cellXml = row
        .map((cell, columnIndex) => {
          if (cell == null || cell === '') {
            return '';
          }

          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;

          if (typeof cell === 'number' && Number.isFinite(cell)) {
            return `<c r="${reference}"><v>${cell}</v></c>`;
          }

          const sharedStringIndex = lookup.get(String(cell));
          return `<c r="${reference}" t="s"><v>${sharedStringIndex ?? 0}</v></c>`;
        })
        .join('');

      return `<row r="${rowIndex + 1}">${cellXml}</row>`;
    })
    .join('');

  return `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
}

function buildSharedStringsXml(values: string[]) {
  const items = values.map((value) => `<si><t xml:space="preserve">${escapeXml(value)}</t></si>`).join('');
  return `${XML_HEADER}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${values.length}" uniqueCount="${values.length}">${items}</sst>`;
}

function buildContentTypesXml() {
  return `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function buildRootRelsXml() {
  return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function buildWorkbookXml(sheetName: string) {
  return `${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

function buildWorkbookRelsXml() {
  return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
}

function buildCoreXml(now: string) {
  return `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>StockPilot Reports Export</dc:title><dc:creator>StockPilot Lite</dc:creator><cp:lastModifiedBy>StockPilot Lite</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function buildAppXml() {
  return `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>StockPilot Lite</Application></Properties>`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entriesInput: Array<{ name: string; content: string }>) {
  const fileEntries: ZipEntry[] = [];
  let offset = 0;

  const localFiles = entriesInput.map(({ name, content }) => {
    const data = Buffer.from(content, 'utf8');
    const nameBuffer = Buffer.from(name, 'utf8');
    const size = data.length;
    const crc = crc32(data);

    const header = Buffer.alloc(30 + nameBuffer.length);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(size, 18);
    header.writeUInt32LE(size, 22);
    header.writeUInt16LE(nameBuffer.length, 26);
    header.writeUInt16LE(0, 28);
    nameBuffer.copy(header, 30);

    fileEntries.push({ name, data, crc32: crc, size, offset });
    offset += header.length + size;
    return Buffer.concat([header, data]);
  });

  const centralDirectory = fileEntries.map((entry) => {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const header = Buffer.alloc(46 + nameBuffer.length);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    header.writeUInt32LE(entry.crc32, 16);
    header.writeUInt32LE(entry.size, 20);
    header.writeUInt32LE(entry.size, 24);
    header.writeUInt16LE(nameBuffer.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(entry.offset, 42);
    nameBuffer.copy(header, 46);
    return header;
  });

  const centralDirectoryBuffer = Buffer.concat(centralDirectory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(fileEntries.length, 8);
  end.writeUInt16LE(fileEntries.length, 10);
  end.writeUInt32LE(centralDirectoryBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localFiles, centralDirectoryBuffer, end]);
}

export function createWorkbookBuffer(sheetName: string, rows: SheetRow[]) {
  const { values, lookup } = buildSharedStrings(rows);
  const now = new Date().toISOString();
  return createZip([
    { name: '[Content_Types].xml', content: buildContentTypesXml() },
    { name: '_rels/.rels', content: buildRootRelsXml() },
    { name: 'docProps/app.xml', content: buildAppXml() },
    { name: 'docProps/core.xml', content: buildCoreXml(now) },
    { name: 'xl/_rels/workbook.xml.rels', content: buildWorkbookRelsXml() },
    { name: 'xl/workbook.xml', content: buildWorkbookXml(sheetName) },
    { name: 'xl/sharedStrings.xml', content: buildSharedStringsXml(values) },
    { name: 'xl/worksheets/sheet1.xml', content: buildSheetXml(rows, lookup) }
  ]);
}
