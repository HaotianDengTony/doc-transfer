import type { ParsedParagraph, TextRun, ImageRef, ListInfo, ParagraphStyle } from '../docx/types';
import { NS, getFirstElement, getDirectChildren, getWVal, serializeElement } from './xmlUtils';
import { resolveImageRef } from './ImageExtractor';

/** Style name mapping from w:val to our ParagraphStyle */
const HEADING_STYLES: Record<string, number> = {
  'Heading1': 1, 'heading1': 1, 'Heading 1': 1,
  'Heading2': 2, 'heading2': 2, 'Heading 2': 2,
  'Heading3': 3, 'heading3': 3, 'Heading 3': 3,
  'Heading4': 4, 'heading4': 4, 'Heading 4': 4,
};

/**
 * Parse a <w:p> element into a ParsedParagraph.
 * Only extracts direct text runs (not text inside drawings/text boxes).
 */
export function parseParagraph(
  pElement: Element,
  bodyChildIndex: number,
  relIdToFileName: Map<string, string>,
): ParsedParagraph {
  const style = extractStyle(pElement);
  const headingLevel = HEADING_STYLES[style] ?? null;
  const runs: TextRun[] = [];
  const images: ImageRef[] = [];

  // Iterate only over direct <w:r> children of <w:p>
  const directRuns = getDirectChildren(pElement, NS.w, 'r');
  for (const runEl of directRuns) {
    const textRun = parseTextRun(runEl);
    if (textRun) {
      runs.push(textRun);
    }

    // Check for images in this run
    const imgRefs = extractImagesFromRun(runEl, relIdToFileName);
    images.push(...imgRefs);
  }

  const text = runs.map(r => r.text).join('');
  const listInfo = extractListInfo(pElement);
  const rawXml = serializeElement(pElement);

  return {
    bodyChildIndex,
    style,
    headingLevel,
    runs,
    text,
    images,
    listInfo,
    rawXml,
  };
}

function extractStyle(pElement: Element): ParagraphStyle {
  const pPr = getFirstElement(pElement, NS.w, 'pPr');
  if (!pPr) return 'Normal';
  const pStyle = getFirstElement(pPr, NS.w, 'pStyle');
  if (!pStyle) return 'Normal';
  const val = getWVal(pStyle);
  return val || 'Normal';
}

function parseTextRun(runEl: Element): TextRun | null {
  // Collect text from <w:t> elements
  const tElements = getDirectChildren(runEl, NS.w, 't');
  if (tElements.length === 0) return null;

  const text = tElements.map(t => t.textContent || '').join('');
  if (!text) return null;

  // Extract formatting from <w:rPr>
  const rPr = getFirstElement(runEl, NS.w, 'rPr');
  const bold = rPr ? getFirstElement(rPr, NS.w, 'b') !== null : false;
  const italic = rPr ? getFirstElement(rPr, NS.w, 'i') !== null : false;

  let superscript = false;
  let subscript = false;
  if (rPr) {
    const vertAlign = getFirstElement(rPr, NS.w, 'vertAlign');
    if (vertAlign) {
      const val = getWVal(vertAlign);
      superscript = val === 'superscript';
      subscript = val === 'subscript';
    }
  }

  let color: string | undefined;
  if (rPr) {
    const colorEl = getFirstElement(rPr, NS.w, 'color');
    if (colorEl) {
      const val = getWVal(colorEl);
      if (val && val !== 'auto') color = val;
    }
  }

  let fontSize: number | undefined;
  if (rPr) {
    const szEl = getFirstElement(rPr, NS.w, 'sz');
    if (szEl) {
      const val = getWVal(szEl);
      if (val) fontSize = parseInt(val, 10);
    }
  }

  let fontFamily: string | undefined;
  if (rPr) {
    const rFonts = getFirstElement(rPr, NS.w, 'rFonts');
    if (rFonts) {
      fontFamily = rFonts.getAttributeNS(NS.w, 'ascii')
        || rFonts.getAttribute('w:ascii')
        || rFonts.getAttributeNS(NS.w, 'eastAsia')
        || rFonts.getAttribute('w:eastAsia')
        || undefined;
    }
  }

  return { text, bold, italic, superscript, subscript, color, fontSize, fontFamily };
}

function extractImagesFromRun(runEl: Element, relIdToFileName: Map<string, string>): ImageRef[] {
  const images: ImageRef[] = [];

  // Check for <w:drawing> elements
  const drawings = runEl.getElementsByTagNameNS(NS.wp, 'inline');
  const anchors = runEl.getElementsByTagNameNS(NS.wp, 'anchor');

  const allDrawingContainers = [...Array.from(drawings), ...Array.from(anchors)];

  for (const container of allDrawingContainers) {
    const ref = resolveImageRef(container, relIdToFileName);
    if (ref) images.push(ref);
  }

  return images;
}

function extractListInfo(pElement: Element): ListInfo | null {
  const pPr = getFirstElement(pElement, NS.w, 'pPr');
  if (!pPr) return null;
  const numPr = getFirstElement(pPr, NS.w, 'numPr');
  if (!numPr) return null;

  const numIdEl = getFirstElement(numPr, NS.w, 'numId');
  const ilvlEl = getFirstElement(numPr, NS.w, 'ilvl');

  if (!numIdEl) return null;

  const numId = parseInt(getWVal(numIdEl) || '0', 10);
  const level = parseInt((ilvlEl ? getWVal(ilvlEl) : null) || '0', 10);

  return { numId, level };
}
