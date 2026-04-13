import type { ParsedTable, ParsedTableRow, ParsedTableCell, ImageRef } from '../docx/types';
import { NS, getFirstElement, getDirectChildren, getWVal, serializeElement } from './xmlUtils';
import { parseParagraph } from './ParagraphParser';

/**
 * Parse a <w:tbl> element into a ParsedTable.
 */
export function parseTable(
  tblElement: Element,
  bodyChildIndex: number,
  relIdToFileName: Map<string, string>,
): ParsedTable {
  const rows: ParsedTableRow[] = [];
  const trElements = getDirectChildren(tblElement, NS.w, 'tr');

  for (const trEl of trElements) {
    const row = parseTableRow(trEl, bodyChildIndex, relIdToFileName);
    rows.push(row);
  }

  return {
    bodyChildIndex,
    rows,
    rawXml: serializeElement(tblElement),
  };
}

function parseTableRow(
  trElement: Element,
  parentBodyIndex: number,
  relIdToFileName: Map<string, string>,
): ParsedTableRow {
  const cells: ParsedTableCell[] = [];
  const tcElements = getDirectChildren(trElement, NS.w, 'tc');

  for (const tcEl of tcElements) {
    const cell = parseTableCell(tcEl, parentBodyIndex, relIdToFileName);
    cells.push(cell);
  }

  return {
    cells,
    rawXml: serializeElement(trElement),
  };
}

function parseTableCell(
  tcElement: Element,
  parentBodyIndex: number,
  relIdToFileName: Map<string, string>,
): ParsedTableCell {
  // Parse cell properties
  const tcPr = getFirstElement(tcElement, NS.w, 'tcPr');
  let vMerge: 'restart' | 'continue' | null = null;
  let gridSpan = 1;

  if (tcPr) {
    // vMerge: <w:vMerge/> = continue, <w:vMerge w:val="restart"/> = restart
    const vMergeEl = getFirstElement(tcPr, NS.w, 'vMerge');
    if (vMergeEl) {
      const val = getWVal(vMergeEl);
      vMerge = val === 'restart' ? 'restart' : 'continue';
    }

    // gridSpan
    const gridSpanEl = getFirstElement(tcPr, NS.w, 'gridSpan');
    if (gridSpanEl) {
      const val = getWVal(gridSpanEl);
      if (val) gridSpan = parseInt(val, 10);
    }
  }

  // Parse paragraphs within cell
  const pElements = getDirectChildren(tcElement, NS.w, 'p');
  const paragraphs = pElements.map((pEl) =>
    parseParagraph(pEl, parentBodyIndex, relIdToFileName)
  );

  const text = paragraphs.map(p => p.text).join('\n');
  const images: ImageRef[] = paragraphs.flatMap(p => p.images);

  return {
    paragraphs,
    text,
    images,
    vMerge,
    gridSpan,
    rawXml: serializeElement(tcElement),
  };
}
