import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

/** Open a note in a focused, editor-only secondary window (PRD 6.8). */
export async function openNoteWindow(path: string, title: string) {
  const label =
    "editor-" + path.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }
  new WebviewWindow(label, {
    url: `index.html?note=${encodeURIComponent(path)}`,
    width: 800,
    height: 700,
    title,
    titleBarStyle: "overlay",
    hiddenTitle: true,
  });
}

export function editorWindowNote(): string | null {
  return new URLSearchParams(window.location.search).get("note");
}
