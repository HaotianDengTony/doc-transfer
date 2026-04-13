import { NS, getDirectChildren, getFirstElement } from '../parser/xmlUtils';

/**
 * All OOXML namespace declarations needed to parse raw XML fragments.
 * Fragments may use any of these prefixes without declaring them,
 * because they were originally declared on the root <w:document> element.
 */
const NAMESPACE_WRAPPER_OPEN = [
  '<w:root',
  ` xmlns:w="${NS.w}"`,
  ` xmlns:r="${NS.r}"`,
  ` xmlns:wp="${NS.wp}"`,
  ` xmlns:a="${NS.a}"`,
  ` xmlns:pic="${NS.pic}"`,
  ` xmlns:wps="${NS.wps}"`,
  ` xmlns:mc="${NS.mc}"`,
  ` xmlns:v="${NS.v}"`,
  ' xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"',
  ' xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"',
  ' xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"',
  ' xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"',
  ' xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"',
  ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"',
  ' xmlns:o="urn:schemas-microsoft-com:office:office"',
  ' xmlns:w10="urn:schemas-microsoft-com:office:word"',
  ' xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"',
  ' xmlns:wpsCustomData="http://www.wps.cn/officeDocument/2013/wpsCustomData"',
  '>',
].join('');
const NAMESPACE_WRAPPER_CLOSE = '</w:root>';

/**
 * Parse raw XML fragments, rewrite image rIds, and import into the template DOM.
 *
 * @param rawXmlFragments - Array of raw XML strings (each is a <w:p> or <w:tbl>)
 * @param rIdMap - Source rId → output rId mapping for images
 * @param templateDoc - The template Document to import nodes into
 * @param rawCopy - If true, skip anchor-to-inline conversion and table normalization
 *                  (use for sections like 标识的解释 where the source table structure
 *                  must be preserved verbatim)
 * @returns Array of Element nodes ready for insertion into <w:body>
 */
export function prepareFragments(
  rawXmlFragments: string[],
  rIdMap: Map<string, string>,
  templateDoc: Document,
  rawCopy = false,
): Element[] {
  const elements: Element[] = [];

  for (const rawXml of rawXmlFragments) {
    if (!rawXml.trim()) continue;

    const prepared = prepareFragment(rawXml, rIdMap, templateDoc, rawCopy);
    if (prepared) {
      elements.push(prepared);
    }
  }

  return elements;
}

/**
 * Prepare a single XML fragment for insertion.
 */
function prepareFragment(
  rawXml: string,
  rIdMap: Map<string, string>,
  templateDoc: Document,
  rawCopy = false,
): Element | null {
  // Wrap in a namespace-aware root element so DOMParser can resolve prefixes
  const wrappedXml = NAMESPACE_WRAPPER_OPEN + rawXml + NAMESPACE_WRAPPER_CLOSE;

  const parser = new DOMParser();
  const doc = parser.parseFromString(wrappedXml, 'application/xml');

  // Check for parse errors
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    console.warn('XML fragment parse error:', errorNode.textContent, rawXml.substring(0, 200));
    return null;
  }

  const root = doc.documentElement;
  // The actual element is the first child of our wrapper
  const childElements = getChildElements(root);
  if (childElements.length === 0) return null;

  const element = childElements[0];

  // Rewrite image rIds
  rewriteImageRIds(element, rIdMap);

  // Strip sectPr from paragraph properties (prevent page layout disruption)
  stripSectionProperties(element);

  if (!rawCopy) {
    // Convert anchored (floating) images to inline so they flow with text
    // and don't overlap template content
    convertAnchorToInline(element);

    // Normalize paragraph formatting so source styles don't conflict with template
    if (element.localName === 'p') {
      normalizeInsertedParagraph(element);
    }

    // Normalize table widths and styles so source-calibrated sizes don't overflow template
    if (element.localName === 'tbl') {
      normalizeInsertedTable(element);
    }
  }

  // Import into the template document's DOM
  const imported = templateDoc.importNode(element, true);
  return imported as Element;
}

