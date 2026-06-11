# Vault — Build TODO

Plan: ~/.claude/plans/proud-plotting-widget.md (approved 2026-06-11)

- [x] 0. Toolchain: install rustup (stable, minimal) + pnpm; git init repo
- [x] 1. Scaffold: Tauri v2 + React 19 + TS + Vite + Tailwind v4; baseline commit
- [x] 2. Rust core: settings, create/open/list vault, read/save note, git init on create, cargo tests (7 unit + 1 integration)
- [x] 3. Shell UI: WelcomeScreen, four resizable panels, sidebar (filters + type groups), note list, status bar
- [x] 4. Editor: BlockNote rich text, CM6 raw toggle (Cmd+E), 500ms autosave, breadcrumb bar
- [x] 5. Wikilinks + Inspector: [[ autocomplete, hover previews, backlinks, frontmatter editor, file git history
- [x] 6. Search + Command palette + Quick open + nav history + full shortcut table
- [x] 7. Git features: AutoGit, commit dialog (Cmd+Shift+G), Pulse view, sync status, Changes filter
- [x] 8. Multi-window: editor-only secondary window (Cmd+Shift+O / Cmd+Shift+Click)
- [x] 9. Polish: README, AGPL-3.0 LICENSE, getting-started sample vault
- [x] 10. Verify: cargo test ✓ (8), vitest ✓ (14), tsc --noEmit ✓, vite build ✓, tauri dev launch ✓ (welcome screen + full four-panel UI verified via screenshots)

## Review

Built 2026-06-11. Full PRD core feature set implemented and verified:

- **Backend (Rust)**: settings (~/.config/com.vault.app), vault create/open/list with
  gray_matter frontmatter parsing, note CRUD preserving raw frontmatter on body saves,
  walkdir keyword search with title-ranking + UTF-8-safe snippets, git via system CLI
  (status/log/file-log/diff/commit/sync with rebase-autostash + conflict detection).
- **Frontend (React 19)**: Zustand store with disk-first write rule, four resizable
  panels, BlockNote editor with custom wikilink inline content (`[[` autocomplete,
  hover previews, missing-link creation), CodeMirror raw mode, inspector, Pulse feed,
  command palette/quick open (cmdk), AutoGit hook, multi-window via WebviewWindow.
- **Verified**: 8 cargo tests (incl. full-lifecycle integration test), 14 vitest tests,
  clean typecheck + production build, app launched with seeded vault — all four panels,
  wikilinks, status chips, backlinks and git history rendering correctly.

Deferred (documented in README): conflict resolver UI, neighborhood view, saved views,
update notifications, telemetry, Playwright E2E, Windows/Linux.

Gotchas for next session:
- pnpm 11 build-script approval lives in pnpm-workspace.yaml (`allowBuilds`), not package.json.
- @vitejs/plugin-react 6 requires Vite 8 (`vite/internal` export).
- BlockNote markdown export escapes `[[` — postProcessWikilinks() unescapes; import side
  re-injects wikilink inline content via injectWikilinksIntoBlocks().
