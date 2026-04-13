import type { Relationship, ImageRef } from '../docx/types';
import { NS } from './xmlUtils';

/**
 * Build a map from relationship ID to file name for image relationships.
 */
export function buildRelIdToFileName(relationships: Relationship[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const rel of relationships) {
    if (rel.type.includes('/image')) {
      // target is like "media/image1.png", extract just the filename
      const fileName = rel.target.replace(/^media\//, '');
      map.set(rel.id, fileName);
    }
  }
  return map;
}

/**
 * Resolve an image reference from a drawing container element
 * (wp:inline or wp:anchor).
 * Returns null if no blip reference is found.
 */
export function resolveImageRef(
  container: Element,
  relIdToFileName: Map<string, string>,
): ImageRef | null {
  // Look for <a:blip r:embed="rIdXX">
  const blips = container.getElementsByTagNameNS(NS.a, 'blip');
  if (blips.length === 0) return null;

  const blip = blips[0];
  const relId = blip.getAttributeNS(NS.r, 'embed')
    || blip.getAttribute('r:embed')
    || '';

  if (!relId) return null;

  const fileName = relIdToFileName.get(relId) || relId;

  // Try to get dimensions from extent element
  let widthEmu: number | undefined;
  let heightEmu: number | undefined;

  const extents = container.getElementsByTagNameNS(NS.wp, 'extent');
  if (extents.length > 0) {
    const extent = extents[0];
    const cx = extent.getAttribute('cx');
    const cy = extent.getAttribute('cy');
    if (cx) widthEmu = parseInt(cx, 10);
    if (cy) heightEmu = parseInt(cy, 10);
  }

  return { relationshipId: relId, fileName, widthEmu, heightEmu };
}
