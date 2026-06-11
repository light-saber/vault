import {
  AlertTriangle,
  Check,
  CloudOff,
  GitCommitHorizontal,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { useVault } from "../../store/vaultStore";

const SYNC_LABEL: Record<string, string> = {
  synced: "Synced",
  syncing: "Syncing…",
  pullRequired: "Pull required",
  conflict: "Conflict",
  error: "Sync error",
  noRemote: "Local only",
  dirty: "Unsynced changes",
};

export function StatusBar() {
  const vaultPath = useVault((s) => s.settings.vaultPath);
  const entries = useVault((s) => s.entries);
  const changed = useVault((s) => s.changedFiles);
  const syncState = useVault((s) => s.syncState);
  const syncMessage = useVault((s) => s.syncMessage);
  const sync = useVault((s) => s.sync);
  const setCommitOpen = useVault((s) => s.setCommitOpen);
  const setSettingsOpen = useVault((s) => s.setSettingsOpen);

  const vaultName = vaultPath?.split("/").filter(Boolean).pop() ?? "";
  const noteCount = entries.filter((e) => e.noteType !== "type").length;

  return (
    <div className="hairline-t flex h-7 shrink-0 items-center gap-3 bg-paper-deep px-3 text-[11px] text-ink-soft">
      <span className="font-semibold tracking-wide">{vaultName}</span>
      <span className="text-ink-faint">
        {noteCount} note{noteCount === 1 ? "" : "s"}
      </span>
      <span className="flex-1" />
      {changed.length > 0 && (
        <button
          onClick={() => setCommitOpen(true)}
          title="Uncommitted changes — open commit dialog (⌘⇧G)"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-chip-orange hover:bg-paper-sunken"
        >
          <GitCommitHorizontal size={12} />
          {changed.length} changed
        </button>
      )}
      <button
        onClick={() => void sync()}
        title={syncMessage || "Sync with remote"}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-paper-sunken"
      >
        <SyncIcon state={syncState} />
        {SYNC_LABEL[syncState] ?? syncState}
      </button>
      <button
        onClick={() => setSettingsOpen(true)}
        title="Settings (⌘,)"
        className="rounded p-1 hover:bg-paper-sunken"
      >
        <Settings2 size={12.5} />
      </button>
    </div>
  );
}

function SyncIcon({ state }: { state: string }) {
  switch (state) {
    case "synced":
      return <Check size={12} className="text-chip-green" />;
    case "syncing":
      return <RefreshCw size={12} className="animate-spin" />;
    case "conflict":
    case "error":
      return <AlertTriangle size={12} className="text-accent" />;
    case "noRemote":
      return <CloudOff size={12} className="text-ink-faint" />;
    default:
      return <RefreshCw size={12} />;
  }
}
