import { Command } from "cmdk";
import { FileText } from "lucide-react";
import { relativeDate } from "../../lib/dates";
import { useVault } from "../../store/vaultStore";
import { PaletteShell } from "./CommandPalette";

/** Cmd+P / Cmd+O: jump to any note (PRD 6.9). */
export function QuickOpen() {
  const setQuickOpenOpen = useVault((s) => s.setQuickOpenOpen);
  const entries = useVault((s) => s.entries);
  const openNote = useVault((s) => s.openNote);

  return (
    <PaletteShell
      onClose={() => setQuickOpenOpen(false)}
      placeholder="Jump to note…"
    >
      {entries
        .filter((e) => e.noteType !== "type")
        .sort((a, b) => b.modified - a.modified)
        .map((e) => (
          <Command.Item
            key={e.path}
            value={`${e.title} ${e.path}`}
            onSelect={() => {
              setQuickOpenOpen(false);
              void openNote(e.path);
            }}
            className="palette-item"
          >
            <FileText size={13} className="shrink-0 text-ink-faint" />
            <span className="min-w-0 flex-1 truncate">{e.title}</span>
            <span className="shrink-0 text-2xs tabular-nums text-ink-faint">
              {relativeDate(e.modified)}
            </span>
          </Command.Item>
        ))}
    </PaletteShell>
  );
}
