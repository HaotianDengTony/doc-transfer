import type { ParsedDocument, Relationship, MappingResult } from '../docx/types';
import { RelationshipManager } from './RelationshipManager';

/**
 * Handles copying source document images to the output document.
 * - Scans mapped content for image references (r:embed rIds)
 * - Copies image binaries with new filenames (src_image1.png, etc.)
 * - Registers new relationships via RelationshipManager
 * - Builds an rId mapping for rewriting references in inserted XML
 */
export class ImageTransfer {
  private sourceImages: Map<string, Uint8Array>;
  private sourceRelationships: Relationship[];
  private relManager: RelationshipManager;

  /** sourceRId → outputRId */
  private rIdMap = new Map<string, string>();
  /** outputFileName → binary data */
  private outputMedia = new Map<string, Uint8Array>();
  private imageCounter = 1;

  constructor(
    sourceDoc: ParsedDocument,
    relManager: RelationshipManager,
  ) {
    this.sourceImages = sourceDoc.images;
    this.sourceRelationships = sourceDoc.relationships;
    this.relManager = relManager;
  }

  /**
   * Scan all rawXmlFragments in the mapping result for image references,
   * and transfer all referenced images.
   */
  scanAndTransfer(mappingResult: MappingResult): void {
    // Collect all unique source rIds from raw XML fragments
    const sourceRIds = new Set<string>();
    const rIdPattern = /r:embed="(rId\d+)"/g;
    // Also match r:id for VML imagedata
    const rIdPattern2 = /r:id="(rId\d+)"/g;

    for (const [, content] of mappingResult.mappings) {
      for (const fragment of content.rawXmlFragments) {
        let match: RegExpExecArray | null;
        rIdPattern.lastIndex = 0;
        while ((match = rIdPattern.exec(fragment)) !== null) {
          sourceRIds.add(match[1]);
        }
        rIdPattern2.lastIndex = 0;
        while ((match = rIdPattern2.exec(fragment)) !== null) {
          sourceRIds.add(match[1]);
        }
      }
    }

    // Transfer each referenced image
    for (const sourceRId of sourceRIds) {
      this.transferImage(sourceRId);
    }
  }

  /** Get the rId mapping (sourceRId → outputRId). */
  getRIdMap(): Map<string, string> {
    return this.rIdMap;
  }

  /** Get all transferred image files for the output ZIP. */
  getOutputMedia(): Map<string, Uint8Array> {
    return this.outputMedia;
  }

  /**
   * Get all unique image file extensions that were transferred.
   * Used to ensure Content_Types.xml covers them.
   */
  getTransferredExtensions(): Set<string> {
    const extensions = new Set<string>();
    for (const fileName of this.outputMedia.keys()) {
      const ext = fileName.split('.').pop()?.toLowerCase();
      if (ext) extensions.add(ext);
    }
    return extensions;
  }

  private transferImage(sourceRId: string): void {
    // Skip if already transferred
    if (this.rIdMap.has(sourceRId)) return;

    // Find the source relationship to get the file path
    const rel = this.sourceRelationships.find(r => r.id === sourceRId);
    if (!rel) return; // Not found — could be a non-image relationship

    // Only process image relationships
    if (!rel.type.includes('/image')) return;

    // Extract filename from target (e.g., "media/image46.png" → "image46.png")
    const sourceFileName = rel.target.replace(/^media\//, '');

    // Get binary data
    const imageData = this.sourceImages.get(sourceFileName);
    if (!imageData) return; // Image binary not available

    // Generate output filename
    const ext = sourceFileName.split('.').pop() || 'png';
    const outputFileName = `src_image${this.imageCounter++}.${ext}`;

    // Register in relationship manager
    const outputRId = this.relManager.addImageRelationship(`media/${outputFileName}`);

    // Store mapping and data
    this.rIdMap.set(sourceRId, outputRId);
    this.outputMedia.set(outputFileName, imageData);
  }
}
