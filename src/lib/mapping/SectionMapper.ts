import type { ParsedDocument, MappedContent, MappingResult, MappingRule, BodyChild, ParsedParagraph } from '../docx/types';
import { MAPPING_RULES } from './mappingConfig';
import { findSection, findSectionAnywhere, getSectionContentExcluding } from '../parser/SectionTreeBuilder';

/**
 * Execute all mapping rules against a parsed source document.
 * Returns a MappingResult with content for each template placeholder.
 */
export function mapSections(parsedDocument: ParsedDocument): MappingResult {
  const mappings = new Map<string, MappedContent>();
  const warnings: string[] = [];
  const unmappedPlaceholders: string[] = [];

  for (const rule of MAPPING_RULES) {
    const result = executeRule(rule, parsedDocument, warnings);
    if (result) {
      mappings.set(rule.placeholderId, result);
    } else {
      unmappedPlaceholders.push(rule.placeholderId);
    }
  }

  return { mappings, warnings, unmappedPlaceholders };
}

function executeRule(
  rule: MappingRule,
  doc: ParsedDocument,
  warnings: string[],
): MappedContent | null {
  switch (rule.sourceType) {
    case 'productInfo':
      return handleProductInfo(rule, doc);
    case 'section':
      return handleSection(rule, doc, warnings);
    case 'table':
      return handleTable(rule, doc, warnings);
    case 'manual':
      return handleManual(rule);
    case 'delete':
      return handleDelete(rule);
    default:
      warnings.push(`Unknown source type for ${rule.placeholderId}`);
      return null;
  }
}

function handleProductInfo(rule: MappingRule, doc: ParsedDocument): MappedContent {
  const field = rule.productInfoField!;
  const value = doc.productInfo[field];

  return {
    placeholderId: rule.placeholderId,
    sourceDescription: `ProductInfo.${field}`,
    bodyChildren: [],
    rawXmlFragments: [],
    plainText: value || '',
    requiresManualInput: false,
  };
}

function handleSection(
  rule: MappingRule,
  doc: ParsedDocument,
  warnings: string[],
): MappedContent | null {
  const paths = rule.sectionPaths!;

  // Try each candidate path in order
  let section = null;
  let matchedPath: string[] | null = null;
  for (const path of paths) {
    section = findSection(doc.sectionTree, path);
    if (section) { matchedPath = path; break; }
  }

  // Flat fallback: search anywhere in the tree for the last segment of the first path
  if (!section) {
    const fallbackName = paths[0][paths[0].length - 1];
    section = findSectionAnywhere(doc.sectionTree, fallbackName);
    if (section) {
      warnings.push(`Section '${fallbackName}' found via flat fallback (for ${rule.placeholderId})`);
      matchedPath = [fallbackName];
    }
  }

  if (!section) {
    warnings.push(`Section not found: ${paths.map(p => p.join(' → ')).join(' | ')} (for ${rule.placeholderId})`);
    return null;
  }

  let content: BodyChild[];

  // Special handling for performance section: exclude 标准化
  if (rule.placeholderId === 'performance') {
    content = getSectionContentExcluding(section, ['标准化']);
  } else if (rule.contentFilter === 'bodyOnly') {
    content = section.bodyContent;
  } else {
    content = section.allContent;
  }

  const plainText = content
    .map((c) => {
      if (c.type === 'paragraph') return c.data.text;
      if (c.type === 'table') return '[TABLE]';
      return '';
    })
    .filter(Boolean)
    .join('\n');

  const rawXmlFragments = content.map((c) => {
    if (c.type === 'paragraph') return c.data.rawXml;
    if (c.type === 'table') return c.data.rawXml;
    return '';
  });

  return {
    placeholderId: rule.placeholderId,
    sourceDescription: `Section: ${matchedPath!.join(' → ')}`,
    bodyChildren: content,
    rawXmlFragments,
    plainText,
    requiresManualInput: false,
  };
}

