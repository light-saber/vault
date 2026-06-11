import { History, Link2, ListTree, Plus, Tags, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ipc } from "../../lib/ipc";
import { relativeDate } from "../../lib/dates";
import { entriesOfType } from "../../lib/filtering";
import type { CommitInfo, VaultEntry } from "../../lib/types";
import { backlinksFor, fileStem, resolveWikilink } from "../../lib/wikilinks";
import { useVault } from "../../store/vaultStore";
import { PaneHeader } from "../ui";

export function Inspector() {
  const entries = useVault((s) => s.entries);
  const activePath = useVault((s) => s.activePath);
  const note = useVault((s) => s.note);

  const entry = entries.find((e) => e.path === activePath);
  if (!entry || !note) {
    return (
      <div className="flex h-full flex-col bg-paper-deep">
        <div className="titlebar-drag h-12 shrink-0" />
        <p className="px-4 pt-6 text-center text-sm text-ink-faint">
          Select a note to inspect its metadata.
        </p>
      </div>
    );
  }

  const backlinks = backlinksFor(entries, entry);
  const isType = entry.noteType === "type";

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-paper-deep">
      <PaneHeader className="px-4">
        <span className="text-base font-bold tracking-tight">Inspector</span>
      </PaneHeader>

      <div className="space-y-5 px-4 pb-6">
        <PropertiesSection key={entry.path} entry={entry} />

        <RelationSection
          title="Outgoing"
          icon={<Link2 size={12} />}
          groups={[
            { label: "belongs to", targets: entry.belongsTo },
            { label: "related to", targets: entry.relatedTo },
            { label: "has", targets: entry.has },
            { label: "links", targets: entry.wikilinks },
          ]}
          entries={entries}
        />

        <section>
          <SectionHeading icon={<Tags size={12} />} label={`Backlinks · ${backlinks.length}`} />
          {backlinks.length === 0 ? (
            <Empty>No notes link here yet.</Empty>
          ) : (
            backlinks.map((b) => <NoteLink key={b.path} entry={b} />)
          )}
        </section>

        {isType && <InstancesSection entry={entry} entries={entries} />}

        <HistorySection path={entry.path} />
      </div>
    </div>
  );
}

function SectionHeading({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.12em] text-ink-faint">
      {icon}
      {label}
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-ink-faint">{children}</p>;
}

function NoteLink({ entry }: { entry: VaultEntry }) {
  const openNote = useVault((s) => s.openNote);
  return (
    <button
      onClick={() => void openNote(entry.path)}
      className="block w-full truncate rounded px-1.5 py-1 text-left text-sm text-ink hover:bg-paper-sunken hover:text-accent"
    >
      {entry.title}
    </button>
  );
}

/* ————— frontmatter properties ————— */

function PropertiesSection({ entry }: { entry: VaultEntry }) {
  const saveFrontmatter = useVault((s) => s.saveFrontmatter);
  const fm = entry.frontmatter ?? {};
  const [newKey, setNewKey] = useState("");
  const [adding, setAdding] = useState(false);

  const commit = (key: string, raw: string) => {
    const next = { ...fm };
    if (raw.trim() === "") {
      delete next[key];
    } else {
      next[key] = parseValue(raw, fm[key]);
    }
    void saveFrontmatter(next);
  };

  const addProperty = () => {
    const key = newKey.trim().replace(/\s+/g, "_").toLowerCase();
    if (key && !(key in fm)) {
      void saveFrontmatter({ ...fm, [key]: "" });
    }
    setNewKey("");
    setAdding(false);
  };

  const keys = Object.keys(fm);

  return (
    <section>
      <SectionHeading icon={<ListTree size={12} />} label="Properties" />
      {keys.length === 0 && <Empty>No frontmatter yet.</Empty>}
      <div className="space-y-1">
        {keys.map((key) => (
          <PropertyRow
            key={key}
            name={key}
            value={fm[key]}
            onCommit={(raw) => commit(key, raw)}
            onRemove={() => {
              const next = { ...fm };
              delete next[key];
              void saveFrontmatter(next);
            }}
          />
        ))}
      </div>
      {adding ? (
        <input
          autoFocus
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onBlur={addProperty}
          onKeyDown={(e) => {
            if (e.key === "Enter") addProperty();
            if (e.key === "Escape") setAdding(false);
          }}
          placeholder="property name"
          className="mt-1 w-full rounded border border-line-strong bg-white px-2 py-1 text-sm outline-none focus:border-accent"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-1.5 flex items-center gap-1 text-xs text-ink-faint hover:text-accent"
        >
          <Plus size={11} /> Add property
        </button>
      )}
    </section>
  );
}

