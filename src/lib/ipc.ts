import { invoke } from "@tauri-apps/api/core";
import type {
  CommitInfo,
  GitFileStatus,
  NoteContent,
  SearchResult,
  Settings,
  SyncResult,
  VaultEntry,
} from "./types";

export const ipc = {
  getSettings: () => invoke<Settings>("get_settings"),
  updateSettings: (settings: Settings) =>
    invoke<void>("update_settings", { settings }),

  createVault: (path: string, withSample: boolean) =>
    invoke<void>("create_vault", { path, withSample }),
  openVault: (path: string) => invoke<void>("open_vault", { path }),
  listVault: (vault: string) => invoke<VaultEntry[]>("list_vault", { vault }),
  getEntry: (vault: string, path: string) =>
    invoke<VaultEntry>("get_entry", { vault, path }),

  readNote: (vault: string, path: string) =>
    invoke<NoteContent>("read_note", { vault, path }),
  saveNoteContent: (vault: string, path: string, body: string) =>
    invoke<void>("save_note_content", { vault, path, body }),
  saveNoteFrontmatter: (
    vault: string,
    path: string,
    frontmatter: Record<string, unknown>,
  ) => invoke<void>("save_note_frontmatter", { vault, path, frontmatter }),
  createNote: (
    vault: string,
    title: string,
    noteType?: string | null,
    folder?: string | null,
  ) =>
    invoke<string>("create_note", {
      vault,
      title,
      noteType: noteType ?? null,
      folder: folder ?? null,
    }),
  deleteNote: (vault: string, path: string) =>
    invoke<void>("delete_note", { vault, path }),
  renameNote: (vault: string, path: string, newTitle: string) =>
    invoke<string>("rename_note", { vault, path, newTitle }),
  toggleStar: (vault: string, path: string) =>
    invoke<boolean>("toggle_star", { vault, path }),

  searchVault: (vault: string, query: string) =>
    invoke<SearchResult[]>("search_vault", { vault, query }),

  gitStatus: (vault: string) => invoke<GitFileStatus[]>("git_status", { vault }),
  gitLog: (vault: string, skip: number, limit: number) =>
    invoke<CommitInfo[]>("git_log", { vault, skip, limit }),
  gitFileLog: (vault: string, path: string, limit: number) =>
    invoke<CommitInfo[]>("git_file_log", { vault, path, limit }),
  gitDiff: (vault: string, hash: string, path?: string | null) =>
    invoke<string>("git_diff", { vault, hash, path: path ?? null }),
  gitCommit: (vault: string, message: string) =>
    invoke<boolean>("git_commit", { vault, message }),
  gitSync: (vault: string) => invoke<SyncResult>("git_sync", { vault }),
  gitHasRemote: (vault: string) => invoke<boolean>("git_has_remote", { vault }),
};