function handleTable(
  rule: MappingRule,
  doc: ParsedDocument,
  warnings: string[],
): MappedContent | null {
  const tableIndex = rule.tableIndex!;

  if (tableIndex >= doc.tables.length) {
    warnings.push(`Table index ${tableIndex} out of range (${doc.tables.length} tables) for ${rule.placeholderId}`);
    return null;
  }

  const table = doc.tables[tableIndex];

  // Special extraction: test count from kit contents table
  if (rule.extractionRule === 'testCount') {
    return extractTestCount(rule, table, doc);
  }

  // Reagent component table: restructure col0 into 2-column output table
  if (rule.extractionRule === 'reagentTableRestructure') {
    return buildReagentTableContent(rule, doc);
  }

  // Default: return the entire table
  const plainText = table.rows
    .map((row) => row.cells.map((c) => c.text).join(' | '))
    .join('\n');

  return {
    placeholderId: rule.placeholderId,
    sourceDescription: `Table ${tableIndex}`,
    bodyChildren: [{ type: 'table', data: table }],
    rawXmlFragments: [table.rawXml],
    plainText,
    requiresManualInput: false,
  };
}

/**
 * Extract test count from the kit contents table.
 * Also uses ProductInfo.testCount as a fallback.
 */
function extractTestCount(
  rule: MappingRule,
  table: import('../docx/types').ParsedTable,
  doc: ParsedDocument,
): MappedContent {
  // Try to find "检测次数" or a number like "100" in the table
  let testCount = '';

  for (const row of table.rows) {
    for (const cell of row.cells) {
      const match = cell.text.match(/(\d+)\s*(?:次测试|测试|Tests)/i);
      if (match) {
        testCount = match[1];
        break;
      }
    }
    if (testCount) break;
  }

  // Fallback to ProductInfo
  if (!testCount && doc.productInfo.testCount) {
    testCount = doc.productInfo.testCount;
  }

  return {
    placeholderId: rule.placeholderId,
    sourceDescription: `Table ${rule.tableIndex} → test count`,
    bodyChildren: [],
    rawXmlFragments: [],
    plainText: testCount,
    requiresManualInput: false,
  };
}

function handleManual(rule: MappingRule): MappedContent {
  return {
    placeholderId: rule.placeholderId,
    sourceDescription: `Manual input: ${rule.manualInputLabel}`,
    bodyChildren: [],
    rawXmlFragments: [],
    plainText: '',
    requiresManualInput: true,
  };
}

/**
 * Return a "delete" content signal — the placeholder element will be removed
 * from the output document entirely.
 */
function handleDelete(rule: MappingRule): MappedContent {
  return {
    placeholderId: rule.placeholderId,
    sourceDescription: 'delete',
    bodyChildren: [],
    rawXmlFragments: [],
    plainText: '',
    requiresManualInput: false,
    shouldDelete: true,
  };
}

// ============================================================
// Reagent Component Table Restructuring
// ============================================================

/**
 * Build a 2-column reagent component table from source Tables 0 and 1.
 *
 * Source Table 0 (reagent storage/stability) — col 0 only (材料描述):
 *   Bold rows   → component names  → output col 0
 *   Non-bold rows → descriptions  → output col 1
 *   A new output row starts when a bold row appears after accumulated descriptions.
 *
 * Source Table 1 (calibrator) is appended as additional rows using the same rule.
 */
function buildReagentTableContent(rule: MappingRule, doc: ParsedDocument): MappedContent {
  const tableXml = buildReagentComponentTable(doc);
  return {
    placeholderId: rule.placeholderId,
    sourceDescription: 'Reagent component table (restructured from source Tables 0+1)',
    bodyChildren: [],
    rawXmlFragments: [tableXml],
    plainText: '[REAGENT TABLE]',
    requiresManualInput: false,
  };
}

interface RowGroup {
  col0Paras: ParsedParagraph[];
  col1Paras: ParsedParagraph[];
}

