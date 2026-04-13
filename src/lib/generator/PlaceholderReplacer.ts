import { NS } from '../parser/xmlUtils';
import type { TemplatePlaceholder } from './types';
import type { MappedContent } from '../docx/types';
import { prepareFragments } from './XmlFragmentInserter';

/**
 * Replace all template placeholders with mapped source content.
 *
 * Processes placeholders in reverse document order (bottom-to-top)
 * to prevent DOM position shifts from invalidating later references.
 */
export function replaceAllPlaceholders(
  placeholders: TemplatePlaceholder[],
  mappings: Map<string, MappedContent>,
  rIdMap: Map<string, string>,
  templateDoc: Document,
  manualInputs?: Map<string, string>,
): string[] {
  const warnings: string[] = [];

  // Sort placeholders in reverse document order for safe DOM manipulation
  const sorted = [...placeholders].sort((a, b) => {
    return compareDocumentPosition(b.element, a.element);
  });

  for (const placeholder of sorted) {
    const content = mappings.get(placeholder.placeholderId);

    if (!content) {
      warnings.push(`No mapped content for placeholder: ${placeholder.placeholderId}`);
      continue;
    }

    // Check for manual input override
    const manualValue = manualInputs?.get(placeholder.placeholderId);

    switch (placeholder.type) {
      case 'standalone':
        replaceStandalone(placeholder, content, rIdMap, templateDoc, manualValue);
        break;
      case 'inline':
        replaceInline(placeholder, content, manualValue);
        break;
      case 'numeric':
        replaceNumeric(placeholder, manualValue);
        break;
      case 'table-whole':
        replaceTable(placeholder, content, rIdMap, templateDoc);
        break;
    }
  }

  return warnings;
}

/**
 * Replace a standalone [xxx] paragraph with multi-element source content.
 * The single <w:p> placeholder is removed and replaced with all the
 * source paragraphs and tables.
 */
function replaceStandalone(
  placeholder: TemplatePlaceholder,
  content: MappedContent,
  rIdMap: Map<string, string>,
  templateDoc: Document,
  manualValue?: string,
): void {
  const pElement = placeholder.element;
  const parent = placeholder.parentBody;

  // If content requires manual input and no value provided, leave placeholder
  if (content.requiresManualInput && !manualValue) {
    highlightPlaceholder(pElement);
    return;
  }

  // If manual value provided for a manual field, replace with simple text
  if (content.requiresManualInput && manualValue) {
    replaceTextContent(pElement, manualValue);
    return;
  }

  // For productInfo-type content (plainText only, no XML fragments)
  if (content.rawXmlFragments.length === 0 && content.plainText) {
    replaceTextContent(pElement, content.plainText);
    return;
  }

  // If no content fragments AND no plain text, leave placeholder with warning highlight
  if (content.rawXmlFragments.length === 0) {
    highlightPlaceholder(pElement);
    return;
  }

  // Prepare source fragments for insertion.
  // rawCopy=true for the symbols placeholder: the 标识的解释 symbol table must be
  // copied verbatim — its column widths, borders, and image positions must not be
  // normalized, otherwise the symbol icons and description columns break.
  const rawCopy = placeholder.placeholderId === 'symbols';
  const elements = prepareFragments(content.rawXmlFragments, rIdMap, templateDoc, rawCopy);

  if (elements.length === 0) {
    highlightPlaceholder(pElement);
    return;
  }

  // Insert all source elements before the placeholder paragraph
  for (const el of elements) {
    parent.insertBefore(el, pElement);
  }

  // Remove the placeholder paragraph
  parent.removeChild(pElement);
}

/**
 * Replace [xxx] text within an inline paragraph.
 * Only the [xxx] portion is replaced; surrounding text is preserved.
 */
function replaceInline(
  placeholder: TemplatePlaceholder,
  content: MappedContent,
  manualValue?: string,
): void {
  const pElement = placeholder.element;
  const value = manualValue || content.plainText || '';

  if (!value) {
    // No value: leave [xxx] but highlight
    highlightPlaceholder(pElement);
    return;
  }

  // Find the <w:t> element containing [xxx] and replace just the [xxx] portion
  const tElements = pElement.getElementsByTagNameNS(NS.w, 't');
  for (let i = 0; i < tElements.length; i++) {
    const tEl = tElements[i];
    const text = tEl.textContent || '';
    if (text.includes('[xxx]')) {
      tEl.textContent = text.replace('[xxx]', value);

      // Remove red color from the run's formatting
      const run = tEl.parentElement;
      if (run) {
        removeRedColor(run);
      }
      return;
    }
  }

  // Handle split-run case: [xxx] might span multiple <w:r> elements
  // Concatenate all run texts to find where [xxx] spans
  const runs = pElement.getElementsByTagNameNS(NS.w, 'r');
  let accumulated = '';
  const runTexts: { run: Element; text: string; startIdx: number }[] = [];

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const tEls = run.getElementsByTagNameNS(NS.w, 't');
    let runText = '';
    for (let j = 0; j < tEls.length; j++) {
      runText += tEls[j].textContent || '';
    }
    runTexts.push({ run, text: runText, startIdx: accumulated.length });
    accumulated += runText;
  }

  const xxxIdx = accumulated.indexOf('[xxx]');
  if (xxxIdx === -1) return; // Not found at all

  // Find which runs [xxx] spans
  const xxxEnd = xxxIdx + 5; // "[xxx]" is 5 chars
  let firstRunIdx = -1;
  let lastRunIdx = -1;

  for (let i = 0; i < runTexts.length; i++) {
    const rt = runTexts[i];
    const runEnd = rt.startIdx + rt.text.length;
    if (firstRunIdx === -1 && runEnd > xxxIdx) firstRunIdx = i;
    if (rt.startIdx < xxxEnd) lastRunIdx = i;
  }

  if (firstRunIdx === -1 || lastRunIdx === -1) return;

  // Merge into the first run
  const firstRun = runTexts[firstRunIdx];
  const lastRun = runTexts[lastRunIdx];
  const beforeXxx = accumulated.substring(firstRun.startIdx, xxxIdx);
  const afterXxx = accumulated.substring(xxxEnd, lastRun.startIdx + lastRun.text.length);
  const newText = beforeXxx + value + afterXxx;

  // Set text on the first run's <w:t>
  const firstRunT = firstRun.run.getElementsByTagNameNS(NS.w, 't')[0];
  if (firstRunT) {
    firstRunT.textContent = newText;
    // Preserve whitespace
    firstRunT.setAttribute('xml:space', 'preserve');
  }

  // Remove subsequent runs that were part of [xxx]
  for (let i = firstRunIdx + 1; i <= lastRunIdx; i++) {
    const run = runTexts[i].run;
    run.parentElement?.removeChild(run);
  }

  removeRedColor(firstRun.run);
}

