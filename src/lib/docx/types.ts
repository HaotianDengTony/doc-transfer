// ===== Raw DOCX Layer =====

/** Raw contents extracted from a .docx ZIP file */
export interface DocxArchive {
  documentXml: string;
  relationshipsXml: string;
  numberingXml: string | null;
  stylesXml: string | null;
  mediaFiles: Map<string, Uint8Array>; // e.g. "image1.png" → binary
  contentTypesXml: string;
  /** All other XML files in the archive, keyed by path */
  otherFiles: Map<string, Uint8Array>;
}

/** A relationship entry from document.xml.rels */
export interface Relationship {
  id: string;          // e.g. "rId5"
  type: string;        // e.g. "http://...relationships/image"
  target: string;      // e.g. "media/image1.png"
  targetMode?: string; // "External" for hyperlinks
}

// ===== Parsed Document Layer =====

/** A single text run within a paragraph */
export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  color?: string;      // hex color, e.g. "FF0000"
  fontSize?: number;   // half-points
  fontFamily?: string;
}

/** An image reference within a paragraph or table cell */
export interface ImageRef {
  relationshipId: string; // e.g. "rId53"
  fileName: string;       // e.g. "image46.png" (resolved from rels)
  widthEmu?: number;
  heightEmu?: number;
}

export type ParagraphStyle =
  | 'Heading1' | 'Heading2' | 'Heading3' | 'Heading4'
  | 'BodyText' | 'ListParagraph' | 'Normal' | 'TableParagraph'
  | string;

export interface ListInfo {
  numId: number;
  level: number; // ilvl: 0 = top level
}

/** Represents a parsed paragraph */
export interface ParsedParagraph {
  bodyChildIndex: number;
  style: ParagraphStyle;
  headingLevel: number | null; // 1-4 for headings, null otherwise
  runs: TextRun[];
  text: string;            // concatenated plain text
  images: ImageRef[];
  listInfo: ListInfo | null;
  rawXml: string;          // original <w:p>...</w:p> XML for Phase 2
}

/** A single table cell */
export interface ParsedTableCell {
  paragraphs: ParsedParagraph[];
  text: string;            // concatenated text from all cell paragraphs
  images: ImageRef[];
  vMerge: 'restart' | 'continue' | null;
  gridSpan: number;        // column span (1 = no span)
  rawXml: string;
}

/** A table row */
export interface ParsedTableRow {
  cells: ParsedTableCell[];
  rawXml: string;
}

/** A parsed table */
export interface ParsedTable {
  bodyChildIndex: number;
  rows: ParsedTableRow[];
  rawXml: string;
}

/** A body child is either a paragraph or a table */
export type BodyChild =
  | { type: 'paragraph'; data: ParsedParagraph }
  | { type: 'table'; data: ParsedTable };

// ===== Section Tree =====

/** A section node in the heading hierarchy */
export interface SectionNode {
  heading: ParsedParagraph;
  headingText: string;          // cleaned/trimmed heading text
  level: number;                // 1-4
  children: SectionNode[];      // sub-sections
  bodyContent: BodyChild[];     // direct content under this heading (before next heading)
  allContent: BodyChild[];      // ALL content recursively (computed after tree is built)
  bodyChildIndexStart: number;
  bodyChildIndexEnd: number;    // exclusive
}

/** Product metadata extracted from Para 8 text boxes */
export interface ProductInfo {
  chineseProductName: string;   // e.g. "乙型肝炎核心抗原总抗体的化验检测"
  englishProductName: string;   // e.g. "Atellica IM HBc Total 2 (HBcT2)"
  productAbbreviation: string;  // e.g. "Atellica IM HBcT2"
  testNameId: string;           // e.g. "HBcT2"
  orderCode: string;            // e.g. "11200739"
  testCount: string;            // e.g. "100"
  system: string;               // e.g. "Atellica IM Analyzer"
  sampleTypes: string;
  sampleVolume: string;         // e.g. "50 µL"
  version: string;              // e.g. "Rev. 05, 2023-09"
}

/** Complete parsed source document */
export interface ParsedDocument {
  bodyChildren: BodyChild[];
  paragraphs: ParsedParagraph[];   // top-level paragraphs only
  tables: ParsedTable[];
  sectionTree: SectionNode[];      // top-level Heading1 sections
  productInfo: ProductInfo;
  images: Map<string, Uint8Array>; // fileName → binary
  relationships: Relationship[];
}

// ===== Mapping Layer =====

export type SourceType = 'section' | 'productInfo' | 'table' | 'manual';
export type ContentFilter = 'all' | 'bodyOnly';

/** A single mapping rule */
export interface MappingRule {
  placeholderId: string;
  templateDescription: string;
  sourceType: SourceType;

  // For 'section'
  sectionPaths?: string[][];  // ordered list of candidate paths; first match wins
  contentFilter?: ContentFilter;

  // For 'productInfo'
  productInfoField?: keyof ProductInfo;

  // For 'table'
  tableIndex?: number;
  extractionRule?: string; // e.g. "column:检测次数"

  // For 'manual'
  manualInputLabel?: string;
}

/** Content to fill a single template placeholder */
export interface MappedContent {
  placeholderId: string;
  sourceDescription: string;
  bodyChildren: BodyChild[];
  rawXmlFragments: string[];
  plainText: string;
  requiresManualInput: boolean;
}

/** Complete mapping result */
export interface MappingResult {
  mappings: Map<string, MappedContent>;
  warnings: string[];
  unmappedPlaceholders: string[];
}