function buildReagentComponentTable(doc: ParsedDocument): string {
  // Process both Table 0 (reagents) and Table 1 (calibrators)
  const sourceTables = [doc.tables[0], doc.tables[1]].filter(Boolean);

  const groups: RowGroup[] = [];
  let current: RowGroup = { col0Paras: [], col1Paras: [] };

  for (const table of sourceTables) {
    // Skip header row (index 0, which has "材料描述")
    for (let ri = 1; ri < table.rows.length; ri++) {
      const row = table.rows[ri];
      if (row.cells.length === 0) continue;

      const cell0 = row.cells[0];
      const nonEmptyParas = cell0.paragraphs.filter(p => p.text.trim() !== '');
      if (nonEmptyParas.length === 0) continue; // skip fully empty rows

      // A row is "bold" if any of its non-empty paragraphs contains a bold run
      const isBold = nonEmptyParas.some(p => p.runs.some(r => r.bold));

      if (isBold) {
        // Flush the current group when we have accumulated descriptions (col1 content)
        if (current.col1Paras.length > 0) {
          groups.push(current);
          current = { col0Paras: [], col1Paras: [] };
        }
        current.col0Paras.push(...nonEmptyParas);
      } else {
        current.col1Paras.push(...nonEmptyParas);
      }
    }
  }

  // Flush final group
  if (current.col0Paras.length > 0 || current.col1Paras.length > 0) {
    groups.push(current);
  }

  // Build table XML
  const headerRow = buildTableRowXml(
    `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>材料描述</w:t></w:r></w:p>`,
    `<w:p/>`,
    true,
  );

  const contentRows = groups.map(group => {
    const col0Xml = group.col0Paras.map(buildCleanParaXml).join('') || '<w:p/>';
    const col1Xml = group.col1Paras.map(buildCleanParaXml).join('') || '<w:p/>';
    return buildTableRowXml(col0Xml, col1Xml, false);
  });

  return [
    '<w:tbl>',
    '<w:tblPr>',
    '<w:tblW w:w="5000" w:type="pct"/>',
    '<w:tblBorders>',
    '<w:top w:val="single" w:color="auto" w:sz="4" w:space="0"/>',
    '<w:left w:val="single" w:color="auto" w:sz="4" w:space="0"/>',
    '<w:bottom w:val="single" w:color="auto" w:sz="4" w:space="0"/>',
    '<w:right w:val="single" w:color="auto" w:sz="4" w:space="0"/>',
    '<w:insideH w:val="single" w:color="auto" w:sz="4" w:space="0"/>',
    '<w:insideV w:val="single" w:color="auto" w:sz="4" w:space="0"/>',
    '</w:tblBorders>',
    '<w:tblLayout w:type="autofit"/>',
    '</w:tblPr>',
    '<w:tblGrid>',
    '<w:gridCol w:w="5501"/>',
    '<w:gridCol w:w="4589"/>',
    '</w:tblGrid>',
    headerRow,
    ...contentRows,
    '</w:tbl>',
  ].join('');
}

/** Build a single 2-column table row XML. */
function buildTableRowXml(col0Xml: string, col1Xml: string, isHeader: boolean): string {
  const shading = isHeader
    ? ''
    : '<w:shd w:val="clear" w:color="auto" w:fill="F1F1F1"/>';
  return (
    '<w:tr>' +
    `<w:tc><w:tcPr><w:tcW w:w="2726" w:type="pct"/>${shading}</w:tcPr>${col0Xml}</w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="2274" w:type="pct"/>${shading}</w:tcPr>${col1Xml}</w:tc>` +
    '</w:tr>'
  );
}

/**
 * Build a clean OOXML paragraph from a ParsedParagraph.
 * Preserves bold, italic, superscript, subscript formatting but strips
 * source-specific styles, fonts, and sizes so the template's table style governs.
 */
function buildCleanParaXml(para: ParsedParagraph): string {
  const runXmls = para.runs
    .filter(r => r.text)
    .map(run => {
      const rPrParts: string[] = [];
      if (run.bold) rPrParts.push('<w:b/>');
      if (run.italic) rPrParts.push('<w:i/>');
      if (run.superscript) rPrParts.push('<w:vertAlign w:val="superscript"/>');
      if (run.subscript) rPrParts.push('<w:vertAlign w:val="subscript"/>');

      const rPrXml = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join('')}</w:rPr>` : '';
      const textXml = escapeXml(run.text);
      // Preserve leading/trailing spaces so "10.0 mL/试剂包" spacing is not collapsed
      const needsPreserve = run.text !== run.text.trim();
      const tAttr = needsPreserve ? ' xml:space="preserve"' : '';

      return `<w:r>${rPrXml}<w:t${tAttr}>${textXml}</w:t></w:r>`;
    });

  if (runXmls.length === 0) return '<w:p/>';
  return `<w:p>${runXmls.join('')}</w:p>`;
}

/** Escape special XML characters in text content. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