/**
 * Replace a numeric xx placeholder with a manual value.
 * The xx text is in a specific run with yellow highlight.
 */
function replaceNumeric(
  placeholder: TemplatePlaceholder,
  manualValue?: string,
): void {
  if (!manualValue) return; // Leave as-is if no manual value

  const pElement = placeholder.element;
  const runs = pElement.getElementsByTagNameNS(NS.w, 'r');

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const tElements = run.getElementsByTagNameNS(NS.w, 't');
    let runText = '';
    for (let j = 0; j < tElements.length; j++) {
      runText += tElements[j].textContent || '';
    }

    if (runText.trim() === 'xx') {
      // Replace text
      for (let j = 0; j < tElements.length; j++) {
        if (tElements[j].textContent?.trim() === 'xx') {
          tElements[j].textContent = manualValue;
        }
      }

      // Remove yellow highlight
      const rPr = run.getElementsByTagNameNS(NS.w, 'rPr')[0];
      if (rPr) {
        const highlight = rPr.getElementsByTagNameNS(NS.w, 'highlight')[0];
        if (highlight) {
          rPr.removeChild(highlight);
        }
      }
      return;
    }
  }
}

/**
 * Replace an entire template table with a source table.
 */
function replaceTable(
  placeholder: TemplatePlaceholder,
  content: MappedContent,
  rIdMap: Map<string, string>,
  templateDoc: Document,
): void {
  const oldTable = placeholder.element;
  const parent = placeholder.parentBody;

  // The content should include a table in its rawXmlFragments
  // Find the first table fragment
  let tableXml: string | null = null;
  for (const fragment of content.rawXmlFragments) {
    if (fragment.includes('<w:tbl') || fragment.includes('w:tbl>')) {
      tableXml = fragment;
      break;
    }
  }

  if (!tableXml) {
    // No table found in content — leave the template table
    return;
  }

  const elements = prepareFragments([tableXml], rIdMap, templateDoc);
  if (elements.length === 0) return;

  const newTable = elements[0];
  parent.replaceChild(newTable, oldTable);
}

/**
 * Replace all text in a paragraph with new text.
 * Preserves the first run's formatting but changes text content.
 */
function replaceTextContent(pElement: Element, text: string): void {
  const runs = pElement.getElementsByTagNameNS(NS.w, 'r');
  if (runs.length === 0) return;

  // Set text on the first run
  const firstRun = runs[0];
  const tElement = firstRun.getElementsByTagNameNS(NS.w, 't')[0];
  if (tElement) {
    tElement.textContent = text;
    tElement.setAttribute('xml:space', 'preserve');
  }

  // Remove red color
  removeRedColor(firstRun);

  // Remove any additional runs (they were part of the placeholder)
  for (let i = runs.length - 1; i > 0; i--) {
    runs[i].parentElement?.removeChild(runs[i]);
  }
}

/**
 * Add yellow highlight to a placeholder paragraph to indicate it needs attention.
 */
function highlightPlaceholder(pElement: Element): void {
  const runs = pElement.getElementsByTagNameNS(NS.w, 'r');
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    let rPr = run.getElementsByTagNameNS(NS.w, 'rPr')[0];
    if (!rPr) {
      rPr = pElement.ownerDocument.createElementNS(NS.w, 'w:rPr');
      run.insertBefore(rPr, run.firstChild);
    }
    const highlight = pElement.ownerDocument.createElementNS(NS.w, 'w:highlight');
    highlight.setAttributeNS(NS.w, 'w:val', 'yellow');
    rPr.appendChild(highlight);
  }
}

/**
 * Remove red color formatting from a run element.
 */
function removeRedColor(runElement: Element): void {
  const rPr = runElement.getElementsByTagNameNS(NS.w, 'rPr')[0];
  if (!rPr) return;
  const color = rPr.getElementsByTagNameNS(NS.w, 'color')[0];
  if (color) {
    const val = color.getAttributeNS(NS.w, 'val') || color.getAttribute('w:val');
    if (val === 'FF0000') {
      rPr.removeChild(color);
    }
  }
}

/**
 * Compare document position of two elements.
 * Returns positive if a is after b, negative if a is before b.
 */
function compareDocumentPosition(a: Element, b: Element): number {
  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}