/**
 * Rewrite all image relationship IDs in the element tree.
 * Handles both DrawingML (<a:blip r:embed="...">) and VML (<v:imagedata r:id="...">).
 */
function rewriteImageRIds(element: Element, rIdMap: Map<string, string>): void {
  if (rIdMap.size === 0) return;

  // DrawingML: <a:blip r:embed="rIdXX">
  const blips = element.getElementsByTagNameNS(NS.a, 'blip');
  for (let i = 0; i < blips.length; i++) {
    const blip = blips[i];
    const embedRId = blip.getAttributeNS(NS.r, 'embed') || blip.getAttribute('r:embed');
    if (embedRId && rIdMap.has(embedRId)) {
      blip.setAttributeNS(NS.r, 'r:embed', rIdMap.get(embedRId)!);
    }
    // Also check r:link (external images)
    const linkRId = blip.getAttributeNS(NS.r, 'link') || blip.getAttribute('r:link');
    if (linkRId && rIdMap.has(linkRId)) {
      blip.setAttributeNS(NS.r, 'r:link', rIdMap.get(linkRId)!);
    }
  }

  // VML: <v:imagedata r:id="rIdXX">
  const imageDataElements = element.getElementsByTagNameNS(NS.v, 'imagedata');
  for (let i = 0; i < imageDataElements.length; i++) {
    const imgData = imageDataElements[i];
    const rId = imgData.getAttributeNS(NS.r, 'id') || imgData.getAttribute('r:id');
    if (rId && rIdMap.has(rId)) {
      imgData.setAttributeNS(NS.r, 'r:id', rIdMap.get(rId)!);
    }
  }
}

/**
 * Remove <w:sectPr> from inside <w:pPr> to prevent source section
 * properties from disrupting the template's page layout.
 */
function stripSectionProperties(element: Element): void {
  const sectPrs = element.getElementsByTagNameNS(NS.w, 'sectPr');
  // Iterate in reverse since removing elements shifts indices
  for (let i = sectPrs.length - 1; i >= 0; i--) {
    const sectPr = sectPrs[i];
    // Only remove if it's inside a pPr (not the body-level sectPr)
    if (sectPr.parentElement?.localName === 'pPr') {
      sectPr.parentElement.removeChild(sectPr);
    }
  }
}

/** Get direct child elements of an element */
function getChildElements(parent: Element): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      result.push(child as Element);
    }
  }
  return result;
}

/**
 * Remove a direct child element (first match) from parent.
 * Uses getElementsByTagNameNS but guards that the found element is a direct child.
 */
function removeDirectChild(parent: Element, ns: string, localName: string): void {
  const found = parent.getElementsByTagNameNS(ns, localName);
  if (found.length > 0 && found[0].parentElement === parent) {
    parent.removeChild(found[0]);
  }
}

/**
 * Normalize a source <w:p> paragraph for insertion into the template.
 *
 * Source paragraphs carry formatting calibrated for the source document's
 * 10pt "Noto Sans SC" font. When inserted verbatim into the template (which
 * uses 11pt Arial), those settings cause lines to overlap. This function
 * strips incompatible properties and lets the template's styles take over.
 *
 * Stripped from <w:pPr>:
 *   - <w:pStyle>  — source style names (BodyText, ListParagraph, …) don't exist in template
 *   - <w:spacing> — line heights calibrated for 10pt font cause overlap at 11pt
 *   - <w:rPr>     — paragraph-mark run properties with wrong font/size
 *
 * Stripped from each <w:r> → <w:rPr>:
 *   - <w:rFonts>  — source fonts (宋体, Noto Sans SC) conflict with template's Arial
 *   - <w:sz>, <w:szCs> — source font sizes override template's 11pt default
 *   - <w:lang>    — language annotations (irrelevant in template)
 *   - <w:color>   — let template styles control text color
 *
 * Preserved (intentional formatting):
 *   <w:b>, <w:i>, <w:vertAlign> (superscript/subscript), <w:u>, <w:strike>,
 *   <w:highlight>, <w:spacing> in rPr (character spacing — tiny, harmless),
 *   <w:numPr>, <w:ind> in pPr (list numbering and indentation)
 */
