import { parseXml } from '../parser/xmlUtils';

const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';

/** Known MIME types for image extensions */
const IMAGE_CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  bmp: 'image/bmp',
};

/**
 * Manages [Content_Types].xml — ensures all needed content types are declared.
 */
export class ContentTypesMerger {
  private doc: Document;
  private rootElement: Element;
  private existingExtensions: Set<string>;

  constructor(contentTypesXml: string) {
    this.doc = parseXml(contentTypesXml);
    this.rootElement = this.doc.documentElement;

    // Collect existing Default extensions
    this.existingExtensions = new Set<string>();
    const defaults = Array.from(this.rootElement.getElementsByTagNameNS(CONTENT_TYPES_NS, 'Default'));
    for (const el of defaults) {
      const ext = el.getAttribute('Extension');
      if (ext) this.existingExtensions.add(ext.toLowerCase());
    }
  }

  /** Ensure a file extension has a Default content type entry. */
  ensureExtension(ext: string): void {
    const lower = ext.toLowerCase();
    if (this.existingExtensions.has(lower)) return;

    const contentType = IMAGE_CONTENT_TYPES[lower];
    if (!contentType) return; // Unknown extension, skip

    const defaultEl = this.doc.createElementNS(CONTENT_TYPES_NS, 'Default');
    defaultEl.setAttribute('Extension', lower);
    defaultEl.setAttribute('ContentType', contentType);
    this.rootElement.appendChild(defaultEl);
    this.existingExtensions.add(lower);
  }

  /** Add an Override entry for a specific part (e.g., numbering.xml). */
  addOverride(partName: string, contentType: string): void {
    // Check if override already exists
    const overrides = Array.from(this.rootElement.getElementsByTagNameNS(CONTENT_TYPES_NS, 'Override'));
    for (const el of overrides) {
      if (el.getAttribute('PartName') === partName) return;
    }

    const overrideEl = this.doc.createElementNS(CONTENT_TYPES_NS, 'Override');
    overrideEl.setAttribute('PartName', partName);
    overrideEl.setAttribute('ContentType', contentType);
    this.rootElement.appendChild(overrideEl);
  }

  /** Serialize the updated Content_Types XML. */
  serialize(): string {
    return new XMLSerializer().serializeToString(this.doc);
  }
}
