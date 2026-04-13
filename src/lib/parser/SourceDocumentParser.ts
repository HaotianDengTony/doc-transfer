import type { DocxArchive, ParsedDocument, BodyChild, ParsedParagraph, ParsedTable } from '../docx/types';
import { parseDocxArchive, parseRelationships } from '../docx/DocxParser';
import { parseXml, NS, getFirstElement, getWVal } from './xmlUtils';
import { parseParagraph } from './ParagraphParser';
import { parseTable } from './TableParser';
import { buildRelIdToFileName } from './ImageExtractor';
import { buildSectionTree } from './SectionTreeBuilder';
import { parseProductInfo } from './ProductInfoParser';

/** Result of parsing: both the raw archive and the structured document */
export interface ParseSourceResult {
  archive: DocxArchive;
  document: ParsedDocument;
}

/**
 * Parse a source .docx file into a fully structured ParsedDocument.
 * Returns both the raw archive (for Phase 2 generator) and the parsed document.
 * This is the main entry point for Phase 1.
 */
export async function parseSourceDocument(file: File): Promise<ParseSourceResult> {
  // Step 1: Extract ZIP contents
  const archive = await parseDocxArchive(file);

  // Step 2: Parse relationships
  const relationships = parseRelationships(archive.relationshipsXml);
  const relIdToFileName = buildRelIdToFileName(relationships);

  // Step 3: Parse document XML
  const doc = parseXml(archive.documentXml);
  const body = doc.getElementsByTagNameNS(NS.w, 'body')[0];
  if (!body) {
    throw new Error('No w:body element found in document.xml');
  }

  // Step 4: Walk all direct children of <w:body>
  const bodyChildren: BodyChild[] = [];
  const paragraphs: ParsedParagraph[] = [];
  const tables: ParsedTable[] = [];
  let bodyChildIndex = 0;

  const directChildren = Array.from(body.childNodes).filter(
    (n) => n.nodeType === Node.ELEMENT_NODE
  ) as Element[];

  for (const element of directChildren) {
    if (element.localName === 'p' && element.namespaceURI === NS.w) {
      // Skip page header/footer paragraphs embedded in the body
      if (!isPageHeaderFooter(element)) {
        // Some paragraphs mix symbol drawings with header text in the same <w:p>
        // (e.g. a page-boundary paragraph in 符号定义 that has both anchor images and
        // "Atellica IM Analyzer  HBcT2" text). Strip the text runs before parsing so
        // the drawings are preserved but the header text is discarded.
        if (hasMixedDrawingAndHeaderText(element)) {
          stripTextRunsKeepDrawings(element);
        }
        const parsed = parseParagraph(element, bodyChildIndex, relIdToFileName);
        bodyChildren.push({ type: 'paragraph', data: parsed });
        paragraphs.push(parsed);
      }
    } else if (element.localName === 'tbl' && element.namespaceURI === NS.w) {
      const parsed = parseTable(element, bodyChildIndex, relIdToFileName);
      bodyChildren.push({ type: 'table', data: parsed });
      tables.push(parsed);
    }
    // Skip other elements like w:sectPr
    bodyChildIndex++;
  }

  // Step 5: Build section tree
  const sectionTree = buildSectionTree(bodyChildren);

  // Step 6: Extract product info from the first Heading1 paragraph
  const productInfo = extractProductInfo(bodyChildren);

  // Step 7: Build image map
  const images = new Map<string, Uint8Array>();
  for (const [fileName, data] of archive.mediaFiles) {
    images.set(fileName, data);
  }

  return {
    archive,
    document: {
      bodyChildren,
      paragraphs,
      tables,
      sectionTree,
      productInfo,
      images,
      relationships,
    },
  };
}

/**
 * Returns true if a <w:p> element is a page header/footer paragraph that should be excluded.
 *
 * Siemens source documents embed running page header/footer content directly in the body
 * (a PDF→Word conversion artifact). Three recognizable patterns, all confirmed on HBcT2 AIM:
 *  1. Contains <w:lastRenderedPageBreak> — running header line (e.g. "HBcT2  Atellica IM Analyzer")
 *  2. <w:pPr> contains <w:sectPr>       — section break marker paragraph (always empty text)
 *  3. <w:pPr>/<w:rPr>/<w:sz w:val="16"> — 8pt paragraph-level font (page number / doc code line)
 *  4. <w:pPr>/<w:rPr>/<w:sz> any value + no text — layout spacer paragraph
 *
 * Safety rule: any paragraph containing a drawing (<wp:anchor>, <wp:inline>, or
 * <mc:AlternateContent>) is unconditionally real content. All genuine header/footer
 * paragraphs are text-only — symbol image paragraphs and other drawing-bearing
 * paragraphs must never be filtered even if they match other conditions.
 */
