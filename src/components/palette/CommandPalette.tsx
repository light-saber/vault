import { Command } from "cmdk";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CodeXml,
  ExternalLink,
  FilePlus,
  GitCommitHorizontal,
  Inbox,
  Library,
  PanelRight,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";
import { openNoteWindow } from "../../lib/windows";
import { useVault } from "../../store/vaultStore";
import { fileStem } from "../../lib/wikilinks";

/** Cmd+K: full-text searchable palette of all app actions (PRD 6.3.3). */
export function CommandPalette() {
  const setPaletteOpen = useVault((s) => s.setPaletteOpen);
  const entries = useVault((s) => s.entries);
  const openNote = useVault((s) => s.openNote);

  const run = (fn: () => void) => () => {
    setPaletteOpen(false);
    fn();
  };
  const s = () => useVault.getState();

  const actions: { label: string; icon: React.ReactNode; kbd?: string; fn: () => void }[] = [
    { label: "New note", icon: <FilePlus size={14} />, kbd: "⌘N", fn: () => void s().createNote() },
    { label: "Toggle raw Markdown", icon: <CodeXml size={14} />, kbd: "⌘E", fn: () => s().setRawMode(!s().rawMode) },
    { label: "Toggle Inspector", icon: <PanelRight size={14} />, kbd: "⌘I", fn: () => s().setInspectorOpen(!s().inspectorOpen) },
    { label: "Search notes", icon: <Search size={14} />, kbd: "⌘F", fn: () => s().setSearchOpen(true) },
    { label: "Commit changes", icon: <GitCommitHorizontal size={14} />, kbd: "⌘⇧G", fn: () => s().setCommitOpen(true) },
    { label: "Sync with remote", icon: <RefreshCw size={14} />, fn: () => void s().sync() },
    {
      label: "Open note in new window",
      icon: <ExternalLink size={14} />,
      kbd: "⌘⇧O",
      fn: () => {
        const { activePath, entries } = s();
        if (activePath) {
          const e = entries.find((en) => en.path === activePath);
          void openNoteWindow(activePath, e?.title ?? "Note");
        }
      },
    },
    { label: "Go back", icon: <ChevronLeft size={14} />, kbd: "⌘[", fn: () => s().goBack() },
    { label: "Go forward", icon: <ChevronRight size={14} />, kbd: "⌘]", fn: () => s().goForward() },
    { label: "Show all notes", icon: <Library size={14} />, fn: () => s().setFilter({ kind: "all" }) },
    { label: "Show Inbox", icon: <Inbox size={14} />, fn: () => s().setFilter({ kind: "inbox" }) },
    { label: "Show changes", icon: <GitCommitHorizontal size={14} />, fn: () => s().setFilter({ kind: "changes" }) },
    { label: "Show Pulse", icon: <Activity size={14} />, fn: () => s().setFilter({ kind: "pulse" }) },
    { label: "Open settings", icon: <Settings2 size={14} />, kbd: "⌘,", fn: () => s().setSettingsOpen(true) },
  ];

  return (
    <PaletteShell onClose={() => setPaletteOpen(false)} placeholder="Type a command or note name…">
      <Command.Group heading="Commands">
        {actions.map((a) => (
          <Command.Item key={a.label} onSelect={run(a.fn)} className="palette-item">
            <span className="text-ink-faint">{a.icon}</span>
            <span className="flex-1">{a.label}</span>
            {a.kbd && <span className="text-2xs text-ink-faint">{a.kbd}</span>}
          </Command.Item>
        ))}
      </Command.Group>
      <Command.Group heading="Notes">
        {entries
          .filter((e) => e.noteType !== "type")
          .slice(0, 200)
          .map((e) => (
            <Command.Item
              key={e.path}
              value={`note ${e.title} ${e.path}`}
              onSelect={run(() => void openNote(e.path))}
              className="palette-item"
            >
              <span className="flex-1 truncate">{e.title}</span>
              <span className="truncate text-2xs text-ink-faint">
                {fileStem(e.path) !== e.title ? e.path : ""}
              </span>
            </Command.Item>
          ))}
      </Command.Group>
    </PaletteShell>
  );
}

export function PaletteShell({
  onClose,
  placeholder,
  children,
}: {
  onClose: () => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 pt-[14vh]"
      onMouseDown={onClose}
    >
      <Command
        label="Command palette"
        className="overlay-in w-[560px] overflow-hidden rounded-xl border border-line bg-paper shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <Command.Input
          autoFocus
          placeholder={placeholder}
          className="hairline-b w-full bg-transparent px-4 py-3 text-lg outline-none placeholder:text-ink-faint"
        />
        <Command.List className="max-h-[340px] overflow-y-auto p-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-ink-faint [&_[cmdk-item]]:flex [&_[cmdk-item]]:cursor-pointer [&_[cmdk-item]]:items-center [&_[cmdk-item]]:gap-2.5 [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:px-2.5 [&_[cmdk-item]]:py-[7px] [&_[cmdk-item]]:text-base [&_[cmdk-item][data-selected=true]]:bg-paper-sunken [&_[cmdk-item][data-selected=true]]:text-ink">
          <Command.Empty className="px-3 py-6 text-center text-sm text-ink-faint">
            No results.
          </Command.Empty>
          {children}
        </Command.List>
      </Command>
    </div>
  );
}
