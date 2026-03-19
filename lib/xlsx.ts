const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

type CellValue = string | number | null | undefined;

type SheetRow = CellValue[];

type SheetDefinition = {
  name: string;
  rows: SheetRow[];
  merges?: string[];
  freezePane?: string;
  autoFilter?: string;
  minColumnWidth?: number;
  rightAlignedColumns?: number[];
  metadataRows?: number[];
  titleRow?: number;
  sectionRows?: number[];
  tableHeaderRows?: number[];
  zebraRanges?: Array<{ startRow: number; endRow: number }>;
};

type ZipEntry = {
  name: string;
  data: Buffer;
  crc32: number;
  size: number;
  offset: number;
};

type SharedStrings = {
  values: string[];
  lookup: Map<string, number>;
};

const BORDER_STYLE = '<border><left style="thin"><color rgb="FFD9E2F3"/></left><right style="thin"><color rgb="FFD9E2F3"/></right><top style="thin"><color rgb="FFD9E2F3"/></top><bottom style="thin"><color rgb="FFD9E2F3"/></bottom><diagonal/></border>';

const STYLES = {
  base: 0,
  title: 1,
  section: 2,
  metadataLabel: 3,
  metadataValue: 4,
  tableHeader: 5,
  tableText: 6,
  tableNumber: 7,
  zebraText: 8,
  zebraNumber: 9
} as const;

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

function buildSharedStrings(sheets: SheetDefinition[]): SharedStrings {
  const values: string[] = [];
  const lookup = new Map<string, number>();

  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      for (const cell of row) {
        if (typeof cell !== 'string') continue;
        if (!lookup.has(cell)) {
          lookup.set(cell, values.length);
          values.push(cell);
        }
      }
    }
  }

  return { values, lookup };
}

function isRowInRanges(rowNumber: number, ranges?: Array<{ startRow: number; endRow: number }>) {
  return ranges?.some((range) => rowNumber >= range.startRow && rowNumber <= range.endRow) ?? false;
}

function styleIdForCell(sheet: SheetDefinition, rowNumber: number, columnIndex: number, cell: CellValue) {
  const rightAligned = sheet.rightAlignedColumns?.includes(columnIndex) ?? false;
  const zebra = isRowInRanges(rowNumber, sheet.zebraRanges) && rowNumber % 2 === 1;

  if (sheet.titleRow === rowNumber) {
    return STYLES.title;
  }

  if (sheet.sectionRows?.includes(rowNumber)) {
    return STYLES.section;
  }

  if (sheet.metadataRows?.includes(rowNumber)) {
    return columnIndex === 0 ? STYLES.metadataLabel : STYLES.metadataValue;
  }

  if (sheet.tableHeaderRows?.includes(rowNumber)) {
    return STYLES.tableHeader;
  }

  if (typeof cell === 'number' && Number.isFinite(cell)) {
    return zebra || rightAligned ? STYLES.zebraNumber : STYLES.tableNumber;
  }

  if (rightAligned) {
    return zebra ? STYLES.zebraNumber : STYLES.tableNumber;
  }

  return zebra ? STYLES.zebraText : STYLES.tableText;
}

function buildColumnsXml(sheet: SheetDefinition) {
  const maxColumns = Math.max(...sheet.rows.map((row) => row.length), 0);
  if (maxColumns === 0) {
    return '';
  }

  const minWidth = sheet.minColumnWidth ?? 12;
  const cols = Array.from({ length: maxColumns }, (_, columnIndex) => {
    const longest = sheet.rows.reduce((max, row) => {
      const cell = row[columnIndex];
      const length = cell == null ? 0 : String(cell).length;
      return Math.max(max, length);
    }, 0);
    const width = Math.max(minWidth, Math.min(longest + 2, 36));
    return `<col min="${columnIndex + 1}" max="${columnIndex + 1}" width="${width}" customWidth="1"/>`;
  }).join('');

  return `<cols>${cols}</cols>`;
}

