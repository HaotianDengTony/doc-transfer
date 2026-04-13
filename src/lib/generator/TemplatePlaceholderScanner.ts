import { NS } from '../parser/xmlUtils';
import type { TemplatePlaceholder, PlaceholderMapEntry } from './types';
import { PLACEHOLDER_MAP } from './templatePlaceholderMap';

/**
 * Scan the template document.xml DOM to find all placeholders and
 * resolve each to a placeholderId using the static PLACEHOLDER_MAP.
 *
 * Returns an array of TemplatePlaceholder objects in document order.
 */
export function scanTemplatePlaceholders(templateDoc: Document): TemplatePlaceholder[] {
  const body = templateDoc.getElementsByTagNameNS(NS.w, 'body')[0];
  if (!body) {
    throw new Error('No w:body found in template document.xml');
  }

  const placeholders: TemplatePlaceholder[] = [];

  // State: track current section and sub-section headers
  let currentSection = '';
  let currentSubSection = '';

  // Create a mutable copy of the map entries to consume in order
  const remainingEntries = [...PLACEHOLDER_MAP];
  // Track template table index
  let tableIndex = 0;

  // Walk all direct children of <w:body>
  const children = getDirectChildElements(body);

  for (const child of children) {
    const tag = child.localName;

    if (tag === 'p' && child.namespaceURI === NS.w) {
      const text = getParagraphText(child).trim();
      const style = getParagraphStyle(child);

      // Check if this is a section header (【...】 or heading style)
      if (isSectionHeader(text, style)) {
        currentSection = text;
        currentSubSection = '';
        continue;
      }

      // Check if this is a sub-section header
      if (isSubSectionHeader(text, style, child)) {
        currentSubSection = text;
        continue;
      }

      // Check for [xxx] placeholder
      if (text.includes('[xxx]')) {
        const isStandalone = text.replace(/\s/g, '') === '[xxx]';

        if (isStandalone) {
          // Find matching entry in the map
          const entry = findMatchingEntry(
            remainingEntries,
            'standalone',
            currentSection,
            currentSubSection,
          );
          if (entry) {
            placeholders.push({
              placeholderId: entry.placeholderId,
              type: 'standalone',
              element: child,
              parentBody: body,
            });
          }
        } else {
          // Inline: match by textPattern
          const entry = findMatchingInlineEntry(remainingEntries, text);
          if (entry) {
            placeholders.push({
              placeholderId: entry.placeholderId,
              type: 'inline',
              element: child,
              parentBody: body,
            });
          }
        }
        continue;
      }

      // Check for numeric xx placeholder (yellow highlighted)
      if (hasYellowHighlightedXx(child)) {
        const entry = findMatchingEntry(
          remainingEntries,
          'numeric',
          currentSection,
          currentSubSection,
          text,
        );
        if (entry) {
          placeholders.push({
            placeholderId: entry.placeholderId,
            type: 'numeric',
            element: child,
            parentBody: body,
          });
        }
        continue;
      }
    } else if (tag === 'tbl' && child.namespaceURI === NS.w) {
      // Check if this table should be wholly replaced
      const entry = findTableEntry(remainingEntries, tableIndex);
      if (entry) {
        placeholders.push({
          placeholderId: entry.placeholderId,
          type: 'table-whole',
          element: child,
          parentBody: body,
        });
      }
      tableIndex++;
    }
    // Skip other elements (bookmarkStart, bookmarkEnd, sectPr)
  }

  return placeholders;
}

/** Check if text represents a section header */
function isSectionHeader(text: string, style: string): boolean {
  // Section headers contain 【...】 and use heading styles (2, 45, 48)
  if (text.includes('【') && text.includes('】')) return true;
  // Also catch "标准化" which uses style 2 but no brackets
  if (style === '2' && !text.includes('[xxx]')) return true;
  return false;
}

/** Check if a paragraph is a sub-section header */
function isSubSectionHeader(text: string, style: string, element: Element): boolean {
  if (!text || text.includes('[xxx]')) return false;

  // Known sub-section labels
  const subLabels = [
    '摘要和解释', '试剂盒组成', '试剂组分', '需要而未提供的材料',
    '机载稳定性', '样本的采集', '样本的保存', '样本的运输', '样本的制备',
    '检测步骤', '试剂的准备', '系统的准备', '主曲线定义',
    '校准的执行', '校准频率', '校准品的制备', '校准程序',
    '执行质量控制', '采取纠正措施', '结果', '计算结果',
    '警告和注意事项',
  ];

  for (const label of subLabels) {
    if (text.includes(label)) return true;
  }

  // Also check for bold/italic/underline formatting (common for sub-headers)
  if (style === '45' || style === '48') return true;

  // Check if the paragraph has bold formatting
  if (hasBoldFormatting(element) && text.length < 20) return true;

  return false;
}

