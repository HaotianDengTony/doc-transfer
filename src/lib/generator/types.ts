/**
 * Phase 2 types for template processing and document generation.
 */

/** How a placeholder should be replaced */
export type PlaceholderType = 'standalone' | 'inline' | 'numeric' | 'table-whole';

/** A placeholder found in the template document */
export interface TemplatePlaceholder {
  /** Maps to a MappingRule.placeholderId in mappingConfig.ts */
  placeholderId: string;
  /** Replacement strategy */
  type: PlaceholderType;
  /** The DOM element containing the placeholder:
   *  - standalone: the <w:p> element
   *  - inline: the <w:p> element (replacement targets the [xxx] run inside)
   *  - numeric: the <w:p> element
   *  - table-whole: the <w:tbl> element */
  element: Element;
  /** Reference to <w:body> for DOM manipulation */
  parentBody: Element;
}

/** Tracks an image transferred from source to output */
export interface ImageMapping {
  sourceRId: string;
  sourceFileName: string;
  outputFileName: string;
  outputRId: string;
}

/** An entry in the template placeholder map — defines how to identify a placeholder */
export interface PlaceholderMapEntry {
  /** The placeholderId this maps to (matches mappingConfig.ts) */
  placeholderId: string;
  /** Replacement type */
  type: PlaceholderType;
  /** Section header text that precedes this placeholder (e.g., '【预期用途】') */
  sectionLabel: string | null;
  /** Sub-section label text (e.g., '摘要和解释', '机载稳定性') */
  subLabel: string | null;
  /** For inline placeholders: the surrounding text pattern to match */
  textPattern?: string;
  /** For table-whole: which template table (0-based index among tables in w:body) */
  tableIndex?: number;
}
