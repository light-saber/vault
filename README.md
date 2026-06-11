# Vault

A local-first, open-source personal knowledge management desktop app.
Plain Markdown files + YAML frontmatter, versioned with git, owned by you.

- **Files first** — notes are plain `.md` files; the app never owns your data
- **Git first** — every vault is a git repository; bring your own remote
- **Offline first** — no accounts, no cloud, fully functional offline
- **Single vault** — one focused workspace; change it from Settings
- **Keyboard first** — command palette, wikilink completion, full shortcut map

Built with Tauri v2 (Rust) + React 19 + BlockNote + CodeMirror 6.
Licensed under AGPL-3.0.

## Features (v0.1)

- Welcome onboarding: create a blank vault, a getting-started sample vault, or open any folder of Markdown
- Four-panel layout: sidebar · note list · editor · inspector (all resizable)
- Rich text block editor with `[[wikilink]]` autocomplete and hover previews, plus raw Markdown mode (⌘E)
- Frontmatter-driven note types (`type: type` notes) with sidebar grouping, icons and colors
- Inspector: editable frontmatter properties, outgoing links, backlinks, per-file git history with diffs
- Full-text search (⌘F), command palette (⌘K), quick open (⌘P)
- AutoGit: idle auto-commit "Updated N note(s)", manual commit dialog (⌘⇧G), pull/push sync, Pulse activity feed
- Multi-window editing (⌘⇧O / ⌘⇧-click)

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| ⌘K | Command palette |
| ⌘P / ⌘O | Quick open |
| ⌘N | New note |
| ⌘S | Save (flushes auto-save) |
| ⌘E | Toggle raw Markdown |
| ⌘I | Toggle Inspector |
| ⌘F | Search |
| ⌘[ / ⌘] | Back / forward |
| ⌘⇧G | Commit dialog |
| ⌘⇧O | Open note in new window |
| `[[` | Wikilink autocomplete |

## Development

Prereqs: Rust (stable), Node 20+, pnpm, git, Xcode CLT.

```sh
pnpm install
pnpm tauri dev      # run the app
pnpm test           # frontend unit tests (vitest)
cd src-tauri && cargo test   # backend tests
pnpm tauri build    # production bundle
```

App settings live at `~/.config/com.vault.app/settings.json`.

## Sync

Vault never runs its own sync server. Add any git remote inside your vault:

```sh
git remote add origin git@github.com:you/my-vault.git
```

Auto-sync pulls (rebase, autostash) and pushes on the configured interval; the
status bar shows Synced / Syncing / Conflict / Error.

## Deferred past v0.1

Side-by-side conflict resolver (conflicts are detected and listed), neighborhood
view, pinned saved views, in-app update notifications, opt-in telemetry,
Playwright E2E, Windows/Linux builds, and all AI/MCP integrations (v2 per the PRD).
