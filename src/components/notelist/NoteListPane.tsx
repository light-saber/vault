import { ArrowUpDown, Plus } from "lucide-react";
import { relativeDate } from "../../lib/dates";
import {
  filterEntries,
  filterLabel,
  sortEntries,
  typeDefs,
} from "../../lib/filtering";
import type { SortKey, VaultEntry } from "../../lib/types";
import { openNoteWindow } from "../../lib/windows";
import { useVault } from "../../store/vaultStore";
import { PulseView } from "../pulse/PulseView";
import { StatusChip } from "../ui";
import { SearchPanel } from "./SearchPanel";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "modified", label: "Modified" },
  { key: "created", label: "Created" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
];

export function NoteListPane() {
  const entries = useVault((s) => s.entries);
  const filter = useVault((s) => s.filter);
  const sort = useVault((s) => s.sort);
  const setSort = useVault((s) => s.setSort);
  const searchOpen = useVault((s) => s.searchOpen);
  const changed = useVault((s) => s.changedFiles);
  const activePath = useVault((s) => s.activePath);
  const openNote = useVault((s) => s.openNote);
  const createNote = useVault((s) => s.createNote);

  if (searchOpen) return <SearchPanel />;
  if (filter.kind === "pulse") return <PulseView />;

  const defs = typeDefs(entries);
  const list = sortEntries(filterEntries(entries, filter, changed), sort);

  const cycleSort = () => {
    const idx = SORTS.findIndex((s) => s.key === sort);
    setSort(SORTS[(idx + 1) % SORTS.length].key);
  };

  return (
    <div className="flex h-full flex-col bg-paper">
      <div className="titlebar-drag flex h-12 shrink-0 items-end px-3 pb-1.5">
        <span className="text-[13px] font-bold tracking-tight">
          {filterLabel(filter, defs)}
        </span>
        <span className="ml-2 pb-px text-[11px] tabular-nums text-ink-faint">
          {list.length}
        </span>
        <span className="flex-1" />
        <button
          onClick={cycleSort}
          title={`Sorted by ${sort} — click to change`}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-ink-soft hover:bg-paper-sunken"
        >
          <ArrowUpDown size={11} />
          {SORTS.find((s) => s.key === sort)?.label}
        </button>
        <button
          onClick={() => void createNote()}
          title="New note (⌘N)"
          className="ml-1 rounded p-1 text-ink-soft hover:bg-paper-sunken hover:text-accent"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {list.length === 0 && (
          <p className="px-3 pt-8 text-center text-[12.5px] text-ink-faint">
            {filter.kind === "changes"
              ? "No uncommitted changes."
              : "No notes here yet."}
          </p>
        )}
        {list.map((entry) => (
          <NoteListItem
            key={entry.path}
            entry={entry}
            active={entry.path === activePath}
            onOpen={(e) => {
              if (e.metaKey && e.shiftKey) {
                void openNoteWindow(entry.path, entry.title);
              } else {
                void openNote(entry.path);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function NoteListItem({
  entry,
  active,
  onOpen,
}: {
  entry: VaultEntry;
  active: boolean;
  onOpen: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={`relative block w-full rounded-lg px-3 py-2 text-left transition-colors ${
        active ? "bg-paper-sunken" : "hover:bg-paper-deep"
      }`}
    >
      {active && (
        <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />
      )}
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate font-display text-[14.5px] font-semibold leading-snug">
          {entry.title}
        </span>
        <span className="shrink-0 text-[10.5px] tabular-nums text-ink-faint">
          {relativeDate(entry.modified)}
        </span>
      </span>
      <span className="mt-0.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12px] leading-snug text-ink-soft">
          {entry.snippet || <span className="italic text-ink-faint">Empty note</span>}
        </span>
        {entry.status && <StatusChip status={entry.status} />}
      </span>
    </button>
  );
}
