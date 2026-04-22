<div align="center">
  <img src="public/flint-logo.png" style="width: 10%; height: auto;">
</div>   


# ⬡ Flint

A **secure, local-first knowledge base** with AI-powered intelligence. Your notes, your graph, your AI — all running locally on your machine.

---

## Features

### Note-Taking
- Full **Markdown** support with live preview
- **Wiki Links** (`[[Note Name]]`) to connect notes
- **Tags** (`#tag`) for categorization
- **Auto-save** with 600ms debounce
- Split view (Editor + Preview)
- Formatting toolbar (Bold, Italic, Heading, Quote, Code, Links, Lists)

### Graph View
- Interactive **force-directed graph** visualization
- Node size scales with connection count
- Physics simulation — drag nodes, connected notes follow
- Zoom, pan, search, depth filter
- Curved edges between connected notes

### AI Agent (Python + Ollama)
- **Real Python backend** that connects to Ollama locally
- **Notes = Memory** — AI reads all your notes and graph connections
- **Internet access** — AI searches Wikipedia for real-time info
- **Works with ANY Ollama model** — llama3.2, mistral, codellama, phi3, etc.
- **Streaming responses** in real-time
- **Browser fallback** when agent is not running

### Local & Secure
- **No cloud, no tracking** — all data stays on your device
- **localStorage** for persistence
- **No external API calls** (except Wikipedia when internet access is enabled)
- **File System Access API** to open any local folder as a vault

---

##  Installation

### Prerequisites
- **Node.js** 18+ — [Install](https://nodejs.org)
- **Python 3** (for AI Agent) — `sudo apt install python3 python3-pip`
- **Ollama** (for AI) — [Install](https://ollama.ai) then `ollama pull llama3.2`

### Install
```bash
git clone https://github.com/Chintanpatel24/flint.git
cd flint
bash install.sh
```

### One-liner
```bash
bash <(curl -sL https://raw.githubusercontent.com/Chintanpatel24/flint/main/install.sh)
```

After install, Flint appears in your **app menu**. Or run `flint` from terminal.

---

## Usage

### Commands
| Command | Description |
|---------|-------------|
| `flint` | Launch Flint desktop app |
| `flint-agent` | Start AI agent only (for browser mode) |
| `bash update.sh` | Check for updates and rebuild |
| `bash uninstall.sh` | Remove Flint from system |

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New note |
| `Ctrl+E` | Cycle view mode (Edit → Preview → Split) |
| `Ctrl+G` | Graph view |
| `Ctrl+P` | Command palette |
| `Ctrl+Shift+F` | Search notes |
| `Ctrl+J` | Toggle AI chat |
| `Ctrl+\` | Toggle sidebar |
| `Ctrl+,` | Settings |

### AI Agent
The Python agent runs automatically when Flint starts (Electron mode).

For browser mode, start it manually:
```bash
flint-agent
# or: python3 ~/.flint/agent/agent.py
```

Install an Ollama model:
```bash
ollama pull llama3.2    # Small, fast
ollama pull mistral     # Good balance
ollama pull codellama   # Code-focused
```

---

## Architecture

```
User asks question
       ↓
┌───────────────────────────────┐
│  Python Agent (port 5100)     │
│  ├─ Receives query + notes    │
│  ├─ Builds knowledge graph    │
│  ├─ Scores notes by relevance │
│  ├─ Expands to neighbors      │
│  ├─ Searches Wikipedia (opt)  │
│  ├─ Sends to Ollama           │
│  └─ Streams response back     │
└───────────────────────────────┘
       ↓
   Browser renders in chat UI
```

---

## Project Structure

```
flint/
├── src/
│   ├── components/
│   │   ├── AIChat.tsx         # AI chat panel
│   │   ├── Editor.tsx         # Markdown editor
│   │   ├── GraphView.tsx      # Interactive graph
│   │   ├── Sidebar.tsx        # File explorer
│   │   ├── Preview.tsx        # Markdown preview
│   │   ├── Settings.tsx       # Settings panel
│   │   ├── VaultScreen.tsx    # Vault selection
│   │   └── ...
│   ├── services/
│   │   └── ollama.ts          # Agent API client
│   ├── store.tsx              # State management
│   ├── types.ts               # TypeScript types
│   └── App.tsx                # Main layout
├── agent/
│   ├── agent.py               # Python AI agent server
│   └── requirements.txt       # Python dependencies
├── electron/
│   └── main.cjs               # Electron desktop wrapper
├── install.sh                 # Installer
├── update.sh                  # Updater
└── uninstall.sh               # Uninstaller
```

---

## Installed Location

After `bash install.sh`:
```
~/.flint/
├── app/                    # Electron app
│   ├── main.cjs            # Desktop wrapper
│   ├── dist/               # Built web app
│   ├── agent/              # Python agent
│   └── node_modules/       # Electron
├── agent/                  # Standalone agent
│   ├── agent.py
│   └── requirements.txt
├── icons/                  # App icons
├── flint                   # Launcher script
└── flint-agent             # Agent launcher
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Tailwind CSS |
| Build | Vite (single-file output) |
| State | useReducer + Context |
| Desktop | Electron |
| AI Agent | Python + Flask |
| AI Engine | Ollama (any model) |
| Web Search | Wikipedia API |
| Storage | localStorage (browser) |
