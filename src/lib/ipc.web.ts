// Web (fetch-based) implementation of the IPC layer.
// Vite aliases this file over ipc.ts when building with VITE_BUILD_TARGET=web.
// All `vault` parameters are ignored — the server always uses its VAULT_PATH env var.

import type {
  CommitInfo,
  GitFileStatus,
  NoteContent,
  SearchResult,
  Settings,
  SyncResult,
  VaultEntry,
} from "./types";

const TOKEN_KEY = "vault_token";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getToken();
  if (!token) {
    window.dispatchEvent(new Event("vault:auth-failed"));
    throw new Error("No auth token");
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("vault:auth-failed"));
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const ipc = {
  getSettings: () => api<Settings>("GET", "/settings"),
  updateSettings: (settings: Settings) =>
    api<void>("POST", "/settings", { settings }),

  // Vault creation/selection is desktop-only; the server vault is fixed via env var.
  createVault: () => Promise.resolve(),
  openVault: () => Promise.resolve(),

  listVault: (_vault: string) => api<VaultEntry[]>("GET", "/vault/list"),
  getEntry: (_vault: string, path: string) =>
    api<VaultEntry>("GET", `/vault/entry?path=${encodeURIComponent(path)}`),

  readNote: (_vault: string, path: string) =>
    api<NoteContent>("GET", `/vault/note?path=${encodeURIComponent(path)}`),
  saveNoteContent: (_vault: string, path: string, body: string) =>
    api<void>("POST", "/vault/note/content", { path, body }),
  saveNoteFrontmatter: (
    _vault: string,
    path: string,
    frontmatter: Record<string, unknown>,
  ) => api<void>("POST", "/vault/note/frontmatter", { path, frontmatter }),
  createNote: (
    _vault: string,
    title: string,
    noteType?: string | null,
    folder?: string | null,
  ) =>
    api<string>("POST", "/vault/note/create", {
      title,
      noteType: noteType ?? null,
      folder: folder ?? null,
    }),
  deleteNote: (_vault: string, path: string) =>
    api<void>("DELETE", `/vault/note?path=${encodeURIComponent(path)}`),
  renameNote: (_vault: string, path: string, newTitle: string) =>
    api<string>("POST", "/vault/note/rename", { path, newTitle }),
  toggleStar: (_vault: string, path: string) =>
    api<boolean>("POST", "/vault/note/star", { path }),

  searchVault: (_vault: string, query: string) =>
    api<SearchResult[]>("GET", `/search?q=${encodeURIComponent(query)}`),

  gitStatus: (_vault: string) => api<GitFileStatus[]>("GET", "/git/status"),
  gitLog: (_vault: string, skip: number, limit: number) =>
    api<CommitInfo[]>("GET", `/git/log?skip=${skip}&limit=${limit}`),
  gitFileLog: (_vault: string, path: string, limit: number) =>
    api<CommitInfo[]>(
      "GET",
      `/git/file-log?path=${encodeURIComponent(path)}&limit=${limit}`,
    ),
  gitDiff: (_vault: string, hash: string, path?: string | null) =>
    api<string>(
      "GET",
      `/git/diff?hash=${encodeURIComponent(hash)}${path ? `&path=${encodeURIComponent(path)}` : ""}`,
    ),
  gitCommit: (_vault: string, message: string) =>
    api<boolean>("POST", "/git/commit", { message }),
  gitSync: (_vault: string) =>
    api<SyncResult>("POST", "/git/sync", {}),
  gitHasRemote: (_vault: string) => api<boolean>("GET", "/git/has-remote"),
};
