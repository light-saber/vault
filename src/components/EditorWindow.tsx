import { useEffect } from "react";
import { useVault } from "../store/vaultStore";
import { EditorPane } from "./editor/EditorPane";

/**
 * Secondary editor-only window (PRD 6.8): no sidebar, no note list,
 * independent auto-save.
 */
export function EditorWindow({ path }: { path: string }) {
  const vaultPath = useVault((s) => s.settings.vaultPath);
  const activePath = useVault((s) => s.activePath);
  const openNote = useVault((s) => s.openNote);

  useEffect(() => {
    if (vaultPath && activePath !== path) {
      void openNote(path, { history: false });
    }
    // open once the vault is known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultPath, path]);

  return (
    <div className="h-full">
      <EditorPane standalone />
    </div>
  );
}
