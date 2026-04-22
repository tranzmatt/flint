#!/usr/bin/env python3
"""
Flint AI Agent — Local Python Agent with Ollama + Web Search + Note Memory
Runs on http://localhost:5100
"""

import json
import time
import threading
import requests
from flask import Flask, request, Response, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins="*")

OLLAMA_URL = "http://localhost:11434"
AGENT_PORT = 5100


# ── Health Check ──────────────────────────────────────────────

@app.route("/status", methods=["GET"])
def status():
    """Check if Ollama is running"""
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        if r.ok:
            data = r.json()
            models = [m["name"] for m in data.get("models", [])]
            return jsonify({"status": "connected", "models": models, "agent": "flint"})
        return jsonify({"status": "disconnected", "models": [], "agent": "flint"})
    except Exception:
        return jsonify({"status": "disconnected", "models": [], "agent": "flint"})


@app.route("/models", methods=["GET"])
def get_models():
    """List available Ollama models"""
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        if r.ok:
            data = r.json()
            return jsonify({"models": [m["name"] for m in data.get("models", [])]})
        return jsonify({"models": []})
    except Exception:
        return jsonify({"models": []})


# ── Web Search ────────────────────────────────────────────────

def web_search(query, max_results=3):
    """Search Wikipedia for real-time information"""
    results = []
    try:
        r = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "opensearch",
                "search": query,
                "limit": max_results,
                "format": "json",
                "origin": "*",
            },
            timeout=5,
        )
        if r.ok:
            data = r.json()
            if data and len(data) >= 4:
                for i in range(len(data[1])):
                    title = data[1][i]
                    snippet = data[2][i] if i < len(data[2]) else ""
                    url = data[3][i] if i < len(data[3]) else ""
                    if snippet:
                        results.append({"title": title, "snippet": snippet, "url": url})
    except Exception:
        pass

    # Get summaries for top results
    detailed = []
    for r_item in results[:3]:
        try:
            sr = requests.get(
                f"https://en.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(r_item['title'])}",
                timeout=5,
            )
            if sr.ok:
                sdata = sr.json()
                extract = sdata.get("extract", "")
                if extract:
                    detailed.append(f"**{r_item['title']}**: {extract}")
        except Exception:
            if r_item["snippet"]:
                detailed.append(f"**{r_item['title']}**: {r_item['snippet']}")

    if detailed:
        return f"=== WEB SEARCH RESULTS for \"{query}\" ===\n\n" + "\n\n".join(detailed) + "\n\n=== END WEB RESULTS ==="
    return ""


def needs_internet(query):
    """Check if query likely needs internet access"""
    q = query.lower()
    keywords = [
        "what is", "who is", "when was", "where is", "how does",
        "latest", "recent", "current", "today", "news", "weather",
        "explain", "define", "meaning of", "tell me about",
        "compare", "difference between", "vs", "versus",
        "search", "look up", "find out", "internet", "web",
        "how to", "tutorial", "guide", "learn",
    ]
    return any(kw in q for kw in keywords)


# ── Memory Builder ────────────────────────────────────────────