function normalizeInsertedParagraph(pElement: Element): void {
  // --- Paragraph-level properties ---
  const pPrMatches = pElement.getElementsByTagNameNS(NS.w, 'pPr');
  const pPr = pPrMatches.length > 0 && pPrMatches[0].parentElement === pElement
    ? pPrMatches[0]
    : null;

  if (pPr) {
    // Remove source paragraph style — doesn't exist in template
    removeDirectChild(pPr, NS.w, 'pStyle');
    // Remove source line spacing — calibrated for 10pt, conflicts with template's 11pt
    removeDirectChild(pPr, NS.w, 'spacing');
    // Remove paragraph-mark run properties — wrong font/size from source
    removeDirectChild(pPr, NS.w, 'rPr');
    // Remove indentation for non-list paragraphs — source indent is calibrated for
    // source-specific styles (e.g. BodyText, ListParagraph) that no longer apply.
    // List paragraphs keep their indent because numPr provides the correct list level.
    //
    // Exception: paragraphs that contain a FOREGROUND floating symbol (behindDoc=0,
    // visible width > 10pt) also keep their indent. In these paragraphs the source
    // indent was specifically sized to push text to the right of the symbol so they
    // didn't overlap (e.g. 含有人源性物质。 had w:ind w:left="1574" / 78.7pt so
    // text started at 126.7pt, safely past the 25.6pt symbol end at 116.3pt).
    // Stripping the indent makes text start at 54pt (template left margin) and run
    // straight into the symbol.  behindDoc=1 anchors are behind text and don't cause
    // this problem; zero/tiny anchors (≤ 10pt wide) are invisible positioning markers.
    const hasNumPr = pPr.getElementsByTagNameNS(NS.w, 'numPr').length > 0;
    const hasForegroundSymbol = Array.from(
      pElement.getElementsByTagNameNS(NS.wp, 'anchor')
    ).some(anchor => {
      if (anchor.getAttribute('behindDoc') === '1') return false;
      const extentEl = anchor.getElementsByTagNameNS(NS.wp, 'extent')[0];
      const cx = extentEl ? parseInt(extentEl.getAttribute('cx') || '0', 10) : 0;
      return cx > 127000; // > 10pt (1pt = 12700 EMU) — real symbol, not a marker
    });
    if (!hasNumPr && !hasForegroundSymbol) {
      removeDirectChild(pPr, NS.w, 'ind');
    }
  }

  // --- Run-level properties ---
  const runs = getDirectChildren(pElement, NS.w, 'r');
  for (const run of runs) {
    const rPrMatches = run.getElementsByTagNameNS(NS.w, 'rPr');
    const rPr = rPrMatches.length > 0 && rPrMatches[0].parentElement === run
      ? rPrMatches[0]
      : null;
    if (!rPr) continue;

    removeDirectChild(rPr, NS.w, 'rFonts'); // source fonts conflict with template
    removeDirectChild(rPr, NS.w, 'sz');     // source font sizes override template's 11pt
    removeDirectChild(rPr, NS.w, 'szCs');
    removeDirectChild(rPr, NS.w, 'lang');   // language annotations
    removeDirectChild(rPr, NS.w, 'color');  // let template control text color

    // PRESERVED: b, i, vertAlign (superscript/subscript), u, strike, highlight, spacing
  }
}

/**
 * Returns true if the anchor element lives inside a <w:p> that also contains
 * non-whitespace text runs. Such paragraphs are PDF→Word conversion artifacts
 * where a floating shape was placed at an absolute page coordinate that happens
 * to visually fall between text words. Converting these anchors to inline would
 * insert them at Run [0] (before all text), which is the wrong visual position.
 * Keeping them floating preserves the original page-relative position, which
 * differs from the template by only ~6pt (source left-margin 48pt vs template 54pt).
 */
