import type { ParsedDocument, MappedContent, MappingResult, MappingRule, BodyChild } from '../docx/types';
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