def build_memory(notes, active_note_id, query, max_notes=10):
    """Build memory context from notes and their graph connections"""
    if not notes:
        return "No notes available in the vault yet."

    # Build graph
    graph = {}
    note_map = {}
    for n in notes:
        nid = n.get("id", "")
        title = n.get("title", "")
        content = n.get("content", "")
        note_map[nid] = {"title": title, "content": content}
        graph[nid] = set()

    # Extract [[wiki links]]
    import re
    for n in notes:
        nid = n.get("id", "")
        content = n.get("content", "")
        for m in re.finditer(r'\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]', content):
            link_name = m.group(1).strip().lower()
            for other_id, other_data in note_map.items():
                if other_data["title"].lower() == link_name and other_id != nid:
                    graph[nid].add(other_id)
                    graph[other_id].add(nid)

    # Score notes by relevance
    scores = {}
    query_lower = query.lower()
    query_words = [w for w in query_lower.split() if len(w) > 2]

    for nid, ndata in note_map.items():
        score = 0
        title_lower = ndata["title"].lower()
        content_lower = ndata["content"].lower()

        # Title match
        if query_lower in title_lower:
            score += 20

        # Word matches
        for w in query_words:
            if w in title_lower:
                score += 8
            count = content_lower.count(w)
            if count > 0:
                score += min(count * 2, 12)

        # Active note bonus
        if nid == active_note_id:
            score += 15

        # Connection to active note
        if active_note_id and active_note_id in graph.get(nid, set()):
            score += 8

        # Graph centrality
        centrality = len(graph.get(nid, set()))
        score += min(centrality * 1.5, 10)

        if score > 0:
            scores[nid] = score

    # Sort by score and take top notes
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:max_notes]
    selected_ids = set([nid for nid, _ in ranked])

    # Expand to 1-hop neighbors
    for nid in list(selected_ids):
        for conn_id in graph.get(nid, set()):
            selected_ids.add(conn_id)

    # Build context string
    lines = []
    lines.append("=== YOUR MEMORY (Flint Vault Knowledge Base) ===")
    lines.append(f"Total notes in vault: {len(notes)}")
    lines.append("")

    # Connection map
    lines.append("=== MEMORY MAP (Note Connections) ===")
    for nid in sorted(graph, key=lambda x: len(graph[x]), reverse=True):
        if graph[nid]:
            conn_names = [note_map[cid]["title"] for cid in graph[nid] if cid in note_map]
            if conn_names:
                lines.append(f'"{note_map[nid]["title"]}" → {", ".join(f\'"{cn}"\' for cn in conn_names)}')
    lines.append("")

    # Active note
    if active_note_id and active_note_id in note_map:
        adata = note_map[active_note_id]
        neighbors = [note_map[cid]["title"] for cid in graph.get(active_note_id, set()) if cid in note_map]
        lines.append("=== CURRENTLY OPEN NOTE ===")
        lines.append(f'Title: "{adata["title"]}"')
        if neighbors:
            lines.append(f"Connected to: {', '.join(neighbors)}")
        content = adata["content"]
        lines.append(content[:2000] + ("\n...[truncated]" if len(content) > 2000 else ""))
        lines.append("")

    # Related notes
    lines.append("=== RELATED MEMORIES ===")
    for nid in list(selected_ids)[:max_notes + 5]:
        if nid == active_note_id:
            continue
        if nid not in note_map:
            continue
        ndata = note_map[nid]
        neighbors = [note_map[cid]["title"] for cid in graph.get(nid, set()) if cid in note_map]
        lines.append(f'\n--- "{ndata["title"]}" ---')
        if neighbors:
            lines.append(f"Connected to: {', '.join(neighbors)}")
        content = ndata["content"]
        lines.append(content[:1000] + ("\n...[truncated]" if len(content) > 1000 else ""))

    return "\n".join(lines)


# ── Built-in Fallback ─────────────────────────────────────────

