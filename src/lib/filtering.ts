import type { Filter, GitFileStatus, SortKey, TypeDef, VaultEntry } from "./types";
import { fileStem } from "./wikilinks";

/** Type definitions are notes with `type: type` (PRD 6.2.2). */
export function typeDefs(entries: VaultEntry[]): TypeDef[] {
  return entries
    .filter((e) => e.noteType === "type")
    .map((e) => ({
      slug: fileStem(e.path).toLowerCase(),
      title: e.title,
      icon: str(e.frontmatter?.icon) ?? "file-text",
      color: str(e.frontmatter?.color) ?? "gray",
      path: e.path,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Distinct in-use type slugs that have no definition note, e.g. ad-hoc types. */
export function undefinedTypes(entries: VaultEntry[], defs: TypeDef[]): string[] {
  const known = new Set(defs.map((d) => d.slug));
  const seen = new Set<string>();
  for (const e of entries) {
    if (e.noteType && e.noteType !== "type" && !known.has(e.noteType)) {
      seen.add(e.noteType);
    }
  }
  return [...seen].sort();
}

export function entriesOfType(entries: VaultEntry[], slug: string): VaultEntry[] {
  return entries.filter((e) => e.noteType === slug);
}

export function filterEntries(
  entries: VaultEntry[],
  filter: Filter,
  changed: GitFileStatus[],
): VaultEntry[] {
  switch (filter.kind) {
    case "all":
      return entries.filter((e) => e.noteType !== "type");
    case "inbox":
      return entries.filter((e) => e.noteType === null);
    case "changes": {
      const changedPaths = new Set(changed.map((c) => c.path));
      return entries.filter((e) => changedPaths.has(e.path));
    }
    case "type":
      return entriesOfType(entries, filter.type);
    case "pulse":
      return [];
  }
}

export function sortEntries(entries: VaultEntry[], sort: SortKey): VaultEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case "modified":
      sorted.sort((a, b) => b.modified - a.modified);
      break;
    case "created":
      sorted.sort((a, b) => b.created - a.created);
      break;
    case "title":
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "status":
      sorted.sort(
        (a, b) =>
          (a.status ?? "￿").localeCompare(b.status ?? "￿") ||
          b.modified - a.modified,
      );
      break;
  }
  return sorted;
}

export function filterLabel(filter: Filter, defs: TypeDef[]): string {
  switch (filter.kind) {
    case "all":
      return "All Notes";
    case "inbox":
      return "Inbox";
    case "changes":
      return "Changes";
    case "pulse":
      return "Pulse";
    case "type":
      return defs.find((d) => d.slug === filter.type)?.title ?? filter.type;
  }
}