function PropertyRow({
  name,
  value,
  onCommit,
  onRemove,
}: {
  name: string;
  value: unknown;
  onCommit: (raw: string) => void;
  onRemove: () => void;
}) {
  const display = formatValue(value);
  const [draft, setDraft] = useState(display);
  useEffect(() => setDraft(display), [display]);

  return (
    <div className="group flex items-center gap-1.5">
      <span className="w-[88px] shrink-0 truncate text-xs font-medium text-ink-soft">
        {name}
      </span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== display && onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(display);
        }}
        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm outline-none hover:border-line focus:border-accent focus:bg-white"
      />
      <button
        onClick={onRemove}
        className="rounded p-0.5 text-ink-faint opacity-0 hover:text-accent group-hover:opacity-100"
        title="Remove property"
      >
        <X size={11} />
      </button>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Comma-separated input becomes an array when the field was already a list. */
function parseValue(raw: string, previous: unknown): unknown {
  const trimmed = raw.trim();
  if (Array.isArray(previous) || trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

/* ————— relations ————— */

function RelationSection({
  title,
  icon,
  groups,
  entries,
}: {
  title: string;
  icon: React.ReactNode;
  groups: { label: string; targets: string[] }[];
  entries: VaultEntry[];
}) {
  const openNote = useVault((s) => s.openNote);
  const nonEmpty = groups.filter((g) => g.targets.length > 0);
  return (
    <section>
      <SectionHeading icon={icon} label={title} />
      {nonEmpty.length === 0 && <Empty>No outgoing links.</Empty>}
      {nonEmpty.map((g) => (
        <div key={g.label} className="mb-1.5">
          <p className="text-2xs font-semibold text-ink-faint">{g.label}</p>
          {g.targets.map((t) => {
            const target = resolveWikilink(entries, t);
            return (
              <button
                key={t}
                onClick={() => target && void openNote(target.path)}
                className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-sm ${
                  target
                    ? "text-ink hover:bg-paper-sunken hover:text-accent"
                    : "cursor-default text-ink-faint"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      ))}
    </section>
  );
}

/* ————— instances (for type notes) ————— */

function InstancesSection({
  entry,
  entries,
}: {
  entry: VaultEntry;
  entries: VaultEntry[];
}) {
  const slug = fileStem(entry.path).toLowerCase();
  const instances = entriesOfType(entries, slug);
  return (
    <section>
      <SectionHeading
        icon={<ListTree size={12} />}
        label={`Instances · ${instances.length}`}
      />
      {instances.length === 0 ? (
        <Empty>No notes of this type yet.</Empty>
      ) : (
        instances.map((i) => <NoteLink key={i.path} entry={i} />)
      )}
    </section>
  );
}

/* ————— git history ————— */

function HistorySection({ path }: { path: string }) {
  const vault = useVault((s) => s.settings.vaultPath);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [diff, setDiff] = useState<{ hash: string; text: string } | null>(null);

  useEffect(() => {
    if (!vault) return;
    setDiff(null);
    ipc
      .gitFileLog(vault, path, 10)
      .then(setCommits)
      .catch(() => setCommits([]));
  }, [vault, path]);

  const showDiff = async (hash: string) => {
    if (!vault) return;
    if (diff?.hash === hash) {
      setDiff(null);
      return;
    }
    try {
      const text = await ipc.gitDiff(vault, hash, path);
      setDiff({ hash, text });
    } catch {
      setDiff({ hash, text: "(no diff available)" });
    }
  };

  return (
    <section>
      <SectionHeading icon={<History size={12} />} label="History" />
      {commits.length === 0 && <Empty>Not committed yet.</Empty>}
      {commits.map((c) => (
        <div key={c.hash}>
          <button
            onClick={() => void showDiff(c.hash)}
            className="flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left hover:bg-paper-sunken"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{c.message}</span>
            <span className="shrink-0 font-mono text-2xs text-ink-faint">
              {c.shortHash}
            </span>
            <span className="shrink-0 text-2xs text-ink-faint">
              {relativeDate(c.timestamp)}
            </span>
          </button>
          {diff?.hash === c.hash && <DiffView text={diff.text} />}
        </div>
      ))}
    </section>
  );
}

function DiffView({ text }: { text: string }) {
  return (
    <pre className="diff-view my-1 max-h-64 overflow-auto rounded-md border border-line bg-paper p-2">
      {text.split("\n").map((line, i) => (
        <div
          key={i}
          className={
            line.startsWith("+") && !line.startsWith("+++")
              ? "add"
              : line.startsWith("-") && !line.startsWith("---")
                ? "del"
                : line.startsWith("@@")
                  ? "hunk"
                  : ""
          }
        >
          {line || " "}
        </div>
      ))}
    </pre>
  );
}
