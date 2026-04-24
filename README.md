<div align=center>
       
<img src="public/flint-logo.png" style="width: 15%; height: auto;"> 

![Flint](https://img.shields.io/badge/version-1.0.0-amber?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=flat-square)

</div>

---

# Flint 

> - A **secure, local-first knowledge base** with AI-powered intelligence. Your notes, your graph, your AI — all running locally on your machine.

---

https://github.com/user-attachments/assets/94fa53f9-b3b6-4df8-9038-3f763aec54d4

---

##  Installation

### Prerequisites
- **Node.js** 18+ — [Install](https://nodejs.org)
- **Python 3** (for AI Agent) — `sudo apt install python3 python3-pip`
- **Ollama** (for AI) — [Install](https://ollama.ai) then `ollama pull llama3.2`

### Install with 
```bash
git clone https://github.com/Chintanpatel24/flint.git
cd flint
bash install.sh
bash update.sh
npm audit fix --force
```

### for devloping ,
```bash
git clone --branch test-api --single-branch https://github.com/Chintanpatel24/flint.git
```

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