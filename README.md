<div align=center>
<img src="public/flint-logo.png" alt="Flint Logo" width="100" height="100">   
</div>

# Flint

**Secure, local-first knowledge base — a web-based Obsidian clone with AI.**



---

## Features

### 📝 Markdown Editor
- Full markdown editing with live preview
- Wiki-style `[[links]]` between notes
- Working formatting toolbar (Bold, Italic, Heading, Quote, Code, Link, List, Tag)
- Auto-save (600ms debounced)
- Split view (edit + preview side-by-side)

### 📁 Vault System
- File explorer with folders and notes
- Create, rename, delete notes and folders
- Pin important notes
- Context menus on right-click
- All data stored in localStorage (private, no cloud)

### 🔗 Knowledge Graph
- Interactive force-directed graph of all note connections
- Node size scales with connection count
- Drag nodes to rearrange (connected nodes follow via physics)
- Zoom, pan, double-click to re-center
- Physics simulation with pause/resume

### 🧠 AI Assistant (Ollama)
- Chat with AI about your notes
- Notes serve as AI memory — graph connections provide context
- Uses locally-hosted Ollama (no data leaves your machine)
- Streaming responses in real-time
- Configure model, temperature, context size in Settings → AI

### ⚙️ Settings
- Editor: font size, tab size, word wrap, auto-save, spell check
- AI: Ollama URL, model, temperature, context notes, system prompt
- About: version info

### 🎨 Pure Black Theme
- Deep matte black interface (`#0a0a0a`)
- Obsidian-style three-panel layout
- 48px ribbon + sidebar + editor + right panel
- No purple, no blue — pure grayscale

---

## Install as Desktop App

### Prerequisites
- **Node.js 18+** — [Install here](https://nodejs.org)

### Install
```bash
git clone https://github.com/Chintanpatel24/flint.git
cd flint
bash install.sh
```

After install, Flint appears in your **app menu** as a native desktop application.

### Run from terminal
```bash
flint
```

### Update
```bash
cd flint
bash update.sh
```
If nothing changed, prints: **"App is up to date"**

### Uninstall
```bash
bash uninstall.sh
```
Option to keep or remove vault data.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New note |
| `Ctrl+E` | Cycle view mode (Edit → Preview → Split) |
| `Ctrl+G` | Graph view |
| `Ctrl+P` | Command palette |
| `Ctrl+J` | AI chat panel |
| `Ctrl+Shift+F` | Search notes |
| `Ctrl+\` | Toggle sidebar |
| `Ctrl+,` | Settings |
| `Ctrl+S` | Force save |

---

## How It Works

### Desktop App Architecture
```
~/.flint/
├── app/                    # Isolated Electron app
│   ├── package.json        # NO "type":"module" (avoids ESM conflicts)
│   ├── main.cjs            # Electron main process (CommonJS)
│   ├── dist/               # Built web app (single HTML file)
│   │   └── index.html
│   └── node_modules/       # Electron only
│       └── electron/
├── flint                   # Launcher script
└── icon.png                # Desktop icon
```

### Why `.cjs`?
The web app uses Vite with `"type": "module"` in `package.json`. Electron's main process uses `require()` (CommonJS). The `.cjs` extension forces CommonJS mode, and the Electron app lives in its own directory with no `"type"` field — completely eliminating ESM/CJS conflicts.

### AI Memory System
```
User asks question
       ↓
Build graph from [[wiki links]]
       ↓
Score notes by keywords + graph proximity
       ↓
Expand to 1-hop neighbor notes
       ↓
Send context + history to Ollama
       ↓
Stream response to chat UI
```

### Data Storage
All notes, folders, settings, and vault data stored in **localStorage**. Nothing leaves your machine. No server, no cloud, no tracking.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript |
| Build | Vite 7 (single-file output) |
| Styling | Tailwind CSS 4 |
| Desktop | Electron |
| AI | Ollama (local LLM) |
| Icons | Lucide React |

---

## Project Structure

```
flint/
├── src/
│   ├── App.tsx              # Main layout + command palette
│   ├── store.tsx            # State management (useReducer + Context)
│   ├── types.ts             # TypeScript types
│   ├── index.css            # Global styles
│   ├── components/
│   │   ├── Sidebar.tsx      # File explorer
│   │   ├── TabBar.tsx       # Open note tabs
│   │   ├── Editor.tsx       # Markdown editor
│   │   ├── Preview.tsx      # Markdown preview
│   │   ├── GraphView.tsx    # Knowledge graph
│   │   ├── SearchModal.tsx  # Search across notes
│   │   ├── StatusBar.tsx    # Bottom status bar
│   │   ├── BacklinksPanel.tsx # Right panel
│   │   ├── VaultScreen.tsx  # Vault selector
│   │   ├── Settings.tsx     # Settings panel
│   │   └── AIChat.tsx       # AI chat panel
│   └── services/
│       └── ollama.ts        # Ollama API client
├── electron/
│   └── main.cjs             # Electron main process
├── public/
│   └── flint-logo.png       # App icon
├── install.sh               # Desktop installer
├── update.sh                # Update checker
├── uninstall.sh             # Uninstaller
└── package.json
```

---

## License

MIT
