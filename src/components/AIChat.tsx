import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { askFlintAI, fetchOllamaModels, checkOllamaStatus, checkAgentStatus } from '../services/ollama';
import { FlintLogo } from './FlintLogo';
import { X, Send, Trash2, User, Loader2, Settings, Wifi, Globe, Brain, BookOpen, Network, Sparkles, Zap, Cpu, Server, AlertTriangle } from 'lucide-react';

export function AIChat() {
  const { state, dispatch } = useStore();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [agentStatus, setAgentStatus] = useState<'checking' | 'agent-up' | 'agent-down'>('checking');
  const [ollamaStatus, setOllamaStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [models, setModels] = useState<string[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [contextPreview, setContextPreview] = useState<string | null>(null);
  const [memoryStats, setMemoryStats] = useState({ notes: 0, connections: 0, tags: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

  const { aiMessages, aiSettings, notes, activeNoteId } = state;

  // Calculate memory stats
  useEffect(() => {
    const connections = new Set<string>();
    let tags = 0;
    notes.forEach(n => {
      const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\\]]+)?\]\]/g);
      for (const m of matches) {
        const target = notes.find(nt => nt.title.toLowerCase() === m[1].toLowerCase());
        if (target && target.id !== n.id) {
          connections.add([n.id, target.id].sort().join('-'));
        }
      }
      const tagMatches = n.content.matchAll(/#(\w[\w-]*)/g);
      for (const _ of tagMatches) tags++;
    });
    setMemoryStats({ notes: notes.length, connections: connections.size, tags });
  }, [notes]);

  // Check agent + Ollama status periodically
  useEffect(() => {
    const check = async () => {
      const agentUp = await checkAgentStatus();
      if (agentUp) {
        setAgentStatus('agent-up');
        const oStatus = await checkOllamaStatus(aiSettings.ollamaUrl);
        setOllamaStatus(oStatus);
        if (oStatus === 'connected') {
          const fetchedModels = await fetchOllamaModels(aiSettings.ollamaUrl);
          setModels(fetchedModels);
          if (fetchedModels.length > 0 && (!aiSettings.model || !fetchedModels.includes(aiSettings.model))) {
            dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { model: fetchedModels[0] } });
          }
        }
      } else {
        setAgentStatus('agent-down');
        setOllamaStatus('disconnected');
        setModels([]);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [aiSettings.ollamaUrl, aiSettings.model, dispatch]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, streamContent]);

  const activeNote = notes.find(n => n.id === activeNoteId);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    abortRef.current = false;

    const userMsg = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      role: 'user' as const,
      content: trimmed,
      timestamp: Date.now(),
      noteContext: activeNoteId ? [activeNoteId] : undefined,
    };
    dispatch({ type: 'ADD_AI_MESSAGE', payload: userMsg });
    setInput('');
    setIsStreaming(true);
    setStreamContent('');

    const chatHistory = aiMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));

    await askFlintAI(
      trimmed,
      notes,
      activeNoteId,
      aiSettings,
      chatHistory,
      (chunk) => {
        if (abortRef.current) return;
        setStreamContent(prev => prev + chunk);
      },
      (fullContent, webResults, usedOllama) => {
        if (abortRef.current) return;
        const assistantMsg = {
          id: Math.random().toString(36).slice(2) + Date.now().toString(36),
          role: 'assistant' as const,
          content: fullContent,
          timestamp: Date.now(),
          webResults: usedOllama ? webResults : undefined,
        };
        dispatch({ type: 'ADD_AI_MESSAGE', payload: assistantMsg });
        setIsStreaming(false);
        setStreamContent('');
      },
      (err) => {
        if (abortRef.current) return;
        const errMsg = {
          id: Math.random().toString(36).slice(2) + Date.now().toString(36),
          role: 'assistant' as const,
          content: `${err}`,
          timestamp: Date.now(),
        };
        dispatch({ type: 'ADD_AI_MESSAGE', payload: errMsg });
        setIsStreaming(false);
        setStreamContent('');
      },
    );
  }, [input, isStreaming, notes, activeNoteId, aiMessages, aiSettings, dispatch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stopGeneration = () => {
    abortRef.current = true;
    setIsStreaming(false);
    if (streamContent) {
      const partial = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        role: 'assistant' as const,
        content: streamContent + '\n\n*[Generation stopped]*',
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_AI_MESSAGE', payload: partial });
      setStreamContent('');
    }
  };

  const isAgentMode = agentStatus === 'agent-up';
  const isOllamaMode = isAgentMode && ollamaStatus === 'connected' && !!aiSettings.model;

  return (
    <div style={{
      width: 380, height: '100%', background: '#080808',
      borderLeft: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        background: '#060606',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: '#111',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid #222',
        }}>
          <FlintLogo size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#aaa' }}>Flint AI</div>
          <div className="flex items-center gap-1" style={{ fontSize: 10, color: isOllamaMode ? '#5a5' : isAgentMode ? '#855' : '#655' }}>
            {isOllamaMode ? <Wifi size={8} /> : isAgentMode ? <Server size={8} /> : <Cpu size={8} />}
            {isOllamaMode
              ? `Ollama · ${aiSettings.model}`
              : isAgentMode
              ? 'Agent up · No Ollama'
              : 'Browser mode'}
          </div>
        </div>
        <button onClick={() => setShowConfig(!showConfig)} title="AI Settings"
          style={{ background: 'none', border: 'none', color: showConfig ? '#888' : '#444', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Settings size={14} />
        </button>
        <button onClick={() => dispatch({ type: 'TOGGLE_AI_CHAT' })} title="Close"
          style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <X size={14} />
        </button>
      </div>

      {/* Agent status banner */}
      {agentStatus === 'agent-down' && (
        <div style={{
          padding: '8px 14px', borderBottom: '1px solid #1a1a1a', background: '#0a0800',
          flexShrink: 0,
        }}>
          <div className="flex items-center gap-2" style={{ fontSize: 10, color: '#886' }}>
            <AlertTriangle size={10} />
            <span>Python agent not running — using browser fallback</span>
          </div>
          <div style={{ fontSize: 9, color: '#554', marginTop: 4, fontFamily: 'monospace', background: '#050500', padding: '4px 6px', borderRadius: 4, border: '1px solid #1a1a00' }}>
            python3 ~/.flint/agent/agent.py
          </div>
        </div>
      )}

      {/* Memory stats */}
      <div style={{
        padding: '6px 14px', borderBottom: '1px solid #1a1a1a',
        display: 'flex', gap: 12, background: '#050505', flexShrink: 0,
      }}>
        <div className="flex items-center gap-1" style={{ fontSize: 9, color: '#444' }}>
          <Brain size={8} /> {memoryStats.notes} notes
        </div>
        <div className="flex items-center gap-1" style={{ fontSize: 9, color: '#444' }}>
          <Network size={8} /> {memoryStats.connections} links
        </div>
        <div className="flex items-center gap-1" style={{ fontSize: 9, color: '#444' }}>
          <Sparkles size={8} /> {memoryStats.tags} tags
        </div>
        <div className="flex items-center gap-1" style={{ fontSize: 9, color: aiSettings.internetAccess ? '#565' : '#444' }}>
          <Globe size={8} /> {aiSettings.internetAccess ? 'Web on' : 'Web off'}
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div style={{ padding: 12, borderBottom: '1px solid #1a1a1a', background: '#060606', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 8, padding: '4px 8px', background: '#0a0a0a', borderRadius: 4, border: '1px solid #1a1a1a' }}>
            {isOllamaMode
              ? `Agent + Ollama (${aiSettings.model}) — full AI`
              : isAgentMode
              ? `Agent running — no Ollama. Install: ollama pull llama3.2`
              : `Agent not running. Run: python3 ~/.flint/agent/agent.py`}
          </div>
          <ConfigField label="Ollama URL">
            <input type="text" value={aiSettings.ollamaUrl}
              onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { ollamaUrl: e.target.value } })}
              style={{ ...inputStyle, fontSize: 11 }} />
          </ConfigField>
          <ConfigField label="Model">
            {models.length > 0 ? (
              <select value={aiSettings.model}
                onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { model: e.target.value } })}
                style={{ ...inputStyle, fontSize: 11 }}>
                {!aiSettings.model && <option value="">Select model...</option>}
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input type="text" value={aiSettings.model}
                onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { model: e.target.value } })}
                placeholder="e.g. llama3.2, mistral, codellama"
                style={{ ...inputStyle, fontSize: 11 }} />
            )}
          </ConfigField>
          <ConfigField label="Context">
            <input type="range" min={2} max={20} value={aiSettings.maxContextNotes}
              onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { maxContextNotes: parseInt(e.target.value) } })}
              style={{ flex: 1, accentColor: '#666' }} />
            <span style={{ fontSize: 10, color: '#555', width: 20, textAlign: 'right' }}>{aiSettings.maxContextNotes}</span>
          </ConfigField>
          <ConfigField label="Temperature">
            <input type="range" min={0} max={200} value={Math.round(aiSettings.temperature * 100)}
              onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { temperature: parseInt(e.target.value) / 100 } })}
              style={{ flex: 1, accentColor: '#666' }} />
            <span style={{ fontSize: 10, color: '#555', width: 30, textAlign: 'right' }}>{aiSettings.temperature.toFixed(2)}</span>
          </ConfigField>
          <ConfigField label="Internet">
            <div onClick={() => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { internetAccess: !aiSettings.internetAccess } })}
              style={{
                width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                background: aiSettings.internetAccess ? '#3a5a3a' : '#1a1a1a', position: 'relative',
                transition: 'background 0.2s', border: `1px solid ${aiSettings.internetAccess ? '#4a6a4a' : '#222'}`,
              }}>
              <div style={{
                width: 14, height: 14, borderRadius: 7, background: aiSettings.internetAccess ? '#8c8' : '#444',
                position: 'absolute', top: 2, left: aiSettings.internetAccess ? 18 : 2,
                transition: 'all 0.2s',
              }} />
            </div>
            <span style={{ fontSize: 10, color: aiSettings.internetAccess ? '#6a6' : '#555' }}>
              {aiSettings.internetAccess ? 'Enabled' : 'Disabled'}
            </span>
          </ConfigField>
        </div>
      )}

      {/* Context preview */}
      {contextPreview && (
        <div style={{ padding: 10, borderBottom: '1px solid #1a1a1a', background: '#030303', maxHeight: 200, overflowY: 'auto', flexShrink: 0 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#666' }}>
              <Brain size={10} style={{ display: 'inline', marginRight: 4 }} />
              AI Memory ({contextPreview.length.toLocaleString()} chars)
            </span>
            <button onClick={() => setContextPreview(null)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}>
              <X size={10} />
            </button>
          </div>
          <pre style={{ fontSize: 9, color: '#444', whiteSpace: 'pre-wrap', lineHeight: 1.4, fontFamily: 'monospace' }}>
            {contextPreview}
          </pre>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }} className="flint-scrollbar">
        {aiMessages.length === 0 && !isStreaming && (
          <div style={{ textAlign: 'center', padding: '24px 10px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: '#0f0f0f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', border: '1px solid #222',
            }}>
              <FlintLogo size={24} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#777', marginBottom: 6 }}>Flint AI</div>
            <div style={{ fontSize: 11, color: '#444', lineHeight: 1.6, maxWidth: 260, margin: '0 auto 4px' }}>
              {isOllamaMode
                ? `Powered by ${aiSettings.model} with memory of your ${notes.length} notes.`
                : isAgentMode
                ? 'Agent running. Install an Ollama model for full AI.'
                : 'I search your notes to answer. Start the Python agent for full AI + Ollama.'}
            </div>
            <div className="flex items-center justify-center gap-3" style={{ fontSize: 9, color: '#333', marginBottom: 16 }}>
              <span>{memoryStats.notes} notes</span>
              <span>🔗 {memoryStats.connections} links</span>
              {aiSettings.internetAccess && <span>Web</span>}
            </div>
            {activeNote && (
              <div style={{
                fontSize: 10, color: '#444', padding: '6px 10px',
                background: '#0a0a0a', borderRadius: 6,
                border: '1px solid #1a1a1a', marginBottom: 12,
              }}>
                Active: {activeNote.title}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                'List all my notes',
                'What connections exist in my vault?',
                'What are the main topics I write about?',
                'Summarize my notes',
                'Help',
              ].map(q => (
                <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  style={{
                    padding: '8px 12px', background: '#0a0a0a', border: '1px solid #1a1a1a',
                    borderRadius: 6, color: '#555', cursor: 'pointer', fontSize: 11, textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.color = '#888'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.color = '#555'; }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {aiMessages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: 14 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              {msg.role === 'user' ? (
                <div style={{ width: 18, height: 18, borderRadius: 4, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={10} style={{ color: '#555' }} />
                </div>
              ) : (
                <div style={{ width: 18, height: 18, borderRadius: 4, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FlintLogo size={10} />
                </div>
              )}
              <span style={{ fontSize: 10, color: '#444', fontWeight: 500 }}>
                {msg.role === 'user' ? 'You' : 'Flint AI'}
              </span>
              <span style={{ fontSize: 9, color: '#222' }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {msg.webResults && (
                <span className="flex items-center gap-1" style={{ fontSize: 9, color: '#465' }}>
                  <Globe size={8} /> web
                </span>
              )}
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.7,
              background: msg.role === 'user' ? '#0c0c0c' : '#0a0a0a',
              border: `1px solid ${msg.role === 'user' ? '#181818' : '#141414'}`,
              color: msg.role === 'user' ? '#aaa' : '#999',
            }}>
              <MessageContent text={msg.content} />
            </div>
          </div>
        ))}

        {isStreaming && streamContent && (
          <div style={{ marginBottom: 14 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FlintLogo size={10} />
              </div>
              <span style={{ fontSize: 10, color: '#444', fontWeight: 500 }}>Flint AI</span>
              <Loader2 size={9} className="animate-spin" style={{ color: '#444' }} />
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.7,
              background: '#0a0a0a', border: '1px solid #141414', color: '#999',
            }}>
              <MessageContent text={streamContent} />
              <span style={{ display: 'inline-block', width: 6, height: 14, background: '#555', marginLeft: 2, animation: 'blink 1s infinite', verticalAlign: 'text-bottom' }} />
            </div>
          </div>
        )}

        {isStreaming && !streamContent && (
          <div style={{ marginBottom: 14 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FlintLogo size={10} />
              </div>
              <span style={{ fontSize: 10, color: '#444', fontWeight: 500 }}>Flint AI</span>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#0a0a0a', border: '1px solid #141414' }}>
              <div className="flex items-center gap-3">
                <Loader2 size={12} className="animate-spin" style={{ color: '#444' }} />
                <span style={{ fontSize: 11, color: '#444' }}>
                  <Zap size={9} style={{ display: 'inline', marginRight: 4 }} />
                  {isOllamaMode
                    ? `Thinking with ${aiSettings.model}...`
                    : isAgentMode
                    ? 'Processing via agent...'
                    : `Searching ${memoryStats.notes} notes...`}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Active note indicator */}
      <div style={{ padding: '5px 14px', borderTop: '1px solid #1a1a1a', flexShrink: 0, background: '#050505' }}>
        <div style={{ fontSize: 9, color: '#333', display: 'flex', alignItems: 'center', gap: 6 }}>
          {activeNote && (
            <span className="flex items-center gap-1">
              <BookOpen size={8} /> {activeNote.title}
            </span>
          )}
          {aiSettings.internetAccess && (
            <span className="flex items-center gap-1" style={{ color: '#345' }}>
              <Globe size={8} /> Internet on
            </span>
          )}
        </div>
      </div>

      {/* Input area — ALWAYS enabled */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #1a1a1a', flexShrink: 0, background: '#060606' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isOllamaMode
                ? 'Ask anything (AI + notes + web)...'
                : isAgentMode
                ? 'Ask about your notes...'
                : 'Ask (browser search)...'
            }
            rows={2}
            style={{
              flex: 1, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 6,
              padding: '8px 10px', color: '#aaa', fontSize: 12, resize: 'none',
              outline: 'none', fontFamily: 'inherit', lineHeight: 1.4,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {isStreaming ? (
              <button onClick={stopGeneration} title="Stop"
                style={{ ...sendBtnStyle, background: '#1a0808', color: '#844' }}>
                <Loader2 size={14} />
              </button>
            ) : (
              <button onClick={sendMessage} title="Send (Enter)"
                disabled={!input.trim()}
                style={{
                  ...sendBtnStyle,
                  opacity: !input.trim() ? 0.3 : 1,
                }}>
                <Send size={14} />
              </button>
            )}
            <button onClick={() => dispatch({ type: 'CLEAR_AI_MESSAGES' })} title="Clear chat"
              style={{ ...sendBtnStyle, color: '#444' }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageContent({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <div key={i} style={{ fontSize: 12, fontWeight: 700, color: '#bbb', marginTop: 6 }}>{line.slice(4)}</div>;
        if (line.startsWith('## ')) return <div key={i} style={{ fontSize: 13, fontWeight: 700, color: '#ccc', marginTop: 8 }}>{line.slice(3)}</div>;
        if (line.startsWith('# ')) return <div key={i} style={{ fontSize: 14, fontWeight: 700, color: '#ddd', marginTop: 8 }}>{line.slice(2)}</div>;
        if (line.startsWith('```')) return <div key={i} style={{ height: 4 }} />;
        const boldParsed = line.replace(/\*\*(.+?)\*\*/g, '<<BOLD>>$1<</BOLD>>');
        const codeParsed = boldParsed.replace(/`(.+?)`/g, '<<CODE>>$1<</CODE>>');
        const linkParsed = codeParsed.replace(/\[\[(.+?)\]\]/g, '<<LINK>>$1<</LINK>>');
        if (linkParsed.startsWith('- ') || linkParsed.startsWith('* ')) {
          return <div key={i} style={{ paddingLeft: 8 }}><RichText text={linkParsed.slice(2)} /></div>;
        }
        const numMatch = linkParsed.match(/^(\d+)\.\s/);
        if (numMatch) {
          return <div key={i} style={{ paddingLeft: 8 }}><RichText text={linkParsed} /></div>;
        }
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        return <div key={i}><RichText text={linkParsed} /></div>;
      })}
    </>
  );
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(<<BOLD>>.*?<<\/BOLD>>|<<CODE>>.*?<<\/CODE>>|<<LINK>>.*?<<\/LINK>>)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('<<BOLD>>')) {
          return <strong key={i} style={{ color: '#ccc' }}>{part.replace(/<<BOLD>>|<\/BOLD>>/g, '')}</strong>;
        }
        if (part.startsWith('<<CODE>>')) {
          return <code key={i} style={{ background: '#181818', padding: '1px 4px', borderRadius: 3, fontSize: 11, color: '#888' }}>{part.replace(/<<CODE>>|<\/CODE>>/g, '')}</code>;
        }
        if (part.startsWith('<<LINK>>')) {
          return <span key={i} style={{ color: '#888', textDecoration: 'underline' }}>{part.replace(/<<LINK>>|<\/LINK>>/g, '')}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 10, color: '#555', width: 70, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0a0a0a', border: '1px solid #1a1a1a',
  borderRadius: 4, padding: '5px 8px', color: '#aaa', outline: 'none',
  fontFamily: 'inherit',
};

const sendBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 6, background: '#111',
  border: '1px solid #1a1a1a', color: '#666', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s', flexShrink: 0,
};