function anchorIsInMixedParagraph(anchor: Element): boolean {
  // Walk up to the nearest enclosing <w:p>
  let el: Element | null = anchor.parentElement;
  while (el && !(el.localName === 'p' && el.namespaceURI === NS.w)) {
    el = el.parentElement;
  }
  if (!el) return false;

  // Mixed = paragraph has at least one <w:t> with non-whitespace content
  const tElements = el.getElementsByTagNameNS(NS.w, 't');
  for (let i = 0; i < tElements.length; i++) {
    if ((tElements[i].textContent || '').trim() !== '') return true;
  }
  return false;
}

/**
 * Convert all <wp:anchor> (floating) images to <wp:inline> so they flow with
 * text instead of overlapping template content.
 *
 * Anchor images in the source are calibrated for the source document's page
 * layout. When inserted into the template (different margins/dimensions), the
 * anchor coordinates are meaningless and cause images to float over text.
 * Inline placement preserves the image dimensions while letting text wrap around.
 *
 * Exception: anchors in paragraphs that also contain text are left floating.
 * These are PDF→Word artifacts where the shape was positioned mid-text by
 * absolute page coordinates — converting them to inline would place them at
 * the wrong text position (Run [0], before all text). See anchorIsInMixedParagraph.
 */
function convertAnchorToInline(element: Element): void {
  const anchors = Array.from(element.getElementsByTagNameNS(NS.wp, 'anchor'));
  for (const anchor of anchors) {
    // Skip anchors in paragraphs that also have text — keep them floating
    if (anchorIsInMixedParagraph(anchor)) continue;

    const parent = anchor.parentElement;
    if (!parent) continue;

    const doc = anchor.ownerDocument!;

    // Build a new wp:inline element
    const inline = doc.createElementNS(NS.wp, 'wp:inline');
    inline.setAttribute('distT', '0');
    inline.setAttribute('distB', '0');
    inline.setAttribute('distL', '114300');  // standard ~0.09cm side margins
    inline.setAttribute('distR', '114300');

    // Copy the children that are valid in wp:inline
    // (extent, effectExtent, docPr, cNvGraphicFramePr, a:graphic)
    const childrenToKeep: { ns: string; local: string }[] = [
      { ns: NS.wp, local: 'extent' },
      { ns: NS.wp, local: 'effectExtent' },
      { ns: NS.wp, local: 'docPr' },
      { ns: NS.wp, local: 'cNvGraphicFramePr' },
      { ns: NS.a, local: 'graphic' },
    ];

    for (const { ns, local } of childrenToKeep) {
      const child = getFirstElement(anchor, ns, local);
      if (child) {
        inline.appendChild(child.cloneNode(true));
      }
    }

    parent.replaceChild(inline, anchor);
  }
}

/**
 * Normalize a source <w:tbl> for insertion into the template.
 *
 * Source tables carry formatting calibrated for the source document's page
 * margins and styles. Inserting these verbatim causes tables to overflow the
 * template's text area or use non-existent styles.
 *
 * Changes:
 *   - Remove <w:tblStyle>   — source table style doesn't exist in template
 *   - Remove <w:tblW>       — source uses fixed dxa width; let Word auto-size
 *   - Remove <w:tblInd>     — source left-indent doesn't apply in template context
 */
function normalizeInsertedTable(tblElement: Element): void {
  // Find the direct <w:tblPr> child
  const tblPr = getFirstElement(tblElement, NS.w, 'tblPr');
  if (!tblPr || tblPr.parentElement !== tblElement) return;

  removeDirectChild(tblPr, NS.w, 'tblStyle');
  removeDirectChild(tblPr, NS.w, 'tblW');
  removeDirectChild(tblPr, NS.w, 'tblInd');
}
