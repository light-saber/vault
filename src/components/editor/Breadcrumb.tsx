import {
  Check,
  ChevronLeft,
  ChevronRight,
  CodeXml,
  ExternalLink,
  Loader2,
  PanelRight,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { openNoteWindow } from "../../lib/windows";
import { useVault } from "../../store/vaultStore";

export function Breadcrumb({ standalone = false }: { standalone?: boolean }) {
  const activePath = useVault((s) => s.activePath);
  const entries = useVault((s) => s.entries);
  const saveStatus = useVault((s) => s.saveStatus);
  const words = useVault((s) => s.wordCount);
  const rawMode = useVault((s) => s.rawMode);
  const setRawMode = useVault((s) => s.setRawMode);
  const inspectorOpen = useVault((s) => s.inspectorOpen);
  const setInspectorOpen = useVault((s) => s.setInspectorOpen);
  const renameActive = useVault((s) => s.renameActive);
  const deleteActive = useVault((s) => s.deleteActive);
  const goBack = useVault((s) => s.goBack);
  const goForward = useVault((s) => s.goForward);
  const history = useVault((s) => s.history);
  const historyIndex = useVault((s) => s.historyIndex);

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

  const toggleRaw = () => {
    // flush the active editor before swapping editor implementations
    window.dispatchEvent(new CustomEvent("vault:flush-save"));
    window.setTimeout(() => setRawMode(!rawMode), 80);
  };

  return (
    <div className="titlebar-drag hairline-b flex h-12 shrink-0 items-center gap-1 bg-paper px-3">
      {!standalone && (
        <>
          <button
            onClick={goBack}
            disabled={historyIndex <= 0}
            title="Back (⌘[)"
            className="rounded p-1 text-ink-soft enabled:hover:bg-paper-deep disabled:opacity-30"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            title="Forward (⌘])"
            className="rounded p-1 text-ink-soft enabled:hover:bg-paper-deep disabled:opacity-30"
          >
            <ChevronRight size={15} />
          </button>
        </>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setTitle(entry?.title ?? "");
        }}
        placeholder="Untitled"
        className="mx-1 min-w-0 flex-1 truncate bg-transparent font-display text-[15px] font-semibold tracking-tight outline-none placeholder:text-ink-faint"
      />

      <span className="mr-1 flex items-center gap-2 text-[11px] tabular-nums text-ink-faint">
        <span>{words} words</span>
        <SaveIndicator status={saveStatus} />
      </span>

      <button
        onClick={toggleRaw}
        title="Toggle raw Markdown (⌘E)"
        className={`rounded p-1 ${rawMode ? "bg-paper-sunken text-accent" : "text-ink-soft hover:bg-paper-deep"}`}
      >
        <CodeXml size={15} />
      </button>
      {!standalone && (
        <>
          <button
            onClick={() =>
              activePath && void openNoteWindow(activePath, entry?.title ?? "Note")
            }
            title="Open in new window (⌘⇧O)"
            className="rounded p-1 text-ink-soft hover:bg-paper-deep"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete “${entry?.title}”?`)) void deleteActive();
            }}
            title="Delete note"
            className="rounded p-1 text-ink-soft hover:bg-paper-deep hover:text-accent"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setInspectorOpen(!inspectorOpen)}
            title="Toggle Inspector (⌘I)"
            className={`rounded p-1 ${inspectorOpen ? "bg-paper-sunken text-accent" : "text-ink-soft hover:bg-paper-deep"}`}
          >
            <PanelRight size={15} />
          </button>
        </>
      )}
    </div>
  );
}

function SaveIndicator({ status }: { status: string }) {
  switch (status) {
    case "saving":
    case "dirty":
      return <Loader2 size={11} className="animate-spin text-ink-faint" />;
    case "error":
      return <span className="font-semibold text-accent">save failed</span>;
    default:
      return <Check size={11} className="text-chip-green" />;
  }
}
