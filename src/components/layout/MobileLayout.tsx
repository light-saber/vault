import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CloudOff,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { relativeDate } from "../../lib/dates";
import {
  filterEntries,
  sortEntries,
  typeDefs,
} from "../../lib/filtering";
import { ipc } from "../../lib/ipc";
import type { Filter, SearchResult, VaultEntry } from "../../lib/types";
import { useVault } from "../../store/vaultStore";
import { CommitDialog } from "../git/CommitDialog";
import { SettingsModal } from "../settings/SettingsModal";
import { StatusChip } from "../ui";

const RichEditor = lazy(() =>
  import("../editor/RichEditor").then((m) => ({ default: m.RichEditor })),
);
const RawEditor = lazy(() =>
  import("../editor/RawEditor").then((m) => ({ default: m.RawEditor })),
);

export function MobileLayout() {
  const activePath = useVault((s) => s.activePath);
  const commitOpen = useVault((s) => s.commitOpen);
  const settingsOpen = useVault((s) => s.settingsOpen);
  const [view, setView] = useState<"list" | "editor">(
    activePath ? "editor" : "list",
  );

  useEffect(() => {
    if (activePath) setView("editor");
    else setView("list");
  }, [activePath]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-paper">
      {view === "list" ? (
        <MobileListView onOpenEditor={() => setView("editor")} />
      ) : (
        <MobileEditorView onBack={() => setView("list")} />
      )}
      {commitOpen && <CommitDialog />}
      {settingsOpen && <SettingsModal />}
    </div>
  );
}