function isPageHeaderFooter(pElement: Element): boolean {
  // Safety gate: paragraphs with drawings are always real content, never header/footer.
  // This protects symbol-definition paragraphs that may trigger conditions 1 or 3
  // (e.g. sz=16 in paragraph mark, or lastRenderedPageBreak at page boundary) while
  // containing floating images that must be preserved.
  const hasDrawing = pElement.getElementsByTagNameNS(NS.wp, 'inline').length > 0
    || pElement.getElementsByTagNameNS(NS.wp, 'anchor').length > 0
    || pElement.getElementsByTagNameNS(NS.mc, 'AlternateContent').length > 0;
  if (hasDrawing) return false;

  // Condition 1: lastRenderedPageBreak anywhere in the paragraph
  if (pElement.getElementsByTagNameNS(NS.w, 'lastRenderedPageBreak').length > 0) {
    return true;
  }

  const pPr = getFirstElement(pElement, NS.w, 'pPr');
  if (pPr) {
    // Condition 2: sectPr inside pPr (section break marker paragraph)
    if (getFirstElement(pPr, NS.w, 'sectPr') !== null) {
      return true;
    }

    // Condition 3: paragraph-level rPr with sz=16 (8pt — used only on page number lines)
    // Condition 4: any explicit paragraph-level sz + empty text → layout spacer paragraph
    //   (e.g. sz=2/4/11/19 empty paragraphs that appear adjacent to page break clusters)
    const pRpr = getFirstElement(pPr, NS.w, 'rPr');
    if (pRpr) {
      const sz = getFirstElement(pRpr, NS.w, 'sz');
      if (sz) {
        if (getWVal(sz) === '16') return true; // condition 3: page number line
        // condition 4: explicit sz + no text → pure layout spacer
        // (hasDrawing already handled above — if we reach here, there are no drawings)
        const hasText = Array.from(pElement.getElementsByTagNameNS(NS.w, 't'))
          .some(t => (t.textContent || '').trim() !== '');
        if (!hasText) return true;
      }
    }
  }

  return false;
}

/**
 * Returns true if a paragraph has drawing content AND also has header/footer-signature
 * text that should be stripped (but drawings kept).
 *
 * This handles paragraphs at page boundaries in the 符号定义 section where the source
 * document places floating symbol images in the same <w:p> that also carries a running
 * header line (e.g. "Atellica IM Analyzer  HBcT2") or a page-number line
 * (e.g. "16 / 18  11200753_ZHS Rev. 05, 2023-09"). We want the images; not the text.
 */
function hasMixedDrawingAndHeaderText(pElement: Element): boolean {
  // Must have drawings to be "mixed"
  const hasDrawing = pElement.getElementsByTagNameNS(NS.wp, 'anchor').length > 0
    || pElement.getElementsByTagNameNS(NS.wp, 'inline').length > 0
    || pElement.getElementsByTagNameNS(NS.mc, 'AlternateContent').length > 0;
  if (!hasDrawing) return false;

  // Must also have visible text — pure drawing paragraphs need no stripping
  const hasText = Array.from(pElement.getElementsByTagNameNS(NS.w, 't'))
    .some(t => (t.textContent || '').trim() !== '');
  if (!hasText) return false;

  // Header signature — Condition 1: lastRenderedPageBreak (running header line)
  if (pElement.getElementsByTagNameNS(NS.w, 'lastRenderedPageBreak').length > 0) return true;

  // Header signature — Condition 3: sz=16 in pPr/rPr (page number / doc-code line)
  const pPr = getFirstElement(pElement, NS.w, 'pPr');
  if (pPr) {
    const pRpr = getFirstElement(pPr, NS.w, 'rPr');
    if (pRpr) {
      const sz = getFirstElement(pRpr, NS.w, 'sz');
      if (sz && getWVal(sz) === '16') return true;
    }
  }

  return false;
}

/**
 * Remove all direct <w:r> children that carry text but no drawing content.
 * Called on mixed paragraphs to discard header/footer text while keeping
 * the floating symbol images in the same paragraph.
 */
function stripTextRunsKeepDrawings(pElement: Element): void {
  const runsToRemove: Element[] = [];

  for (let i = 0; i < pElement.childNodes.length; i++) {
    const child = pElement.childNodes[i];
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    if (el.localName !== 'r' || el.namespaceURI !== NS.w) continue;

    const hasDrawingInRun = el.getElementsByTagNameNS(NS.wp, 'anchor').length > 0
      || el.getElementsByTagNameNS(NS.wp, 'inline').length > 0
      || el.getElementsByTagNameNS(NS.mc, 'AlternateContent').length > 0;
    const hasTextInRun = el.getElementsByTagNameNS(NS.w, 't').length > 0;

    // Keep drawing runs; discard text-only runs (they carry header/footer content)
    if (hasTextInRun && !hasDrawingInRun) {
      runsToRemove.push(el);
    }
  }

  for (const run of runsToRemove) {
    pElement.removeChild(run);
  }
}

/**
 * Find the first Heading1 paragraph (the product info block) and extract ProductInfo.
 * Falls back to empty ProductInfo if not found.
 */
function extractProductInfo(bodyChildren: BodyChild[]): ReturnType<typeof parseProductInfo> {
  // Find the first Heading1 paragraph — this is the product info block
  for (const child of bodyChildren) {
    if (child.type === 'paragraph' && child.data.headingLevel === 1) {
      // We need the raw XML element to parse text boxes.
      // Re-parse from the rawXml stored in the paragraph.
      const doc = new DOMParser().parseFromString(child.data.rawXml, 'application/xml');
      const pElement = doc.documentElement;
      return parseProductInfo(pElement);
    }
  }

  // Fallback: empty product info
  return {
    chineseProductName: '',
    englishProductName: '',
    productAbbreviation: '',
    testNameId: '',
    orderCode: '',
    testCount: '',
    system: '',
    sampleTypes: '',
    sampleVolume: '',
    version: '',
  };
}
