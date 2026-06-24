# Agents Context

## Project Overview
Vault — a local-first personal knowledge base desktop app. Built with Tauri 2 (Rust + WebView), React 19 frontend, plain Markdown files on disk.

## Architecture
| Layer | Tech |
|-------|------|
| Desktop shell | Tauri 2 (Rust backend + system WebView) |
| Web server | Axum (Rust) for PWA/web access |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4 |
| Rich text | BlockNote (block-based) |
| Raw editor | CodeMirror 6 |
| State | Zustand |
| Git | System git CLI, shelled from Rust |

## Key Directories
| Path | Purpose |
|------|---------|
| `src-tauri/` | Rust Tauri backend |
| `src/` | React frontend |
| `server/` | Axum web server for PWA/deploy |

## Key Commands
```bash
pnpm tauri dev        # run in development
pnpm tauri build      # build .app / .dmg
pnpm build:web        # web frontend → dist-web/
cd server && cargo build --release  # web server binary
```

## Important Conventions
- **Files first**: notes are plain `.md` files. The app never owns your data.
- **Git first**: every vault is a git repo. Auto-commits on idle.
- **Wikilinks**: `[[Title]]` syntax — links round-trip to plain Markdown on disk
- **Frontmatter fields**: title, type, status, tags, starred, url, belongs_to, related_to, has, start_date, end_date
- **PWA**: for iOS web access, deploy `server/` on a VPS with nginx TLS termination
- **Settings**: `~/.config/com.vault.app/settings.json` — delete to reset app (notes untouched)

## Who's Who
- **Product**: Sachin Acharya (sachin) — wrote the PRD, owns the vision
- **Built with**: Claude Code (claude.ai/code)

## Roadmap
- **v0.x**: conflict resolution UI, neighborhood view, pinned saved views
- **v1.x**: Windows/Linux builds, Playwright E2E, code signing
- **v2.0**: MCP server + AI integrations, plugin system, semantic search, multi-vault

## If You're Contributing
1. All changes write to disk **first** via Tauri IPC — if disk write fails, UI update is rolled back
2. Heavy editor bundles are lazy-loaded — app shell starts fast
3. Desktop and web share the same frontend code — swap at compile time via Vite aliases (`src/lib/ipc.web.ts`)
4. Never commit to `src-tauri/target/` or `dist-web/` — those are build outputs