function MobileListView({ onOpenEditor }: { onOpenEditor: () => void }) {
  const entries = useVault((s) => s.entries);
  const filter = useVault((s) => s.filter);
  const setFilter = useVault((s) => s.setFilter);
  const sort = useVault((s) => s.sort);
  const changed = useVault((s) => s.changedFiles);
  const activePath = useVault((s) => s.activePath);
  const openNote = useVault((s) => s.openNote);
  const createNote = useVault((s) => s.createNote);
  const toggleStar = useVault((s) => s.toggleStar);
  const setSettingsOpen = useVault((s) => s.setSettingsOpen);
  const syncState = useVault((s) => s.syncState);
  const syncMessage = useVault((s) => s.syncMessage);
  const sync = useVault((s) => s.sync);
  const [searchOpen, setSearchOpen] = useState(false);

  const defs = typeDefs(entries);
  const notes = entries.filter((e) => e.noteType !== "type");
  const list = sortEntries(filterEntries(entries, filter, changed), sort);

  const tabs: { filter: Filter; label: string; count?: number }[] = [
    { filter: { kind: "all" }, label: "All", count: notes.length },
    {
      filter: { kind: "inbox" },
      label: "Inbox",
      count: notes.filter((e) => e.noteType === null).length,
    },
    {
      filter: { kind: "starred" },
      label: "Starred",
      count: notes.filter((e) => e.starred).length,
    },
    {
      filter: { kind: "changes" },
      label: "Changes",
      count: changed.length,
    },
    ...defs.map((d) => ({
      filter: { kind: "type", type: d.slug } as Filter,
      label: d.title,
      count: entries.filter((e) => e.noteType === d.slug).length,
    })),
  ];

  const isActive = (f: Filter) => {
    if (f.kind !== filter.kind) return false;
    if (f.kind === "type" && filter.kind === "type")
      return f.type === filter.type;
    return true;
  };

  if (searchOpen) {
    return (
      <MobileSearch
        onClose={() => setSearchOpen(false)}
        onOpen={(path) => {
          void openNote(path);
          setSearchOpen(false);
          onOpenEditor();
        }}
      />
    );
  }

  return (
    <>
      <div
        className="hairline-b flex h-14 shrink-0 items-center gap-2 bg-paper px-4"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <span className="flex-1 font-display text-xl font-bold tracking-tight">
          Vault
        </span>
        <button
          onClick={() => setSearchOpen(true)}
          className="rounded-full p-2.5 text-ink-soft hover:bg-paper-deep"
        >
          <Search size={20} />
        </button>
        <button
          onClick={() => void createNote()}
          className="rounded-full p-2.5 text-ink-soft hover:bg-paper-deep"
        >
          <Plus size={20} />
        </button>
      </div>

      <div
        className="hairline-b flex shrink-0 gap-1.5 overflow-x-auto px-3 py-2"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab, i) => {
          const active = isActive(tab.filter);
          return (
            <button
              key={i}
              onClick={() => setFilter(tab.filter)}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-white"
                  : "bg-paper-deep text-ink-soft"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-xs tabular-nums ${active ? "text-white/70" : "text-ink-faint"}`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {list.length === 0 && (
          <p className="pt-16 text-center text-sm text-ink-faint">
            {filter.kind === "starred"
              ? "No starred notes yet."
              : filter.kind === "changes"
                ? "No uncommitted changes."
                : "No notes here."}
          </p>
        )}
        {list.map((entry) => (
          <MobileNoteItem
            key={entry.path}
            entry={entry}
            active={entry.path === activePath}
            onOpen={() => {
              void openNote(entry.path);
              onOpenEditor();
            }}
            onToggleStar={() => void toggleStar(entry.path)}
          />
        ))}
      </div>

      <div
        className="hairline-t flex h-12 shrink-0 items-center gap-2 bg-paper-deep px-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <span className="flex-1 text-xs text-ink-faint">
          {notes.length} note{notes.length === 1 ? "" : "s"}
        </span>
        {changed.length > 0 && (
          <span className="rounded-full bg-chip-orange-wash px-2.5 py-1 text-xs font-medium text-chip-orange">
            {changed.length} changed
          </span>
        )}
        <button
          onClick={() => void sync()}
          title={syncMessage || "Sync"}
          className="rounded-full p-2 text-ink-soft hover:bg-paper-sunken"
        >
          <SyncIcon state={syncState} />
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-full p-2 text-ink-soft hover:bg-paper-sunken"
        >
          <Settings2 size={16} />
        </button>
      </div>
    </>
  );
}

function MobileNoteItem({
  entry,
  active,
  onOpen,
  onToggleStar,
}: {
  entry: VaultEntry;
  active: boolean;
  onOpen: () => void;
  onToggleStar: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={`relative mb-1 block w-full rounded-xl px-4 py-3.5 text-left transition-colors ${
        active ? "bg-paper-sunken" : "hover:bg-paper-deep"
      }`}
    >
      {active && (
        <span className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-accent" />
      )}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold leading-snug">
            {entry.title}
          </p>
          <p className="mt-0.5 truncate text-sm leading-snug text-ink-soft">
            {entry.snippet ?? (
              <span className="italic text-ink-faint">Empty note</span>
            )}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            {entry.status && <StatusChip status={entry.status} />}
            <span className="text-xs text-ink-faint">
              {relativeDate(entry.modified)}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
          className={`mt-0.5 shrink-0 rounded-full p-1.5 transition-colors ${
            entry.starred ? "text-amber-400" : "text-ink-faint/50"
          }`}
        >
          <Star
            size={17}
            fill={entry.starred ? "currentColor" : "none"}
            strokeWidth={1.5}
          />
        </button>
      </div>
    </button>
  );
}

function MobileEditorView({ onBack }: { onBack: () => void }) {
  const activePath = useVault((s) => s.activePath);
  const entries = useVault((s) => s.entries);
  const note = useVault((s) => s.note);
  const noteKey = useVault((s) => s.noteKey);
  const rawMode = useVault((s) => s.rawMode);
  const setRawMode = useVault((s) => s.setRawMode);
  const saveStatus = useVault((s) => s.saveStatus);
  const words = useVault((s) => s.wordCount);
  const renameActive = useVault((s) => s.renameActive);
  const deleteActive = useVault((s) => s.deleteActive);
  const closeNote = useVault((s) => s.closeNote);
  const toggleStar = useVault((s) => s.toggleStar);

  const entry = entries.find((e) => e.path === activePath);
  const [title, setTitle] = useState(entry?.title ?? "");
  useEffect(() => setTitle(entry?.title ?? ""), [entry?.title, activePath]);

  const commitTitle = () => {
    if (entry && title.trim() && title.trim() !== entry.title) {
      void renameActive(title.trim());
    } else {
      setTitle(entry?.title ?? "");
    }
  };

  const handleBack = () => {
    closeNote();
    onBack();
  };

  const toggleRaw = () => {
    window.dispatchEvent(new CustomEvent("vault:flush-save"));
    window.setTimeout(() => setRawMode(!rawMode), 80);
  };

  return (
    <>
      <div
        className="hairline-b flex h-14 shrink-0 items-center gap-1 bg-paper px-2"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <button
          onClick={handleBack}
          className="shrink-0 rounded-full p-2.5 text-ink-soft hover:bg-paper-deep"
        >
          <ArrowLeft size={20} />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setTitle(entry?.title ?? "");
          }}
          placeholder="Untitled"
          className="min-w-0 flex-1 bg-transparent font-display text-lg font-semibold tracking-tight outline-none placeholder:text-ink-faint"
        />
        <button
          onClick={() => activePath && void toggleStar(activePath)}
          className={`shrink-0 rounded-full p-2.5 transition-colors ${
            entry?.starred ? "text-amber-400" : "text-ink-faint/60"
          }`}
        >
          <Star
            size={18}
            fill={entry?.starred ? "currentColor" : "none"}
            strokeWidth={1.5}
          />
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete "${entry?.title}"?`)) void deleteActive();
          }}
          className="shrink-0 rounded-full p-2.5 text-ink-soft hover:text-accent"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {note && activePath ? (
        <div
          className="min-h-0 flex-1 overflow-y-auto pt-2"
          key={`${noteKey}-${rawMode}`}
        >
          <Suspense fallback={null}>
            {rawMode ? (
              <RawEditor initialBody={note.body} />
            ) : (
              <RichEditor initialBody={note.body} />
            )}
          </Suspense>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-xl italic text-ink-faint">
            nothing open
          </p>
        </div>
      )}

      <div
        className="hairline-t flex h-11 shrink-0 items-center gap-3 bg-paper-deep px-4 text-xs text-ink-soft"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <span className="text-ink-faint tabular-nums">{words} words</span>
        <SaveIndicator status={saveStatus} />
        <span className="flex-1" />
        <button
          onClick={toggleRaw}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            rawMode
              ? "bg-accent/10 text-accent"
              : "text-ink-faint hover:bg-paper-sunken"
          }`}
        >
          {rawMode ? "Markdown" : "Rich text"}
        </button>
      </div>
    </>
  );
}

function MobileSearch({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (path: string) => void;
}) {
  const vault = useVault((s) => s.settings.vaultPath);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!vault || !query.trim()) {
      setResults([]);
      return;
    }
    const mySeq = ++seq.current;
    setSearching(true);
    const t = window.setTimeout(() => {
      ipc
        .searchVault(vault, query)
        .then((r) => {
          if (seq.current === mySeq) {
            setResults(r);
            setSearching(false);
          }
        })
        .catch(() => setSearching(false));
    }, 150);
    return () => window.clearTimeout(t);
  }, [query, vault]);

  return (
    <>
      <div
        className="hairline-b flex h-14 shrink-0 items-center gap-2 bg-paper px-3"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-paper-deep px-3 py-2">
          <Search size={16} className="shrink-0 text-ink-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results[0]) onOpen(results[0].path);
            }}
            placeholder="Search all notes…"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-ink-faint"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-ink-faint">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 px-2 py-2 text-sm font-medium text-accent"
        >
          Cancel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {searching && (
          <p className="pt-8 text-center text-sm text-ink-faint">
            Searching…
          </p>
        )}
        {query.trim() && !searching && results.length === 0 && (
          <p className="pt-8 text-center text-sm text-ink-faint">
            No matches for "{query}".
          </p>
        )}
        {!query.trim() && (
          <p className="pt-8 text-center text-sm text-ink-faint">
            Type to search your notes.
          </p>
        )}
        {results.map((r) => (
          <button
            key={r.path}
            onClick={() => onOpen(r.path)}
            className="mb-1 block w-full rounded-xl px-4 py-3 text-left hover:bg-paper-deep"
          >
            <span className="block truncate font-display text-base font-semibold">
              {r.title}
            </span>
            <span className="mt-0.5 line-clamp-2 block text-sm leading-snug text-ink-soft">
              {r.snippet}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function SyncIcon({ state }: { state: string }) {
  switch (state) {
    case "synced":
      return <Check size={16} className="text-chip-green" />;
    case "syncing":
      return <RefreshCw size={16} className="animate-spin" />;
    case "conflict":
    case "error":
      return <AlertTriangle size={16} className="text-accent" />;
    case "noRemote":
      return <CloudOff size={16} className="text-ink-faint" />;
    default:
      return <RefreshCw size={16} />;
  }
}

function SaveIndicator({ status }: { status: string }) {
  switch (status) {
    case "saving":
    case "dirty":
      return <Loader2 size={11} className="animate-spin text-ink-faint" />;
    case "error":
      return (
        <span className="font-semibold text-accent">save failed</span>
      );
    default:
      return <Check size={11} className="text-chip-green" />;
  }
}
