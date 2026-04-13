import JSZip from 'jszip';
import type { DocxArchive, Relationship } from './types';
import { parseXml, getElements, NS } from '../parser/xmlUtils';

/**
 * Parse a .docx file (ZIP archive) and extract its raw contents.
 */
export async function parseDocxArchive(file: File | ArrayBuffer): Promise<DocxArchive> {
  const zip = await JSZip.loadAsync(file);

  const documentXml = await readZipText(zip, 'word/document.xml');
  const relationshipsXml = await readZipText(zip, 'word/_rels/document.xml.rels');
  const contentTypesXml = await readZipText(zip, '[Content_Types].xml');
  const numberingXml = await readZipTextOptional(zip, 'word/numbering.xml');
  const stylesXml = await readZipTextOptional(zip, 'word/styles.xml');

  // Extract all media files
  const mediaFiles = new Map<string, Uint8Array>();
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (path.startsWith('word/media/') && !zipEntry.dir) {
      const fileName = path.replace('word/media/', '');
      const data = await zipEntry.async('uint8array');
      mediaFiles.set(fileName, data);
    }
  }

  // Collect other files (for Phase 2 template reconstruction)
  const otherFiles = new Map<string, Uint8Array>();
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (!zipEntry.dir
      && path !== 'word/document.xml'
      && path !== 'word/_rels/document.xml.rels'
      && path !== '[Content_Types].xml'
      && !path.startsWith('word/media/')) {
      const data = await zipEntry.async('uint8array');
      otherFiles.set(path, data);
    }
  }

  return {
    documentXml,
    relationshipsXml,
    numberingXml,
    stylesXml,
    mediaFiles,
    contentTypesXml,
    otherFiles,
  };
}

/**
 * Parse the relationships XML into an array of Relationship objects.
 */
export function parseRelationships(relsXml: string): Relationship[] {
  const doc = parseXml(relsXml);
  const relElements = getElements(doc, NS.rels, 'Relationship');
  return relElements.map((el) => ({
    id: el.getAttribute('Id') || '',
    type: el.getAttribute('Type') || '',
    target: el.getAttribute('Target') || '',
    targetMode: el.getAttribute('TargetMode') || undefined,
  }));
}

async function readZipText(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) {
    throw new Error(`Required file not found in .docx: ${path}`);
  }
  return entry.async('string');
}

async function readZipTextOptional(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  return entry.async('string');
}
