<div align=center>
       
<img src="public/flint-logo.png" style="width: 15%; height: auto;"> 

![Flint](https://img.shields.io/badge/version-1.0.0-amber?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=flat-square)

</div>

---

# *Flint* 

> - A **secure, local-first knowledge base** with AI-powered intelligence. Your notes, your graph, your AI - all running locally on your machine.

---

<img width="1324" height="767" alt="flint" src="https://github.com/user-attachments/assets/57b27b77-5d98-45f5-96bd-dd65575323c8" />

https://github.com/user-attachments/assets/94fa53f9-b3b6-4df8-9038-3f763aec54d4

https://github.com/user-attachments/assets/eab43b70-609a-4373-8f2c-8afc854dece9
> [!IMPORTANT]  
> - This version is for the production, but somehow it's not installed as a default, so check your installed filnt with this video's font GUI.

---

##  Installation

### For useres (Linux/Mac)
```bash
git clone https://github.com/Chintanpatel24/flint.git
cd flint
bash install.sh
```
> [!IMPORTANT]  
> - Make sure that you installed all the required libraries like Flask, requests, and llama-cpp so that the agent can work, and launch it from the terminal for the agent to start and use, and launch it from the app menu if you only want a GUI for the non-taking. 

### For errors @
```bash
bash update.sh
npm audit fix --force
```

### For devloping ,
```bash
git clone --branch <branch name> --single-branch https://github.com/Chintanpatel24/flint.git
```

---

## Features

>### Note-Taking
- Full **Markdown** support with live preview
- **Wiki Links** (`[[Note Name]]`) to connect notes
- **Tags** (`#tag`) for categorization
- **Auto-save** with 600ms debounce
- Split view (Editor + Preview)
- Formatting toolbar (Bold, Italic, Heading, Quote, Code, Links, Lists)

>### Graph View
- Interactive **force-directed graph** visualization
- Node size scales with connection count
- Physics simulation - drag nodes, connected notes follow
- Zoom, pan, search, depth filter
- Curved edges between connected notes

>### AI Agent (Python + Ollama + GGUF + APIs)
- **Real Python backend** that connects to Ollama locally
- **Notes = Memory** - AI reads all your notes and graph connections
- **Internet access** - AI searches Wikipedia for real-time info
- **Works with ANY Ollama model** - llama3.2, mistral, codellama, phi3, etc.
- **Streaming responses** in real-time
- **Browser fallback** when agent is not running

>### Local & Secure 
- **No cloud, no tracking** - all data stays on your device
- **localStorage** for persistence
- **No external API calls** (except Wikipedia when internet access is enabled)
- **File System Access API** to open any local folder as a vault

---

> [!NOTE]  
> There's an unfound or unknown error faced by me; the new version does not get installed by the clone in default.  
>If the old version gets installed in your system, you can install it by downloading the flint.zip and then installing it in your system. By this, the hope is that the new version of flint gets installed in your system. 
