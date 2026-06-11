import { GitCommitHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useVault } from "../../store/vaultStore";
import { Modal } from "../ui";

/** Manual commit with a custom message — Cmd+Shift+G (PRD 6.6.1). */
export function CommitDialog() {
  const setCommitOpen = useVault((s) => s.setCommitOpen);
  const changed = useVault((s) => s.changedFiles);
  const refreshChanges = useVault((s) => s.refreshChanges);
  const commit = useVault((s) => s.commit);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshChanges();
  }, [refreshChanges]);

  const doCommit = async () => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      // flush any pending editor save so it lands in this commit
      window.dispatchEvent(new CustomEvent("vault:flush-save"));
      await commit(message.trim());
      setCommitOpen(false);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={() => setCommitOpen(false)}>
      <div className="p-4">
        <p className="flex items-center gap-2 text-base font-bold">
          <GitCommitHorizontal size={15} className="text-accent" />
          Commit changes
        </p>

        <textarea
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void doCommit();
            if (e.key === "Escape") setCommitOpen(false);
          }}
          placeholder="Describe what changed…"
          rows={3}
          className="mt-3 w-full resize-none rounded-md border border-line-strong bg-white px-3 py-2 text-base outline-none placeholder:text-ink-faint focus:border-accent"
        />

        <div className="mt-3 max-h-44 overflow-y-auto rounded-md border border-line bg-paper-deep p-2">
          {changed.length === 0 ? (
            <p className="px-1 py-2 text-center text-sm text-ink-faint">
              Working tree clean — nothing to commit.
            </p>
          ) : (
            changed.map((f) => (
              <p
                key={f.path}
                className="flex items-center gap-2 px-1 py-0.5 text-xs"
              >
                <span className="w-5 shrink-0 text-center font-mono text-2xs font-bold text-chip-orange">
                  {f.status || "??"}
                </span>
                <span className="truncate text-ink-soft">{f.path}</span>
              </p>
            ))
          )}
        </div>

        {error && (
          <p className="mt-2 rounded bg-accent-wash px-2 py-1.5 text-sm text-accent-deep">
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => setCommitOpen(false)}
            className="rounded-md px-3 py-1.5 text-sm text-ink-soft hover:bg-paper-sunken"
          >
            Cancel
          </button>
          <button
            onClick={() => void doCommit()}
            disabled={!message.trim() || changed.length === 0 || busy}
            className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-40"
          >
            {busy ? "Committing…" : "Commit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
