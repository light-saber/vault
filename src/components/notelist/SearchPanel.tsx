import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ipc } from "../../lib/ipc";
import type { SearchResult } from "../../lib/types";
import { useVault } from "../../store/vaultStore";
import { PaneHeader } from "../ui";

export function SearchPanel() {
  const vault = useVault((s) => s.settings.vaultPath);
  const openNote = useVault((s) => s.openNote);
  const setSearchOpen = useVault((s) => s.setSearchOpen);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

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
    <div className="flex h-full flex-col bg-paper">
      <PaneHeader className="gap-1 px-3">
        <span className="text-base font-bold tracking-tight">Search</span>
        <span className="flex-1" />
        <button
          onClick={() => setSearchOpen(false)}
          className="rounded p-1 text-ink-soft hover:bg-paper-sunken"
        >
          <X size={14} />
        </button>
      </PaneHeader>
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-md border border-line-strong bg-white px-2.5 py-1.5 focus-within:border-accent">
          <Search size={13} className="shrink-0 text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchOpen(false);
              if (e.key === "Enter" && results[0]) void openNote(results[0].path);
            }}
            placeholder="Search all notes…"
            className="w-full bg-transparent text-base outline-none placeholder:text-ink-faint"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {query.trim() && !searching && results.length === 0 && (
          <p className="px-3 pt-6 text-center text-sm text-ink-faint">
            No matches for “{query}”.
          </p>
        )}
        {results.map((r) => (
          <button
            key={r.path}
            onClick={() => void openNote(r.path)}
            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-paper-deep"
          >
            <span className="block truncate font-display text-lg font-semibold">
              {r.title}
            </span>
            <span className="mt-0.5 line-clamp-2 block text-sm leading-snug text-ink-soft">
              {r.snippet}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