function buildSheetXml(sheet: SheetDefinition, lookup: Map<string, number>) {
  const rowXml = sheet.rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cellXml = row
        .map((cell, columnIndex) => {
          if (cell == null || cell === '') {
            return '';
          }

          const reference = `${columnName(columnIndex)}${rowNumber}`;
          const styleId = styleIdForCell(sheet, rowNumber, columnIndex, cell);

          if (typeof cell === 'number' && Number.isFinite(cell)) {
            return `<c r="${reference}" s="${styleId}"><v>${cell}</v></c>`;
          }

          const sharedStringIndex = lookup.get(String(cell));
          return `<c r="${reference}" s="${styleId}" t="s"><v>${sharedStringIndex ?? 0}</v></c>`;
        })
        .join('');

      const customHeight = rowNumber === sheet.titleRow ? ' ht="24" customHeight="1"' : '';
      return `<row r="${rowNumber}"${customHeight}>${cellXml}</row>`;
    })
    .join('');

  const mergeCells = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((merge) => `<mergeCell ref="${merge}"/>`).join('')}</mergeCells>`
    : '';

  const sheetViews = sheet.freezePane
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${Number.parseInt(sheet.freezePane.replace(/^[A-Z]+/, ''), 10) - 1}" topLeftCell="${sheet.freezePane}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="${sheet.freezePane}" sqref="${sheet.freezePane}"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';

  const autoFilter = sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : '';

  return `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sheetViews}${buildColumnsXml(sheet)}<sheetData>${rowXml}</sheetData>${autoFilter}${mergeCells}</worksheet>`;
}

function buildSharedStringsXml(values: string[]) {
  const items = values.map((value) => `<si><t xml:space="preserve">${escapeXml(value)}</t></si>`).join('');
  return `${XML_HEADER}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${values.length}" uniqueCount="${values.length}">${items}</sst>`;
}

function buildStylesXml() {
  return `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="17"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="12"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F1"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDEEAF6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7FAFC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${BORDER_STYLE}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="6" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="6" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function buildContentTypesXml(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  return `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${sheets}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function buildRootRelsXml() {
  return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function buildWorkbookXml(sheets: SheetDefinition[]) {
  const sheetXml = sheets
    .map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('');
  return `${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetXml}</sheets></workbook>`;
}

function buildWorkbookRelsXml(sheets: SheetDefinition[]) {
  const sheetRelationships = sheets
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join('');
  const styleRelationshipId = sheets.length + 1;
  const sharedStringsRelationshipId = sheets.length + 2;
  return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRelationships}<Relationship Id="rId${styleRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sharedStringsRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
}

function buildCoreXml(now: string) {
  return `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>StockPilot Reports Export</dc:title><dc:creator>StockPilot Lite</dc:creator><cp:lastModifiedBy>StockPilot Lite</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function buildAppXml(sheetCount: number) {
  return `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>StockPilot Lite</Application><TitlesOfParts><vt:vector size="${sheetCount}" baseType="lpstr">${Array.from({ length: sheetCount }, (_, index) => `<vt:lpstr>Sheet${index + 1}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts></Properties>`;
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

export type { CellValue, SheetDefinition, SheetRow };

export function createWorkbookBuffer(sheets: SheetDefinition[]) {
  const { values, lookup } = buildSharedStrings(sheets);
  const now = new Date().toISOString();
  return createZip([
    { name: '[Content_Types].xml', content: buildContentTypesXml(sheets.length) },
    { name: '_rels/.rels', content: buildRootRelsXml() },
    { name: 'docProps/app.xml', content: buildAppXml(sheets.length) },
    { name: 'docProps/core.xml', content: buildCoreXml(now) },
    { name: 'xl/_rels/workbook.xml.rels', content: buildWorkbookRelsXml(sheets) },
    { name: 'xl/workbook.xml', content: buildWorkbookXml(sheets) },
    { name: 'xl/sharedStrings.xml', content: buildSharedStringsXml(values) },
    { name: 'xl/styles.xml', content: buildStylesXml() },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: buildSheetXml(sheet, lookup) }))
  ]);
}
