// Web stub for windows.ts — multi-window is Tauri-only and not available in the browser.

export async function openNoteWindow(_path: string, _title: string): Promise<void> {
  // No-op in web builds.
}

export function editorWindowNote(): string | null {
  return new URLSearchParams(window.location.search).get("note");
}
