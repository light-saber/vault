import { useEffect } from "react";
import { openNoteWindow } from "../lib/windows";
import { useVault } from "../store/vaultStore";

/** Keyboard map per PRD 6.9. Cmd on macOS, Ctrl elsewhere. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const s = useVault.getState();
      const key = e.key.toLowerCase();

      if (e.shiftKey && key === "g") {
        e.preventDefault();
        s.setCommitOpen(!s.commitOpen);
        return;
      }
      if (e.shiftKey && key === "o") {
        e.preventDefault();
        if (s.activePath) {
          const entry = s.entries.find((en) => en.path === s.activePath);
          void openNoteWindow(s.activePath, entry?.title ?? "Note");
        }
        return;
      }
      if (e.shiftKey) return;

      switch (key) {
        case "k":
          e.preventDefault();
          s.setPaletteOpen(!s.paletteOpen);
          break;
        case "p":
        case "o":
          e.preventDefault();
          s.setQuickOpenOpen(!s.quickOpenOpen);
          break;
        case "n":
          e.preventDefault();
          void s.createNote();
          break;
        case "s":
          // auto-save handles persistence; flush any pending edit immediately
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("vault:flush-save"));
          break;
        case "e":
          e.preventDefault();
          s.setRawMode(!s.rawMode);
          break;
        case "i":
          e.preventDefault();
          s.setInspectorOpen(!s.inspectorOpen);
          break;
        case "f":
          e.preventDefault();
          s.setSearchOpen(!s.searchOpen);
          break;
        case ",":
          e.preventDefault();
          s.setSettingsOpen(!s.settingsOpen);
          break;
        case "[":
          e.preventDefault();
          s.goBack();
          break;
        case "]":
          e.preventDefault();
          s.goForward();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
