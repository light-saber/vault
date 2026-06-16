import {
  Activity,
  ChevronRight,
  GitCommitHorizontal,
  Inbox,
  Library,
  Search,
  Star,
} from "lucide-react";
import { useState } from "react";
import {
  entriesOfType,
  typeDefs,
  undefinedTypes,
} from "../../lib/filtering";
import type { Filter } from "../../lib/types";
import { useVault } from "../../store/vaultStore";
import { PaneHeader, typeColorClass, typeIcon } from "../ui";

export function Sidebar() {
  const entries = useVault((s) => s.entries);
  const filter = useVault((s) => s.filter);
  const setFilter = useVault((s) => s.setFilter);
  const setSearchOpen = useVault((s) => s.setSearchOpen);
  const searchOpen = useVault((s) => s.searchOpen);
  const changed = useVault((s) => s.changedFiles);

  const defs = typeDefs(entries);
  const adhoc = undefinedTypes(entries, defs);
  const notes = entries.filter((e) => e.noteType !== "type");

  return (
    <div className="flex h-full flex-col bg-paper-deep">
      <PaneHeader className="px-4 pl-[84px]">
        <span className="font-display text-xl font-semibold tracking-tight">
          Vault
        </span>
        <span className="flex-1" />
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          title="Search (⌘F)"
          className={`rounded p-1 ${searchOpen ? "bg-paper-sunken text-accent" : "text-ink-soft hover:bg-paper-sunken"}`}
        >
          <Search size={14} />
        </button>
      </PaneHeader>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <FilterRow
          icon={<Library size={14} />}
          label="All Notes"
          count={notes.length}
          active={filter.kind === "all"}
          onClick={() => setFilter({ kind: "all" })}
        />
        <FilterRow
          icon={<Inbox size={14} />}
          label="Inbox"
          count={notes.filter((e) => e.noteType === null).length}
          active={filter.kind === "inbox"}
          onClick={() => setFilter({ kind: "inbox" })}
        />
        <FilterRow
          icon={<Star size={14} />}
          label="Starred"
          count={notes.filter((e) => e.starred).length}
          active={filter.kind === "starred"}
          onClick={() => setFilter({ kind: "starred" })}
        />
        <FilterRow
          icon={<GitCommitHorizontal size={14} />}
          label="Changes"
          count={changed.length}
          active={filter.kind === "changes"}
          onClick={() => setFilter({ kind: "changes" })}
        />
        <FilterRow
          icon={<Activity size={14} />}
          label="Pulse"
          active={filter.kind === "pulse"}
          onClick={() => setFilter({ kind: "pulse" })}
        />

        {(defs.length > 0 || adhoc.length > 0) && (
          <div className="mt-5">
            <p className="px-2 pb-1 text-2xs font-bold uppercase tracking-[0.12em] text-ink-faint">
              Types
            </p>
            {defs.map((def) => (
              <TypeSection
                key={def.slug}
                slug={def.slug}
                title={def.title}
                icon={def.icon}
                color={def.color}
                count={entriesOfType(entries, def.slug).length}
                filter={filter}
                setFilter={setFilter}
              />
            ))}
            {adhoc.map((slug) => (
              <TypeSection
                key={slug}
                slug={slug}
                title={slug}
                icon="file-text"
                color="gray"
                count={entriesOfType(entries, slug).length}
                filter={filter}
                setFilter={setFilter}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterRow({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-base transition-colors ${
        active
          ? "bg-paper-sunken font-semibold text-ink"
          : "text-ink-soft hover:bg-paper-sunken/60"
      }`}
    >
      <span className={active ? "text-accent" : "text-ink-faint"}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs tabular-nums text-ink-faint">{count}</span>
      )}
    </button>
  );
}

function TypeSection(props: {
  slug: string;
  title: string;
  icon: string;
  color: string;
  count: number;
  filter: Filter;
  setFilter: (f: Filter) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const active = props.filter.kind === "type" && props.filter.type === props.slug;
  const Icon = typeIcon(props.icon);
  return (
    <div>
      <button
        onClick={() => props.setFilter({ kind: "type", type: props.slug })}
        className={`group flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-base transition-colors ${
          active
            ? "bg-paper-sunken font-semibold text-ink"
            : "text-ink-soft hover:bg-paper-sunken/60"
        }`}
      >
        <ChevronRight
          size={11}
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed(!collapsed);
          }}
          className={`text-ink-faint transition-transform ${collapsed ? "" : "rotate-90"}`}
        />
        <Icon size={14} className={typeColorClass(props.color)} />
        <span className="flex-1 text-left capitalize">{props.title}</span>
        <span className="text-xs tabular-nums text-ink-faint">
          {props.count}
        </span>
      </button>
    </div>
  );
}
