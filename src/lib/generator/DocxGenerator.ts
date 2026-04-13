import JSZip from 'jszip';
import type { DocxArchive, ParsedDocument, MappingResult } from '../docx/types';
import { parseDocxArchive } from '../docx/DocxParser';
import { parseXml } from '../parser/xmlUtils';
import { RelationshipManager } from './RelationshipManager';
import { ContentTypesMerger } from './ContentTypesMerger';
import { ImageTransfer } from './ImageTransfer';
import { NumberingMerger } from './NumberingMerger';
import { scanTemplatePlaceholders } from './TemplatePlaceholderScanner';
import { replaceAllPlaceholders } from './PlaceholderReplacer';

/**
 * Generate the final NMPA compliance document (.docx).
 *
 * This is the Phase 2 orchestrator. It:
 * 1. Loads the bundled template
 * 2. Scans for placeholders
 * 3. Transfers images from source
 * 4. Merges numbering definitions
 * 5. Replaces all placeholders with mapped content
 * 6. Builds the output ZIP
 *
 * @param sourceArchive - The raw .docx archive of the source document
 * @param sourceDoc - The parsed source document
 * @param mappingResult - The mapping result from Phase 1
 * @param manualInputs - Optional user-provided values for manual fields
 * @returns A Blob containing the final .docx file
 */
export async function generateDocument(
  sourceArchive: DocxArchive,
  sourceDoc: ParsedDocument,
  mappingResult: MappingResult,
  manualInputs?: Map<string, string>,
): Promise<Blob> {
  // Step 1: Load the template
  const templateArchive = await loadTemplate();

  // Step 2: Parse template document.xml into a mutable DOM
  const templateDoc = parseXml(templateArchive.documentXml);

  // Step 3: Initialize managers
  const relManager = new RelationshipManager(templateArchive.relationshipsXml);
  const contentTypesMerger = new ContentTypesMerger(templateArchive.contentTypesXml);

  // Step 4: Scan template for placeholders
  const placeholders = scanTemplatePlaceholders(templateDoc);
  console.log(`[DocxGenerator] Found ${placeholders.length} template placeholders`);

  // Step 5: Transfer images from source to output
  const imageTransfer = new ImageTransfer(sourceDoc, relManager);
  imageTransfer.scanAndTransfer(mappingResult);
  const rIdMap = imageTransfer.getRIdMap();
  console.log(`[DocxGenerator] Transferred ${rIdMap.size} images`);

  // Ensure content types cover all transferred image extensions
  for (const ext of imageTransfer.getTransferredExtensions()) {
    contentTypesMerger.ensureExtension(ext);
  }

  // Step 6: Check and merge numbering.xml
  const numberingMerger = new NumberingMerger(
    sourceArchive.numberingXml,
    relManager,
    contentTypesMerger,
  );
  numberingMerger.checkAndMerge(mappingResult);
  console.log(`[DocxGenerator] Numbering needed: ${numberingMerger.isNeeded()}`);

  // Step 7: Replace all placeholders
  const warnings = replaceAllPlaceholders(
    placeholders,
    mappingResult.mappings,
    rIdMap,
    templateDoc,
    manualInputs,
  );

  if (warnings.length > 0) {
    console.warn('[DocxGenerator] Replacement warnings:', warnings);
  }

  // Step 8: Serialize the modified DOM
  const modifiedDocumentXml = new XMLSerializer().serializeToString(templateDoc);

  // Step 9: Build the output ZIP
  const outputZip = new JSZip();

  // Add modified document.xml
  outputZip.file('word/document.xml', modifiedDocumentXml);

  // Add updated relationships
  outputZip.file('word/_rels/document.xml.rels', relManager.serialize());

  // Add updated content types
  outputZip.file('[Content_Types].xml', contentTypesMerger.serialize());

  // Add template's original media files
  for (const [fileName, data] of templateArchive.mediaFiles) {
    outputZip.file(`word/media/${fileName}`, data);
  }

  // Add transferred source media files
  for (const [fileName, data] of imageTransfer.getOutputMedia()) {
    outputZip.file(`word/media/${fileName}`, data);
  }

  // Add numbering.xml if needed
  const numberingXml = numberingMerger.getNumberingXml();
  if (numberingXml) {
    outputZip.file('word/numbering.xml', numberingXml);
  }

  // Add all other template files (styles, settings, theme, header, fonts, etc.)
  // Note: otherFiles already excludes document.xml, rels, content types, and media
  for (const [path, data] of templateArchive.otherFiles) {
    outputZip.file(path, data);
  }

  // Generate the output blob
  const blob = await outputZip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  console.log(`[DocxGenerator] Output generated: ${(blob.size / 1024).toFixed(1)} KB`);
  return blob;
}

/**
 * Load the bundled NMPA template from the public directory.
 */
async function loadTemplate(): Promise<DocxArchive> {
  const response = await fetch('/合规说明书template-HBcT2 AIM.docx');
  if (!response.ok) {
    throw new Error(`Failed to load template: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return parseDocxArchive(arrayBuffer);
}