/** Check if a paragraph has bold formatting on its text runs */
function hasBoldFormatting(pElement: Element): boolean {
  const runs = pElement.getElementsByTagNameNS(NS.w, 'r');
  for (let i = 0; i < runs.length; i++) {
    const rPr = runs[i].getElementsByTagNameNS(NS.w, 'rPr')[0];
    if (rPr) {
      const bold = rPr.getElementsByTagNameNS(NS.w, 'b')[0];
      if (bold) return true;
    }
  }
  return false;
}

/** Check if a paragraph contains a yellow-highlighted "xx" text run */
function hasYellowHighlightedXx(pElement: Element): boolean {
  const runs = pElement.getElementsByTagNameNS(NS.w, 'r');
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const tElements = run.getElementsByTagNameNS(NS.w, 't');
    let runText = '';
    for (let j = 0; j < tElements.length; j++) {
      runText += tElements[j].textContent || '';
    }

    if (runText.trim() === 'xx') {
      // Check for yellow highlight
      const rPr = run.getElementsByTagNameNS(NS.w, 'rPr')[0];
      if (rPr) {
        const highlight = rPr.getElementsByTagNameNS(NS.w, 'highlight')[0];
        if (highlight) {
          const val = highlight.getAttributeNS(NS.w, 'val') || highlight.getAttribute('w:val');
          if (val === 'yellow') return true;
        }
      }
    }
  }
  return false;
}

/**
 * Find and consume a matching entry from the remaining map entries.
 * Uses section + sub-section context to match.
 */
function findMatchingEntry(
  entries: PlaceholderMapEntry[],
  type: string,
  currentSection: string,
  currentSubSection: string,
  paragraphText?: string,
): PlaceholderMapEntry | null {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.type !== type) continue;

    // Match section label
    if (entry.sectionLabel !== null) {
      if (!currentSection.includes(entry.sectionLabel)) continue;
    }

    // Match sub-section label
    if (entry.subLabel !== null) {
      if (!currentSubSection.includes(entry.subLabel)) continue;
    } else if (type === 'standalone' || type === 'numeric') {
      // For entries with subLabel=null: match if no sub-section is set
      // or if the sub-section doesn't match any other entry's subLabel
      // (this handles the "first [xxx] in a section" case)
    }

    // For numeric: also check textPattern against paragraph text
    if (type === 'numeric' && entry.textPattern && paragraphText) {
      if (!paragraphText.includes(entry.textPattern)) continue;
    }

    // Consume the entry (remove from list so it's not matched again)
    entries.splice(i, 1);
    return entry;
  }
  return null;
}

/** Find a matching inline entry by checking textPattern against paragraph text */
function findMatchingInlineEntry(
  entries: PlaceholderMapEntry[],
  paragraphText: string,
): PlaceholderMapEntry | null {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.type !== 'inline') continue;
    if (entry.textPattern && paragraphText.includes(entry.textPattern)) {
      entries.splice(i, 1);
      return entry;
    }
  }
  return null;
}

/** Find a table entry by template table index */
function findTableEntry(
  entries: PlaceholderMapEntry[],
  tableIndex: number,
): PlaceholderMapEntry | null {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.type === 'table-whole' && entry.tableIndex === tableIndex) {
      entries.splice(i, 1);
      return entry;
    }
  }
  return null;
}

/** Get direct child elements of a parent element */
function getDirectChildElements(parent: Element): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    if (parent.childNodes[i].nodeType === Node.ELEMENT_NODE) {
      result.push(parent.childNodes[i] as Element);
    }
  }
  return result;
}

/** Get all text content from a paragraph's runs */
function getParagraphText(pElement: Element): string {
  const texts: string[] = [];
  const tElements = pElement.getElementsByTagNameNS(NS.w, 't');
  for (let i = 0; i < tElements.length; i++) {
    texts.push(tElements[i].textContent || '');
  }
  return texts.join('');
}

/** Get the paragraph style value (e.g., "2", "45", "48") */
function getParagraphStyle(pElement: Element): string {
  const pPr = pElement.getElementsByTagNameNS(NS.w, 'pPr')[0];
  if (!pPr) return '';
  const pStyle = pPr.getElementsByTagNameNS(NS.w, 'pStyle')[0];
  if (!pStyle) return '';
  return pStyle.getAttributeNS(NS.w, 'val') || pStyle.getAttribute('w:val') || '';
}
