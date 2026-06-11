import { useEffect } from "react";
import { useVault } from "../store/vaultStore";

const TICK_MS = 30_000;

/**
 * AutoGit (PRD 6.6.1): after the configured idle period with no unsaved
 * edits, auto-commit "Updated N note(s)" and, when a remote exists, sync.
 */
export function useAutoGit() {
  useEffect(() => {
    let lastSyncAt = Date.now();
    const tick = async () => {
      const s = useVault.getState();
      const vault = s.settings.vaultPath;
      if (!vault) return;

      const idleMs = (s.settings.autoGitMinutes ?? 5) * 60_000;
      const idle =
        s.lastEditAt > 0 &&
        Date.now() - s.lastEditAt >= idleMs &&
        s.saveStatus === "saved";
      if (idle) {
        await s.refreshChanges();
        const changed = useVault.getState().changedFiles;
        const noteCount = changed.filter((c) => c.path.endsWith(".md")).length;
        if (changed.length > 0) {
          const label = `Updated ${noteCount || changed.length} note(s)`;
          try {
            await s.commit(label);
            useVault.setState({ lastEditAt: 0 });
            if (useVault.getState().syncState !== "noRemote") {
              await s.sync();
              lastSyncAt = Date.now();
            }
          } catch {
            // leave changes for the next tick or a manual commit
          }
        } else {
          useVault.setState({ lastEditAt: 0 });
        }
      }

      const syncEveryMs = (s.settings.autoSyncMinutes ?? 10) * 60_000;
      if (
        s.syncState !== "noRemote" &&
        s.syncState !== "syncing" &&
        Date.now() - lastSyncAt >= syncEveryMs
      ) {
        lastSyncAt = Date.now();
        await s.sync();
      }
    };
    const id = window.setInterval(() => void tick(), TICK_MS);
    return () => window.clearInterval(id);
  }, []);
}