def builtin_response(query, notes, active_note_id):
    """Built-in response when Ollama is not available"""
    import re as regex

    q = query.lower().strip()
    note_map = {n["id"]: n for n in notes}
    graph = {}
    for n in notes:
        graph[n["id"]] = set()
    for n in notes:
        for m in regex.finditer(r'\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]', n.get("content", "")):
            link_name = m.group(1).strip().lower()
            for other in notes:
                if other["title"].lower() == link_name and other["id"] != n["id"]:
                    graph[n["id"]].add(other["id"])
                    graph[other["id"]].add(n["id"])

    active_note = note_map.get(active_note_id)

    # List notes
    if any(kw in q for kw in ["list", "show", "all note"]):
        if "note" in q or "all" in q or "everything" in q:
            if not notes:
                return "Your vault is empty. Create some notes to get started!"
            resp = f"You have **{len(notes)} notes** in your vault:\n\n"
            for n in notes:
                conns = len(graph.get(n["id"], set()))
                resp += f"- **{n['title']}** ({conns} connection{'s' if conns != 1 else ''})\n"
            total_conns = sum(len(v) for v in graph.values()) // 2
            resp += f"\nTotal connections: {total_conns}"
            return resp

    # Connections
    if any(kw in q for kw in ["connection", "link", "graph", "connect"]):
        connected = [(nid, conns) for nid, conns in graph.items() if len(conns) > 0]
        connected.sort(key=lambda x: len(x[1]), reverse=True)
        if not connected:
            return "No connections found. Use `[[Note Name]]` syntax to link notes together."
        resp = f"**{len(connected)} notes** have connections:\n\n"
        for nid, conns in connected:
            names = [note_map[cid]["title"] for cid in conns if cid in note_map]
            resp += f'- **{note_map[nid]["title"]}** → {", ".join(names)}\n'
        return resp

    # Tags
    if "tag" in q:
        all_tags = {}
        for n in notes:
            for t in regex.finditer(r'#(\w[\w-]*)', n.get("content", "")):
                tag = t.group(1)
                all_tags.setdefault(tag, []).append(n["title"])
        if not all_tags:
            return "No tags found. Use `#tag` syntax to tag your notes."
        resp = f"**{len(all_tags)} tags** found:\n\n"
        for tag, note_list in all_tags.items():
            resp += f'- **#{tag}** ({len(note_list)} note{"s" if len(note_list) > 1 else ""}): {", ".join(note_list)}\n'
        return resp

    # Help
    if "help" in q or "what can you" in q:
        return """I'm **Flint AI** — I can help you with your notes!

**Things I can do:**
- List all your notes and connections
- Search through your vault
- Summarize note contents
- Show the connection graph
- Find related topics
- Answer questions about your notes

**Tips:**
- Use `[[Note Name]]` to connect notes
- Use `#tag` to categorize
- Open Graph View (Ctrl+G) to visualize connections

**For smarter AI:** Install [Ollama](https://ollama.ai) and run a model like `llama3.2` or `mistral` for full AI-powered responses."""

    # Search notes
    search_words = [w for w in regex.sub(r'[?.,!]', '', q).split() if len(w) > 2]
    matched = []
    for n in notes:
        content = (n["title"] + " " + n.get("content", "")).lower()
        if any(w in content for w in search_words):
            matched.append(n)

    if matched:
        resp = ""
        if active_note:
            resp += f'Based on your vault (currently viewing **"{active_note["title"]}"**):\n\n'
        else:
            resp += "Based on your vault:\n\n"
        for n in matched[:5]:
            conns = [note_map[cid]["title"] for cid in graph.get(n["id"], set()) if cid in note_map]
            resp += f"### {n['title']}\n"
            if conns:
                resp += f"*Connected to: {', '.join(conns)}*\n"
            content = n.get("content", "")
            paragraphs = content.split("\n\n")
            relevant = [p for p in paragraphs if any(w in p.lower() for w in search_words)]
            if relevant:
                resp += "\n\n".join(relevant[:3])
            else:
                resp += "\n\n".join(paragraphs[:2])
            resp += "\n\n"
        if len(matched) > 5:
            resp += f"...and {len(matched) - 5} more related notes.\n"
        total_conns = sum(len(v) for v in graph.values()) // 2
        resp += f"\n*Found {len(matched)} relevant notes across {len(notes)} total notes with {total_conns} connections.*"
        return resp

    # Default
    resp = f'I searched through your **{len(notes)} notes** but couldn\'t find anything specifically matching "{query}".\n\n'
    if notes:
        resp += "**Your vault contains:**\n"
        for n in notes[:8]:
            resp += f"- {n['title']}\n"
        if len(notes) > 8:
            resp += f"...and {len(notes) - 8} more\n"
    resp += "\n*Tip: For smarter AI responses, install Ollama and run a model.*"
    return resp


# ── Chat Endpoint (Streaming) ─────────────────────────────────

