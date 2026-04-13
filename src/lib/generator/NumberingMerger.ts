import type { MappingResult } from '../docx/types';
import { RelationshipManager } from './RelationshipManager';
import { ContentTypesMerger } from './ContentTypesMerger';

const NUMBERING_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml';

/**
 * Handles merging source document numbering.xml into the output.
 *
 * The template has no numbering.xml. If any inserted source content
 * references list numbering (w:numId), the source's numbering.xml
 * must be included in the output.
 */
export class NumberingMerger {
  private sourceNumberingXml: string | null;
  private relManager: RelationshipManager;
  private contentTypesMerger: ContentTypesMerger;

  /** Whether numbering.xml needs to be included in the output */
  private needsNumbering = false;

  constructor(
    sourceNumberingXml: string | null,
    relManager: RelationshipManager,
    contentTypesMerger: ContentTypesMerger,
  ) {
    this.sourceNumberingXml = sourceNumberingXml;
    this.relManager = relManager;
    this.contentTypesMerger = contentTypesMerger;
  }

  /**
   * Check if any mapped content uses list numbering.
   * If so, register numbering.xml in rels and content types.
   */
  checkAndMerge(mappingResult: MappingResult): void {
    if (!this.sourceNumberingXml) return;

    // Scan rawXmlFragments for w:numId references
    for (const [, content] of mappingResult.mappings) {
      for (const fragment of content.rawXmlFragments) {
        if (fragment.includes('w:numId') || fragment.includes('numId')) {
          this.needsNumbering = true;
          break;
        }
      }
      if (this.needsNumbering) break;
    }

    if (this.needsNumbering) {
      this.relManager.addNumberingRelationship();
      this.contentTypesMerger.addOverride(
        '/word/numbering.xml',
        NUMBERING_CONTENT_TYPE,
      );
    }
  }

  /** Whether numbering.xml should be added to the output ZIP. */
  isNeeded(): boolean {
    return this.needsNumbering;
  }

  /** Get the numbering.xml content for the output ZIP. */
  getNumberingXml(): string | null {
    return this.needsNumbering ? this.sourceNumberingXml : null;
  }
}
