import { emit, listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import { ipc } from "../lib/ipc";
import type {
  Filter,
  GitFileStatus,
  NoteContent,
  SaveStatus,
  Settings,
  SortKey,
  SyncStateKind,
  VaultEntry,
} from "../lib/types";
import { defaultSettings } from "../lib/types";

interface VaultState {
  booted: boolean;
  settings: Settings;
  entries: VaultEntry[];
  loading: boolean;
  loadError: string | null;

  filter: Filter;
  sort: SortKey;
  activePath: string | null;
  note: NoteContent | null;
  noteKey: number;
  saveStatus: SaveStatus;
  wordCount: number;

  rawMode: boolean;
  inspectorOpen: boolean;
  paletteOpen: boolean;
  quickOpenOpen: boolean;
  searchOpen: boolean;
  commitOpen: boolean;
  settingsOpen: boolean;

  history: string[];
  historyIndex: number;

  changedFiles: GitFileStatus[];
  syncState: SyncStateKind;
  syncMessage: string;
  conflicts: string[];
  lastEditAt: number;

  init: () => Promise<void>;
  setVault: (path: string) => Promise<void>;
  loadVault: () => Promise<void>;
  refreshEntry: (path: string) => Promise<void>;
  refreshChanges: () => Promise<void>;

  openNote: (path: string, opts?: { history?: boolean }) => Promise<void>;
  closeNote: () => void;
  goBack: () => void;
  goForward: () => void;
  createNote: (title?: string, noteType?: string | null) => Promise<void>;
  deleteActive: () => Promise<void>;
  renameActive: (title: string) => Promise<void>;
  saveBody: (body: string) => Promise<void>;
  saveFrontmatter: (fm: Record<string, unknown>) => Promise<void>;

  setFilter: (filter: Filter) => void;
  setSort: (sort: SortKey) => void;
  setRawMode: (raw: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setQuickOpenOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setCommitOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setWordCount: (n: number) => void;
  setSaveStatus: (s: SaveStatus) => void;

  commit: (message: string) => Promise<boolean>;
  sync: () => Promise<void>;
  patchSettings: (patch: Partial<Settings>) => Promise<void>;
}

export const useVault = create<VaultState>((set, get) => {
  const persist = async (patch: Partial<Settings>) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    try {
      await ipc.updateSettings(settings);
    } catch {
      // settings persistence is best-effort
    }
  };

  return {
    booted: false,
    settings: defaultSettings,
    entries: [],
    loading: false,
    loadError: null,

    filter: { kind: "all" },
    sort: "modified",
    activePath: null,
    note: null,
    noteKey: 0,
    saveStatus: "saved",
    wordCount: 0,

    rawMode: false,
    inspectorOpen: true,
    paletteOpen: false,
    quickOpenOpen: false,
    searchOpen: false,
    commitOpen: false,
    settingsOpen: false,

    history: [],
    historyIndex: -1,

    changedFiles: [],
    syncState: "noRemote",
    syncMessage: "",
    conflicts: [],
    lastEditAt: 0,

    init: async () => {
      if (get().booted) return;
      let settings = defaultSettings;
      try {
        settings = { ...defaultSettings, ...(await ipc.getSettings()) };
      } catch {
        // first launch, no settings file yet
      }
      set({
        settings,
        booted: true,
        rawMode: settings.editorMode === "raw",
        inspectorOpen: settings.inspectorOpen ?? true,
      });
      if (settings.vaultPath) {
        await get().loadVault();
        // Secondary editor windows open their own note, not the last one.
        const secondary = new URLSearchParams(window.location.search).get("note");
        const last = get().settings.lastNote;
        if (!secondary && last && get().entries.some((e) => e.path === last)) {
          await get().openNote(last);
        }
      }
      // Refresh entries when another window saves a note.
      await listen<{ path: string }>("vault:note-saved", (event) => {
        void get().refreshEntry(event.payload.path);
      });
    },

    setVault: async (path) => {
      await persist({ vaultPath: path, lastNote: null });
      set({
        activePath: null,
        note: null,
        history: [],
        historyIndex: -1,
        filter: { kind: "all" },
      });
      await get().loadVault();
    },

    loadVault: async () => {
      const vault = get().settings.vaultPath;
      if (!vault) return;
      set({ loading: true, loadError: null });
      try {
        const entries = await ipc.listVault(vault);
        set({ entries, loading: false });
        void get().refreshChanges();
        void ipc
          .gitHasRemote(vault)
          .then((has) => set({ syncState: has ? "synced" : "noRemote" }))
          .catch(() => {});
      } catch (e) {
        set({ loading: false, loadError: String(e) });
      }
    },

    refreshEntry: async (path) => {
      const vault = get().settings.vaultPath;
      if (!vault) return;
      try {
        const entry = await ipc.getEntry(vault, path);
        set((s) => {
          const idx = s.entries.findIndex((e) => e.path === path);
          const entries =
            idx >= 0
              ? s.entries.map((e, i) => (i === idx ? entry : e))
              : [...s.entries, entry];
          return { entries };
        });
      } catch {
        // note may have been deleted externally
        set((s) => ({ entries: s.entries.filter((e) => e.path !== path) }));
      }
    },

    refreshChanges: async () => {
      const vault = get().settings.vaultPath;
      if (!vault) return;
      try {
        const changedFiles = await ipc.gitStatus(vault);
        set({ changedFiles });
      } catch {
        set({ changedFiles: [] });
      }
    },

    openNote: async (path, opts) => {
      const vault = get().settings.vaultPath;
      if (!vault) return;
      try {
        const note = await ipc.readNote(vault, path);
        set((s) => {
          let history = s.history;
          let historyIndex = s.historyIndex;
          if (opts?.history !== false && s.history[s.historyIndex] !== path) {
            history = [...s.history.slice(0, s.historyIndex + 1), path];
            historyIndex = history.length - 1;
          }
          return {
            note,
            activePath: path,
            noteKey: s.noteKey + 1,
            saveStatus: "saved",
            history,
            historyIndex,
          };
        });
        // Secondary windows must not clobber the main window's last note.
        if (!new URLSearchParams(window.location.search).get("note")) {
          void persist({ lastNote: path });
        }
      } catch (e) {
        set({ loadError: String(e) });
      }
    },

    closeNote: () => set({ activePath: null, note: null }),

    goBack: () => {
      const { history, historyIndex } = get();
      if (historyIndex > 0) {
        const path = history[historyIndex - 1];
        set({ historyIndex: historyIndex - 1 });
        void get().openNote(path, { history: false });
      }
    },

    goForward: () => {
      const { history, historyIndex } = get();
      if (historyIndex < history.length - 1) {
        const path = history[historyIndex + 1];
        set({ historyIndex: historyIndex + 1 });
        void get().openNote(path, { history: false });
      }
    },

    createNote: async (title = "Untitled", noteType = null) => {
      const vault = get().settings.vaultPath;
      if (!vault) return;
      const filter = get().filter;
      const type =
        noteType ?? (filter.kind === "type" ? filter.type : null);
      const path = await ipc.createNote(vault, title, type);
      await get().refreshEntry(path);
      await get().openNote(path);
      set({ lastEditAt: Date.now() });
    },

    deleteActive: async () => {
      const vault = get().settings.vaultPath;
      const path = get().activePath;
      if (!vault || !path) return;
      await ipc.deleteNote(vault, path);
      set((s) => ({
        entries: s.entries.filter((e) => e.path !== path),
        activePath: null,
        note: null,
        history: s.history.filter((h) => h !== path),
        historyIndex: -1,
        lastEditAt: Date.now(),
      }));
      void get().refreshChanges();
    },

    renameActive: async (title) => {
      const vault = get().settings.vaultPath;
      const path = get().activePath;
      if (!vault || !path || !title.trim()) return;
      const newPath = await ipc.renameNote(vault, path, title.trim());
      set((s) => ({
        entries: s.entries.filter((e) => e.path !== path),
        activePath: newPath,
        history: s.history.map((h) => (h === path ? newPath : h)),
        lastEditAt: Date.now(),
      }));
      await get().refreshEntry(newPath);
      void persist({ lastNote: newPath });
    },

    // Disk-first write rule (PRD 7.2): if the disk write fails, React state
    // keeps the dirty/error status and is not marked saved.
    saveBody: async (body) => {
      const vault = get().settings.vaultPath;
      const path = get().activePath;
      if (!vault || !path) return;
      set({ saveStatus: "saving" });
      try {
        await ipc.saveNoteContent(vault, path, body);
        set((s) => ({
          saveStatus: "saved",
          lastEditAt: Date.now(),
          note: s.note ? { ...s.note, body } : s.note,
        }));
        await get().refreshEntry(path);
        void get().refreshChanges();
        void emit("vault:note-saved", { path });
      } catch {
        set({ saveStatus: "error" });
      }
    },

    saveFrontmatter: async (fm) => {
      const vault = get().settings.vaultPath;
      const path = get().activePath;
      if (!vault || !path) return;
      try {
        await ipc.saveNoteFrontmatter(vault, path, fm);
        set((s) => ({
          note: s.note ? { ...s.note, frontmatter: fm } : s.note,
          lastEditAt: Date.now(),
        }));
        await get().refreshEntry(path);
        void get().refreshChanges();
      } catch {
        set({ saveStatus: "error" });
      }
    },

    setFilter: (filter) => {
      set({ filter, searchOpen: false });
      if (filter.kind === "changes") void get().refreshChanges();
    },
    setSort: (sort) => set({ sort }),
    setRawMode: (raw) => {
      set({ rawMode: raw });
      void persist({ editorMode: raw ? "raw" : "rich" });
    },
    setInspectorOpen: (open) => {
      set({ inspectorOpen: open });
      void persist({ inspectorOpen: open });
    },
    setPaletteOpen: (open) => set({ paletteOpen: open }),
    setQuickOpenOpen: (open) => set({ quickOpenOpen: open }),
    setSearchOpen: (open) => set({ searchOpen: open }),
    setCommitOpen: (open) => set({ commitOpen: open }),
    setSettingsOpen: (open) => set({ settingsOpen: open }),
    setWordCount: (n) => set({ wordCount: n }),
    setSaveStatus: (s) => set({ saveStatus: s }),

    commit: async (message) => {
      const vault = get().settings.vaultPath;
      if (!vault) return false;
      const committed = await ipc.gitCommit(vault, message);
      await get().refreshChanges();
      return committed;
    },

    sync: async () => {
      const vault = get().settings.vaultPath;
      if (!vault) return;
      set({ syncState: "syncing", syncMessage: "" });
      try {
        const result = await ipc.gitSync(vault);
        set({
          syncState: result.state as SyncStateKind,
          syncMessage: result.message,
          conflicts: result.conflicts,
        });
        if (result.state === "synced") await get().loadVault();
      } catch (e) {
        set({ syncState: "error", syncMessage: String(e) });
      }
    },

    patchSettings: persist,
  };
});
