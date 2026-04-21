# 🔥 Flint — Your Local Vault

> A local-first, secure knowledge base. Your thoughts, your data, your control.

Flint is a privacy-focused note-taking application inspired by Obsidian. All your data stays on your device — no cloud, no tracking, no subscriptions. Just you and your ideas.

![Flint](https://img.shields.io/badge/version-1.0.0-amber?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=flat-square)

## ✨ Features

- **📝 Markdown Editor** — Full GFM support with live preview and split view
- **🔗 Wiki Links** — Connect notes with `[[double brackets]]` syntax
- **🌐 Graph View** — Interactive force-directed knowledge graph (black theme)
- **🔒 Local & Secure** — All data stored on your device via encrypted localStorage
- **🏪 Multi-Vault** — Separate workspaces for different projects
- **📁 Folders** — Organize notes hierarchically
- **🔍 Search** — Instant full-text search across all notes
- **📌 Pinning** — Pin important notes for quick access
- **💾 Auto-save** — Never lose your work
- **⌨️ Keyboard Shortcuts** — Efficient workflow with hotkeys
- **🌙 Dark Theme** — Pure black, minimal, easy on the eyes

## 🚀 Installation

### Quick Install

```bash
# Clone the repository
git clone https://github.com/flint-vault/flint.git
cd flint

# Run the installer
bash install.sh
```

### Manual Install

```bash
# Install dependencies
npm install

# Build
npm run build

# Serve locally
npx serve dist
```

### First Run

After installation:

1. Restart your terminal
2. Run `flint` to start the server
3. Open `http://localhost:4512` in your browser
4. Create your first vault and start writing!

## 🔄 Updating

```bash
# Update to the latest version
bash update.sh

# Or using the flint command
flint update
```

The update script will:
- Pull the latest changes from the repository
- Show the changelog
- Rebuild the application
- Preserve all your vault data

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New note |
| `Ctrl+E` | Cycle view modes (Edit → Preview → Split) |
| `Ctrl+G` | Toggle graph view |
| `Ctrl+Shift+F` | Search all notes |
| `Ctrl+\` | Toggle sidebar |
| `Ctrl+S` | Force save |
| `Esc` | Close modal/search |

## 🏪 Vault System

Flint uses a **vault system** similar to Obsidian:

- **Multiple vaults** — Create separate workspaces (e.g., Personal, Work, Side Projects)
- **Independent data** — Each vault has its own notes, folders, and settings
- **Quick switching** — Switch between vaults from the vault selection screen
- **Persistent storage** — All data is saved to localStorage per vault

### Vault Data Location

```
~/.flint/
├── bin/
│   └── flint          # Launcher script
├── config/
│   └── settings.json  # Global settings
├── src/               # Application source
└── vaults/            # Vault data directories
```

## 🔒 Security

Flint is designed with privacy as a core principle:

- **Zero cloud** — No data ever leaves your device
- **No tracking** — No analytics, no telemetry, no phone-home
- **No accounts** — No sign-up, no login, no servers
- **Local storage** — All data in your browser's localStorage
- **Open source** — Audit the code yourself

## 🛠️ Development

```bash
# Clone
git clone https://github.com/flint-vault/flint.git
cd flint

# Install
npm install

# Development server
npm run dev

# Build for production
npm run build
```

## 📁 Project Structure

```
flint/
├── install.sh              # Installation script
├── update.sh               # Update script
├── README.md               # This file
├── index.html              # Entry HTML
├── package.json            # Dependencies
├── vite.config.ts          # Vite configuration
├── src/
│   ├── main.tsx            # React entry point
│   ├── App.tsx             # Main application
│   ├── index.css           # Global styles (black theme)
│   ├── types.ts            # TypeScript types
│   ├── store.tsx           # State management + vault logic
│   └── components/
│       ├── VaultScreen.tsx     # Vault selection/creation
│       ├── Sidebar.tsx         # File explorer
│       ├── Editor.tsx          # Markdown editor
│       ├── Preview.tsx         # Markdown preview
│       ├── GraphView.tsx       # Knowledge graph
│       ├── TabBar.tsx          # Tab management
│       ├── StatusBar.tsx       # Status bar
│       ├── SearchModal.tsx     # Search overlay
│       └── BacklinksPanel.tsx  # Backlinks panel
└── dist/                   # Built output
```

## 🎨 Theme

Flint uses a **pure black** dark theme designed for minimal distraction:

- Background: `#000000` (true black)
- Surfaces: `#0a0a0a` - `#111111`
- Text: `#e0e0e0` (primary), `#666666` (muted)
- Accent: `#f59e0b` (amber/gold)
- The graph view features a pure black canvas with amber glowing nodes

## 📄 License

MIT License — Free to use, modify, and distribute.

---

<p align="center">
  <strong>Flint</strong> — Your local vault. Your data. Your control. 🔥
</p>
