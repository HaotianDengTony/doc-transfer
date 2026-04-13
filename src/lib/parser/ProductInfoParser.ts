import type { ProductInfo } from '../docx/types';
import { NS, getDirectChildren, getFirstElement } from './xmlUtils';


/**
 * Extract product metadata from the source document.
 *
 * Structure of Para 8 (body child index 8):
 * - Direct w:r children: run[2] has the Chinese product name as plain text
 * - run[2] also contains mc:AlternateContent → mc:Choice → drawing → wsp → txbx → txbxContent
 *   which holds a w:tbl with 8 rows of label-value pairs (product metadata)
 *
 * @param para8Element The <w:p> element at body child index 8 (Heading1 product info block)
 */
export function parseProductInfo(para8Element: Element): ProductInfo {
  const chineseProductName = extractChineseProductName(para8Element);
  const tableData = extractMetadataTable(para8Element);

  // Parse the English product name: "Atellica IM HBc Total 2 (HBcT2) 11200739"
  const rawProductName = tableData.get('产品名称') || '';
  // Split product name from order code — order code is the trailing 8+ digit number.
  // Do NOT anchor the end: trailing content like "（100 次测试）" may follow without a space.
  const nameMatch = rawProductName.match(/^(.+?)\s+(\d{8,})/);
  const englishProductName = nameMatch ? nameMatch[1].trim() : rawProductName.trim();
  const orderCode = nameMatch ? nameMatch[2] : '';

  // Parse test count from product name row (may be in a second cell like "（100 次测试）")
  const testCountRaw = tableData.get('产品名称_extra') || '';
  const testCountMatch = testCountRaw.match(/(\d+)\s*次测试/) || rawProductName.match(/(\d+)\s*次测试/);
  const testCount = testCountMatch ? testCountMatch[1] : '';

  // Parse version: skip the footnote marker "a", take "Rev. XX, YYYY-MM"
  const versionRaw = tableData.get('当前版本和日期') || '';
  const versionMatch = versionRaw.match(/(Rev\.\s*\d+,\s*\d{4}-\d{2})/);
  const version = versionMatch ? versionMatch[1] : versionRaw.trim();

  return {
    chineseProductName,
    englishProductName,
    productAbbreviation: tableData.get('产品名称缩写') || '',
    testNameId: tableData.get('测试名称/ID') || '',
    orderCode,
    testCount,
    system: tableData.get('系统') || '',
    sampleTypes: tableData.get('样本类型') || '',
    sampleVolume: tableData.get('样本量') || '',
    version,
  };
}

/**
 * Extract the Chinese product name from direct text runs of Para 8.
 * The name is in the first non-empty direct w:r/w:t (typically run index 2).
 */
function extractChineseProductName(para8Element: Element): string {
  const directRuns = getDirectChildren(para8Element, NS.w, 'r');
  for (const run of directRuns) {
    // Only consider runs with direct w:t children (not runs that only contain drawings)
    const tElements = getDirectChildren(run, NS.w, 't');
    const text = tElements.map(t => t.textContent || '').join('').trim();
    if (text) {
      return text;
    }
  }
  return '';
}

/**
 * Extract the metadata table from inside Para 8's drawing text box.
 *
 * Path: w:r → mc:AlternateContent → mc:Choice → w:drawing → wp:anchor →
 *       a:graphic → a:graphicData → wps:wsp → wps:txbx → w:txbxContent → w:tbl
 *
 * The table has 8 rows. Column 0 = label, columns 1+ = values.
 * Returns a Map of label → concatenated value text.
 */
function extractMetadataTable(para8Element: Element): Map<string, string> {
  const result = new Map<string, string>();

  // Find w:txbxContent within mc:Choice branch
  // We search through all descendants to handle any nesting depth
  const allTxbxContent = para8Element.getElementsByTagNameNS(NS.w, 'txbxContent');

  for (let i = 0; i < allTxbxContent.length; i++) {
    const txbxContent = allTxbxContent[i];

    // Check if this txbxContent is inside an mc:Choice (not mc:Fallback)
    // by looking for a w:tbl child
    const tbl = getFirstElement(txbxContent, NS.w, 'tbl');
    if (!tbl) continue;

    const rows = getDirectChildren(tbl, NS.w, 'tr');
    for (const row of rows) {
      const cells = getDirectChildren(row, NS.w, 'tc');
      if (cells.length < 2) continue;

      // Cell 0 = label
      const label = getCellText(cells[0]).trim();
      if (!label) continue;

      // Cells 1+ = value(s)
      const values: string[] = [];
      for (let ci = 1; ci < cells.length; ci++) {
        const text = getCellText(cells[ci]).trim();
        if (text) values.push(text);
      }
      const value = values.join(' ');

      result.set(label, value);

      // For product name row, store extra cells separately (e.g., test count)
      if (label === '产品名称' && values.length > 1) {
        result.set('产品名称_extra', values.slice(1).join(' '));
      }
    }

    // We found the metadata table, no need to check other txbxContent
    break;
  }

  return result;
}

/** Get concatenated text from all paragraphs in a table cell */
function getCellText(tcElement: Element): string {
  const paragraphs = getDirectChildren(tcElement, NS.w, 'p');
  const texts: string[] = [];
  for (const p of paragraphs) {
    const tElements = p.getElementsByTagNameNS(NS.w, 't');
    for (let i = 0; i < tElements.length; i++) {
      const text = tElements[i].textContent;
      if (text) texts.push(text);
    }
  }
  return texts.join('');
}
