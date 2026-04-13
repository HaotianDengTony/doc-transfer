import type { BodyChild, SectionNode } from '../docx/types';

/**
 * Build a section tree from the flat list of body children.
 * Sections are organized by heading level: H1 > H2 > H3 > H4.
 */
export function buildSectionTree(bodyChildren: BodyChild[]): SectionNode[] {
  const rootSections: SectionNode[] = [];
  // Stack of currently open sections, indexed by level (1-4)
  const stack: (SectionNode | null)[] = [null, null, null, null, null]; // index 0 unused

  for (let i = 0; i < bodyChildren.length; i++) {
    const child = bodyChildren[i];

    if (child.type === 'paragraph' && child.data.headingLevel !== null) {
      const level = child.data.headingLevel;
      const heading = child.data;

      // Create new section node
      const section: SectionNode = {
        heading,
        headingText: cleanHeadingText(heading.text),
        level,
        children: [],
        bodyContent: [],
        allContent: [],
        bodyChildIndexStart: i,
        bodyChildIndexEnd: i + 1, // will be updated
      };

      // Close all sections at this level or deeper
      for (let l = level; l <= 4; l++) {
        if (stack[l]) {
          stack[l]!.bodyChildIndexEnd = i;
          stack[l] = null;
        }
      }

      // Attach to parent section (nearest open section at a higher level)
      let attached = false;
      for (let l = level - 1; l >= 1; l--) {
        if (stack[l]) {
          stack[l]!.children.push(section);
          attached = true;
          break;
        }
      }
      if (!attached) {
        rootSections.push(section);
      }

      stack[level] = section;
    } else {
      // Non-heading content: attach to the deepest open section
      for (let l = 4; l >= 1; l--) {
        if (stack[l]) {
          stack[l]!.bodyContent.push(child);
          break;
        }
      }
      // If no section is open, this content is before any heading (ignored)
    }
  }

  // Close all remaining open sections
  for (let l = 1; l <= 4; l++) {
    if (stack[l]) {
      stack[l]!.bodyChildIndexEnd = bodyChildren.length;
    }
  }

  // Compute allContent recursively
  for (const section of rootSections) {
    computeAllContent(section);
  }

  return rootSections;
}

/**
 * Recursively compute allContent for a section:
 * bodyContent + all children's allContent (including their headings)
 */
function computeAllContent(section: SectionNode): void {
  // First recurse into children
  for (const child of section.children) {
    computeAllContent(child);
  }

  // allContent = direct body content interleaved with children's content in document order
  // We rebuild from the body child index range
  section.allContent = [...section.bodyContent];

  for (const child of section.children) {
    // Add the child's heading as a paragraph body child
    section.allContent.push({ type: 'paragraph', data: child.heading });
    // Add all of the child's content
    section.allContent.push(...child.allContent);
  }

  // Sort by body child index to maintain document order
  section.allContent.sort((a, b) => {
    const indexA = a.type === 'paragraph' ? a.data.bodyChildIndex : a.data.bodyChildIndex;
    const indexB = b.type === 'paragraph' ? b.data.bodyChildIndex : b.data.bodyChildIndex;
    return indexA - indexB;
  });
}

/**
 * Find a section by navigating a path of heading texts.
 * Uses fuzzy matching: heading text must include the search term (after cleaning).
 *
 * For the first path element, searches only in the provided tree (top-level).
 * For subsequent elements, first tries direct children; if not found,
 * searches recursively in all descendants. This handles cases where
 * H3 sections are nested under unexpected H2 parents.
 *
 * Example: findSection(tree, ["试剂", "储存和稳定性"])
 *   → finds H1 "试剂" → H2 "储存和稳定性"
 * Example: findSection(tree, ["程序", "主曲线定义"])
 *   → finds H1 "程序" → searches descendants for H3 "主曲线定义"
 */
export function findSection(tree: SectionNode[], path: string[]): SectionNode | null {
  if (path.length === 0) return null;

  let currentLevel = tree;
  let found: SectionNode | null = null;

  for (let i = 0; i < path.length; i++) {
    const cleaned = cleanHeadingText(path[i]);
    found = null;

    // First try direct children (exact match first, then fuzzy)
    found = findInList(currentLevel, cleaned);

    // If not found in direct children, search recursively in descendants
    if (!found && i > 0) {
      found = searchDescendants(currentLevel, cleaned);
    }

    if (!found) return null;
    currentLevel = found.children;
  }

  return found;
}

/**
 * Find a section in a list. Prefers exact match, falls back to fuzzy.
 * Fuzzy: heading includes search term, but only if the search term
 * is not a substring that matches unrelated headings.
 */
function findInList(sections: SectionNode[], searchTerm: string): SectionNode | null {
  // Pass 1: exact match
  for (const section of sections) {
    if (section.headingText === searchTerm) return section;
  }
  // Pass 2: heading starts with search term (e.g., search "程序" matches "程序 ")
  for (const section of sections) {
    if (section.headingText.startsWith(searchTerm)) return section;
  }
  // Pass 3: search term starts with heading (e.g., heading "程序" matches search "程序...")
  for (const section of sections) {
    if (searchTerm.startsWith(section.headingText)) return section;
  }
  // Pass 4: bidirectional includes (loosest match)
  for (const section of sections) {
    if (section.headingText.includes(searchTerm) || searchTerm.includes(section.headingText)) {
      return section;
    }
  }
  return null;
}

/** Recursively search all descendants for a heading match */
function searchDescendants(sections: SectionNode[], searchTerm: string): SectionNode | null {
  // First try all nodes at this level, then recurse deeper
  const found = findInList(sections, searchTerm);
  if (found) return found;

  for (const section of sections) {
    const deepFound = searchDescendants(section.children, searchTerm);
    if (deepFound) return deepFound;
  }
  return null;
}

/**
 * Get section content excluding specific sub-sections by heading text.
 * Used for performance section (exclude "标准化").
 */
export function getSectionContentExcluding(
  section: SectionNode,
  excludeHeadings: string[],
): BodyChild[] {
  const excludeSet = new Set(excludeHeadings.map(h => cleanHeadingText(h)));

  const result: BodyChild[] = [...section.bodyContent];

  for (const child of section.children) {
    if (excludeSet.has(child.headingText)) continue;
    // Include child heading
    result.push({ type: 'paragraph', data: child.heading });
    // Include all child content recursively
    result.push(...child.allContent);
  }

  // Sort by document order
  result.sort((a, b) => {
    const indexA = a.type === 'paragraph' ? a.data.bodyChildIndex : a.data.bodyChildIndex;
    const indexB = b.type === 'paragraph' ? b.data.bodyChildIndex : b.data.bodyChildIndex;
    return indexA - indexB;
  });

  return result;
}

/**
 * Flat search: find the first section anywhere in the tree whose heading
 * fuzzy-matches `name`, regardless of nesting level.
 * Used as a fallback when all sectionPaths fail.
 */
export function findSectionAnywhere(tree: SectionNode[], name: string): SectionNode | null {
  const cleaned = cleanHeadingText(name);
  return searchDescendants(tree, cleaned);
}

/** Clean heading text: trim whitespace, collapse multiple spaces */
function cleanHeadingText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
