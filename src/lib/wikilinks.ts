import type { VaultEntry } from "./types";

export const WIKILINK_RE = /\[\[([^[\]]+?)\]\]/g;

export type WikiSegment =
  | { kind: "text"; text: string }
  | { kind: "wikilink"; title: string };

/** Split text into plain segments and wikilink segments. */
export function splitWikilinks(text: string): WikiSegment[] {
  const segments: WikiSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(WIKILINK_RE)) {
    const idx = match.index ?? 0;
    if (idx > last) segments.push({ kind: "text", text: text.slice(last, idx) });
    const target = match[1].split("|")[0].split("#")[0].trim();
    if (target) segments.push({ kind: "wikilink", title: target });
    last = idx + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}

/**
 * Restore `[[wikilink]]` syntax in Markdown produced by the block editor,
 * which escapes square brackets (PRD 8.2 postProcessWikilinks).
 */
export function postProcessWikilinks(markdown: string): string {
  return markdown.replace(/\\([[\]])/g, "$1");
}

/** Resolve a wikilink target against vault entries: title first, then filename. */
export function resolveWikilink(
  entries: VaultEntry[],
  target: string,
): VaultEntry | undefined {
  const t = target.trim().toLowerCase();
  return (
    entries.find((e) => e.title.toLowerCase() === t) ??
    entries.find((e) => fileStem(e.path).toLowerCase() === t)
  );
}

export function fileStem(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.md$/, "");
}

/** Entries whose body wikilinks or frontmatter relations point at `entry`. */
export function backlinksFor(
  entries: VaultEntry[],
  entry: VaultEntry,
): VaultEntry[] {
  const names = new Set(
    [entry.title.toLowerCase(), fileStem(entry.path).toLowerCase()].filter(Boolean),
  );
  const pointsHere = (targets: string[]) =>
    targets.some((t) => names.has(t.toLowerCase()));
  return entries.filter(
    (e) =>
      e.path !== entry.path &&
      (pointsHere(e.wikilinks) ||
        pointsHere(e.belongsTo) ||
        pointsHere(e.relatedTo) ||
        pointsHere(e.has)),
  );
}

export function wordCount(markdown: string): number {
  return markdown.split(/\s+/).filter((w) => /\w/.test(w)).length;
}

/**
 * Walk parsed BlockNote blocks and convert `[[Title]]` occurrences inside
 * styled-text runs into wikilink inline content nodes.
 */
// Blocks are treated structurally; BlockNote's own types are applied at the call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function injectWikilinksIntoBlocks(blocks: any[]): any[] {
  return blocks.map((block) => {
    const next = { ...block };
    if (Array.isArray(block.content)) {
      next.content = block.content.flatMap(transformInline);
    }
    if (Array.isArray(block.children) && block.children.length > 0) {
      next.children = injectWikilinksIntoBlocks(block.children);
    }
    return next;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformInline(item: any): any[] {
  if (item?.type !== "text" || typeof item.text !== "string") return [item];
  if (!item.text.includes("[[")) return [item];
  const segments = splitWikilinks(item.text);
  if (segments.length === 1 && segments[0].kind === "text") return [item];
  return segments.map((seg) =>
    seg.kind === "text"
      ? { ...item, text: seg.text }
      : { type: "wikilink", props: { title: seg.title } },
  );
}
