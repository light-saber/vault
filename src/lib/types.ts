export type Frontmatter = Record<string, unknown>;

export interface VaultEntry {
  path: string;
  title: string;
  noteType: string | null;
  status: string | null;
  tags: string[];
  snippet: string;
  modified: number;
  created: number;
  frontmatter: Frontmatter | null;
  belongsTo: string[];
  relatedTo: string[];
  has: string[];
  wikilinks: string[];
  starred: boolean;
}

export interface NoteContent {
  frontmatter: Frontmatter | null;
  body: string;
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export interface GitFileStatus {
  path: string;
  status: string;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  timestamp: number;
  files: string[];
}

export type SyncStateKind =
  | "synced"
  | "syncing"
  | "pullRequired"
  | "conflict"
  | "error"
  | "noRemote"
  | "dirty";

export interface SyncResult {
  state: string;
  message: string;
  conflicts: string[];
}

export interface Settings {
  vaultPath: string | null;
  editorMode: "rich" | "raw" | null;
  zoom: number | null;
  autoGitMinutes: number | null;
  autoSyncMinutes: number | null;
  lastNote: string | null;
  inspectorOpen: boolean | null;
}

export const defaultSettings: Settings = {
  vaultPath: null,
  editorMode: "rich",
  zoom: 1,
  autoGitMinutes: 5,
  autoSyncMinutes: 10,
  lastNote: null,
  inspectorOpen: true,
};

export type Filter =
  | { kind: "all" }
  | { kind: "inbox" }
  | { kind: "starred" }
  | { kind: "changes" }
  | { kind: "pulse" }
  | { kind: "type"; type: string };

export type SortKey = "modified" | "created" | "title" | "status";

export type SaveStatus = "saved" | "saving" | "dirty" | "error";

export interface TypeDef {
  slug: string;
  title: string;
  icon: string;
  color: string;
  path: string;
}
