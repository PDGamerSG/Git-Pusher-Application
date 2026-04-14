# Git Pusher

A desktop Git commit and push assistant for Windows. Stages changes, generates AI-powered commit messages, and pushes — all from a compact taskbar overlay or the main app window.

## Features

- **Taskbar overlay** — a compact always-on-top bar that stays visible while you work. Type a feature description, press Enter, and it handles `git add`, `commit`, and `push` in one step.
- **AI commit messages** — auto-generates conventional commit messages from your diff using Groq, Grok (xAI), or OpenAI. Falls back to a simple `feat:` message if no API key is set.
- **Multi-project support** — add multiple Git repositories, switch between them from the sidebar or the taskbar overlay dropdown.
- **Virtual desktop aware** — the taskbar overlay only shows on the desktop where Git Pusher is running. Switching desktops hides it automatically.
- **Always on top** — the overlay stays above all other windows. The main window can also be pinned on top.
- **Launch on startup** — optionally start Git Pusher when you log in to Windows (configurable in Settings).
- **Position memory** — the taskbar overlay remembers where you dragged it and restores its position on next launch.
- **Git init support** — initialize a new repo, set the remote, and push the first commit from within the app.

## Installation

### From installer

Download the latest `.exe` installer from the [Releases](../../releases) page and run it. The installer lets you choose the install directory and creates desktop/start menu shortcuts.

### From source

Requires [Node.js](https://nodejs.org/) (v18+) and [Git](https://git-scm.com/).

```bash
git clone <repo-url>
cd git-pusher
npm install
```

**Development:**

```bash
npm run dev
```

This watches for file changes and auto-reloads.

**Production build:**

```bash
npm run build
```

The installer will be generated in the `release/` directory.

## Configuration

Open **Settings** (gear icon in the sidebar) to configure:

### API Key

Paste an API key from any supported provider. The prefix auto-detects the provider:

| Prefix  | Provider   | Model                  |
|---------|------------|------------------------|
| `gsk_`  | Groq       | llama-3.3-70b-versatile |
| `xai-`  | Grok (xAI) | grok-3-mini            |
| `sk-`   | OpenAI     | gpt-4o-mini            |

Use the **Test** button to verify connectivity before saving.

### Launch on startup

Toggle to automatically start Git Pusher when you log in to Windows. This uses the Windows registry login items — no background service required.

## Usage

### Main window

1. Click **Add project** in the sidebar and select a Git repository folder.
2. Name the project and it appears in the sidebar.
3. Type a feature description in the bottom bar and press Enter to push.
4. The terminal log shows each step (diff, commit message generation, push).

### Taskbar overlay

The overlay opens automatically when the app starts. It provides a compact bar with:

- **Drag handle** (dots on the left) — drag to reposition.
- **Project button** — click to switch between projects.
- **Feature input** — type and press Enter to push.
- **Status dot** — grey (idle), amber (pushing), green (success), red (error).

The overlay direction (dropdown opens above or below) is controlled from the sidebar.

## Project structure

```
main.js              — Electron main process
preload.js           — Main window preload (IPC bridge)
taskbar-preload.js   — Taskbar overlay preload (IPC bridge)
src/
  renderer.jsx       — Webpack entry point
  App.jsx            — Root React component
  components/        — UI components (Sidebar, RepoPanel, SettingsModal, etc.)
  ipc/
    gitHandlers.js   — Git operation IPC handlers
    grokHandler.js   — AI commit message generation
dist/
  index.html         — Main window HTML
  taskbar.html       — Taskbar overlay HTML
  renderer.js        — Bundled React app
assets/
  icon.ico           — Application icon
```

## Data storage

- **App settings** (projects, API key, push history) — stored in the renderer's `localStorage`, persisted across sessions.
- **Taskbar position** — stored in `%AppData%/GitPusher/taskbar-prefs.json`.
- **Taskbar band data** — stored in `%AppData%/GitPusher/projects.json` (for the optional native desk band).

## License

MIT
