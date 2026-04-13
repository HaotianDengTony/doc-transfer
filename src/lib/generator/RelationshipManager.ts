import { parseXml } from '../parser/xmlUtils';

const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const IMAGE_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
const NUMBERING_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering';

/**
 * Manages the output document's word/_rels/document.xml.rels.
 * Loads the template's existing relationships and provides methods to add new ones.
 */
export class RelationshipManager {
  private doc: Document;
  private rootElement: Element;
  private nextRIdNum: number;

  constructor(templateRelsXml: string) {
    this.doc = parseXml(templateRelsXml);
    this.rootElement = this.doc.documentElement;

    // Find the highest existing rId number
    const relElements = Array.from(this.rootElement.getElementsByTagNameNS(RELS_NS, 'Relationship'));
    let maxNum = 0;
    for (const el of relElements) {
      const id = el.getAttribute('Id') || '';
      const match = id.match(/^rId(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    this.nextRIdNum = maxNum + 1;
  }

  /** Add an image relationship. Returns the new rId (e.g., "rId10"). */
  addImageRelationship(target: string): string {
    return this.addRelationship(IMAGE_TYPE, target);
  }

  /** Add a numbering.xml relationship if not already present. Returns the rId. */
  addNumberingRelationship(): string {
    // Check if numbering relationship already exists
    const existing = Array.from(this.rootElement.getElementsByTagNameNS(RELS_NS, 'Relationship'));
    for (const el of existing) {
      if (el.getAttribute('Type') === NUMBERING_TYPE) {
        return el.getAttribute('Id') || '';
      }
    }
    return this.addRelationship(NUMBERING_TYPE, 'numbering.xml');
  }

  /** Serialize the updated relationships XML. */
  serialize(): string {
    return new XMLSerializer().serializeToString(this.doc);
  }

  private addRelationship(type: string, target: string): string {
    const rId = `rId${this.nextRIdNum++}`;
    const relEl = this.doc.createElementNS(RELS_NS, 'Relationship');
    relEl.setAttribute('Id', rId);
    relEl.setAttribute('Type', type);
    relEl.setAttribute('Target', target);
    this.rootElement.appendChild(relEl);
    return rId;
  }
}
