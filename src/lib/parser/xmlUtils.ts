/** OOXML namespace URIs */
export const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  wps: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
  mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
  v: 'urn:schemas-microsoft-com:vml',
  rels: 'http://schemas.openxmlformats.org/package/2006/relationships',
} as const;

/** Parse an XML string into a Document using DOMParser */
export function parseXml(xmlString: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    throw new Error(`XML parse error: ${errorNode.textContent}`);
  }
  return doc;
}

/** Get all child elements matching a namespace + local name */
export function getElements(parent: Element | Document, nsUri: string, localName: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS(nsUri, localName));
}

/** Get first child element matching namespace + local name, or null */
export function getFirstElement(parent: Element | Document, nsUri: string, localName: string): Element | null {
  return parent.getElementsByTagNameNS(nsUri, localName)[0] ?? null;
}

/** Get direct children of an element matching a namespace + local name */
export function getDirectChildren(parent: Element, nsUri: string, localName: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      if (el.localName === localName && el.namespaceURI === nsUri) {
        result.push(el);
      }
    }
  }
  return result;
}

/** Get the w:val attribute value from an element */
export function getWVal(element: Element): string | null {
  // Try namespaced attribute first, then prefixed
  return element.getAttributeNS(NS.w, 'val') || element.getAttribute('w:val') || null;
}

/** Get an attribute value, trying namespaced then prefixed forms */
export function getAttr(element: Element, nsUri: string | null, attrName: string): string | null {
  if (nsUri) {
    const val = element.getAttributeNS(nsUri, attrName);
    if (val) return val;
  }
  return element.getAttribute(attrName) || null;
}

/** Serialize an element back to XML string */
export function serializeElement(element: Element): string {
  return new XMLSerializer().serializeToString(element);
}

/** Get all direct child elements (any namespace) */
export function getChildElements(parent: Element): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      result.push(child as Element);
    }
  }
  return result;
}