@app.route("/chat", methods=["POST"])
def chat():
    """Main chat endpoint — streams response from Ollama or uses built-in"""
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    query = data.get("query", "")
    notes = data.get("notes", [])
    active_note_id = data.get("activeNoteId", None)
    settings = data.get("settings", {})
    history = data.get("history", [])

    model = settings.get("model", "")
    ollama_url = settings.get("ollamaUrl", OLLAMA_URL)
    temperature = settings.get("temperature", 0.7)
    max_context = settings.get("maxContextNotes", 10)
    internet_access = settings.get("internetAccess", True)
    system_prompt = settings.get("systemPrompt", "You are Flint AI, a helpful assistant with access to the user's note vault.")

    # Build memory
    memory = build_memory(notes, active_note_id, query, max_context)

    # Web search if needed
    web_results = ""
    if internet_access and needs_internet(query):
        web_results = web_search(query)

    # If no model, use built-in
    if not model or not model.strip():
        response_text = builtin_response(query, notes, active_note_id)
        if web_results:
            response_text += f"\n\n---\n*Web search was performed but no AI model to process it. Install Ollama for full AI + web.*"

        def stream_builtin():
            for i in range(0, len(response_text), 3):
                chunk = response_text[i:i+3]
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield f"data: {json.dumps({'done': True, 'webResults': web_results or None, 'usedOllama': False})}\n\n"

        return Response(stream_builtin(), mimetype="text/event-stream")

    # Use Ollama
    system_content = f"{system_prompt}\n\n{memory}"
    if web_results:
        system_content += f"\n\n=== INTERNET ACCESS ===\nYou have internet access. Here are web search results:\n{web_results}\n\nUse these alongside your memory. Cite sources when using web information."

    active_note = None
    for n in notes:
        if n.get("id") == active_note_id:
            active_note = n
            break
    system_content += f'\n\nCurrent active note: "{active_note["title"] if active_note else "None"}"'

    messages = [{"role": "system", "content": system_content}]
    for h in history[-10:]:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": query})

    def stream_ollama():
        try:
            resp = requests.post(
                f"{ollama_url}/api/chat",
                json={
                    "model": model,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "temperature": temperature,
                        "num_ctx": 8192,
                        "top_p": 0.9,
                    },
                },
                stream=True,
                timeout=180,
            )

            if not resp.ok:
                error_text = resp.text
                try:
                    error_json = json.loads(error_text)
                    err_msg = error_json.get("error", f"Ollama error ({resp.status_code})")
                except Exception:
                    err_msg = f"Ollama error ({resp.status_code})"

                if "not found" in err_msg or "model" in err_msg.lower():
                    err_msg = f'Model "{model}" not found. Run: `ollama pull {model}`'

                # Fall back to built-in
                fallback = builtin_response(query, notes, active_note_id)
                for i in range(0, len(fallback), 3):
                    chunk = fallback[i:i+3]
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
                yield f"data: {json.dumps({'done': True, 'error': err_msg, 'usedOllama': False})}\n\n"
                return

            full_content = ""
            for line in resp.iter_lines():
                if line:
                    try:
                        chunk = json.loads(line)
                        content = chunk.get("message", {}).get("content", "")
                        if content:
                            full_content += content
                            yield f"data: {json.dumps({'content': content})}\n\n"
                        if chunk.get("done"):
                            yield f"data: {json.dumps({'done': True, 'webResults': web_results or None, 'usedOllama': True})}\n\n"
                            return
                    except json.JSONDecodeError:
                        continue

            # Stream ended without done=True
            yield f"data: {json.dumps({'done': True, 'webResults': web_results or None, 'usedOllama': True})}\n\n"

        except requests.exceptions.ConnectionError:
            # Ollama not running — fall back to built-in
            fallback = builtin_response(query, notes, active_note_id)
            for i in range(0, len(fallback), 3):
                chunk = fallback[i:i+3]
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield f"data: {json.dumps({'done': True, 'error': 'Ollama not running. Using built-in search.', 'usedOllama': False})}\n\n"

        except requests.exceptions.Timeout:
            yield f"data: {json.dumps({'done': True, 'error': 'Request timed out. Try a shorter query or faster model.'})}\n\n"

        except Exception as e:
            fallback = builtin_response(query, notes, active_note_id)
            for i in range(0, len(fallback), 3):
                chunk = fallback[i:i+3]
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield f"data: {json.dumps({'done': True, 'error': str(e), 'usedOllama': False})}\n\n"

    return Response(stream_ollama(), mimetype="text/event-stream")


# ── Start ─────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("  Flint AI Agent")
    print("  Running on http://localhost:5100")
    print("=" * 50)

    # Check Ollama
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        if r.ok:
            models = [m["name"] for m in r.json().get("models", [])]
            print(f"  ✓ Ollama connected — {len(models)} model(s) available")
            for m in models:
                print(f"    - {m}")
        else:
            print("  ✗ Ollama not responding")
    except Exception:
        print("  ✗ Ollama not running — built-in AI will be used")
        print("    Install Ollama: https://ollama.ai")

    print("=" * 50)
    app.run(host="0.0.0.0", port=AGENT_PORT, debug=False, threaded=True)
