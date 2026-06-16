<div align=center>
       
<img src="public/flint-logo.png" style="width: 15%; height: auto;"> 
<br>

![Flint](https://img.shields.io/badge/version-2.0.2.6-amber?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=flat-square)

</div>

---

# ***Flint*** 
>- A **secure, local-first knowledge base** with AI-powered intelligence. Your notes, your graph, your AI - all running locally on your machine.

---

<div align=center>

https://github.com/user-attachments/assets/8f570dfe-9b1c-4076-8c05-b6f0e0d29be1

</div>

---

##  Installation

### For `Linux/Mac` useres 
```bash
git clone https://github.com/Chintanpatel24/flint.git
cd flint
bash install.sh
```

> [!IMPORTANT]
> - Under active devlopment !!
> - Make sure that you installed all the required libraries like Flask, requests, and llama-cpp so that the agent can work, and launch it from the terminal for the agent to start and use, and launch it from the app menu if you only want a GUI for the note-taking. 

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
- Physics simulation - drag nodes, connected notes follow
- Zoom, pan, search, depth filter
- Curved edges between connected notes

### AI Agent (`Ollama`)
- **Real Python backend** that connects to Ollama locally (*if you lunch from terminal*)
- **Notes = Memory** - AI reads all your notes and graph connections
- **Internet access** - AI searches Wikipedia for real-time info
- **Works with ANY Ollama model** (which have tool calling support) - llama3.2, mistral, codellama, phi3, etc.
- **Streaming responses** in real-time
- **Browser fallback** when agent is not running

### Local & Secure 
- **No cloud, no tracking** - all data stays on your device
- **localStorage** for persistence
- **No external API calls** (except Wikipedia when internet access is enabled)
- **File System Access API** to open any local folder as a vault

## Aim

- [ ] Local hosted models use the internet and give you answers (if you ask)
- [ ] A flint agent can change the content in your notes by itself.
- [ ] Flint can manage all notes and can do tasks in that working space as per your command. 

>[!note]
> - This project needs developer support across a community, and this project may contain bugs and glitches, so if you notice something, please make an issue and feel free to make a PR for that.
> - ```
>   git clone --single-branch --branch <branch name> https://github.com/Chintanpatel24/flint.git
>   ```

## Star History

<a href="https://www.star-history.com/?repos=chintanpatel24%2Fflint&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=chintanpatel24/flint&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=chintanpatel24/flint&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=chintanpatel24/flint&type=date&legend=top-left" />
 </picture>
</a>
