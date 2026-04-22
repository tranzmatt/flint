import { createContext, useContext, useReducer, useEffect, useRef, useCallback, type ReactNode } from 'react';
import type { Note, Folder, Vault, AppState } from './types';

const STORAGE_KEY = 'flint-data';

function generateId() { return Math.random().toString(36).substring(2, 11) + Date.now().toString(36); }

function saveState(state: AppState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn('Save failed:', e); }
}

function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.vaults) return parsed;
  } catch { /* ignore */ }
  return null;
}

const DEMO_NOTES: Note[] = [
  {
    id: 'n1', title: 'Welcome to Flint', folderId: null, pinned: true,
    content: `# Welcome to Flint

Flint is your **secure, local knowledge base** — all data stays on your device.

## Getting Started

- Create new notes with **Ctrl+N** or the **+** button
- Link notes with \`[[Note Name]]\` syntax
- Visualize connections in **Graph View** (Ctrl+G)
- Search all notes with **Ctrl+Shift+F**
- Command palette with **Ctrl+P**

## Key Features

- **Wiki Links**: \`[[note name]]\` connects notes
- **Graph View**: Visual knowledge network
- **Auto-Save**: Automatic & persistent
- **Tags**: Use #welcome #getting-started
- **Markdown**: Full support with live preview
- **Local Only**: 100% offline, zero cloud

## Explore

- [[Markdown Basics]] — Formatting guide
- [[Project Ideas]] — Brainstorming notes
- [[Daily Notes]] — Journal template
- [[Reading List]] — Books & articles
- [[Architecture Notes]] — Software design

> "The only way to do great work is to love what you do."`,
    createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 3600000,
  },
  {
    id: 'n2', title: 'Markdown Basics', folderId: null, pinned: false,
    content: `# Markdown Basics

A quick reference for Markdown formatting in Flint.

## Text Formatting

- **Bold** text with \`**bold**\`
- *Italic* text with \`*italic*\`
- ~~Strikethrough~~ with \`~~text~~\`
- Inline \`code\` with backticks

## Lists

1. First item
2. Second item
3. Third item

- Unordered item
- Another item
  - Nested item

## Task Lists

- [x] Learn Markdown
- [x] Install Flint
- [ ] Create a knowledge graph
- [ ] Write daily notes

## Links

Internal links: [[Welcome to Flint]]
More: [[Project Ideas]] and [[Daily Notes]]
Also: [[Reading List]] and [[Architecture Notes]]

#markdown #reference #formatting`,
    createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 7200000,
  },
  {
    id: 'n3', title: 'Project Ideas', folderId: 'f1', pinned: false,
    content: `# Project Ideas

A collection of project ideas and brainstorming notes.

## Web Development

- Personal portfolio with 3D elements
- Real-time collaboration tool
- Knowledge management system like [[Welcome to Flint]]

## Learning Goals

- [ ] Deep dive into TypeScript
- [ ] Learn WebGL / Three.js
- [ ] Master [[Markdown Basics]] for documentation

## Connections

- [[Welcome to Flint]] — The tool itself
- [[Daily Notes]] — Track progress daily
- [[Architecture Notes]] — Design patterns

## Priority Matrix

| Project | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Portfolio | High | Medium | Do first |
| Collab Tool | High | High | Plan |
| Knowledge App | Medium | Low | Quick win |

#projects #ideas #brainstorm`,
    createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 10800000,
  },
  {
    id: 'n4', title: 'Daily Notes', folderId: 'f1', pinned: false,
    content: `# Daily Notes

A journaling template for daily reflections.

## Template

### Morning
- [ ] Review goals
- [ ] Plan the day
- [ ] Read for 30 minutes

### Afternoon
- [ ] Deep work session
- [ ] Review [[Project Ideas]]
- [ ] Take notes on learnings

### Evening
- [ ] Reflect on the day
- [ ] Update task list
- [ ] Plan tomorrow

## Recent Entries

### Today
Worked on Flint — improving the graph view.
Connected notes: [[Welcome to Flint]] and [[Markdown Basics]].

### Yesterday
Researched force-directed graph layouts.
Found interesting patterns in [[Project Ideas]].

---

> "A day without learning is a day wasted."

#daily #journal #template`,
    createdAt: Date.now() - 86400000 * 2, updatedAt: Date.now() - 14400000,
  },
  {
    id: 'n5', title: 'Reading List', folderId: 'f2', pinned: false,
    content: `# Reading List

Books and articles to read.

## Currently Reading

- **"Atomic Habits"** by James Clear
  - Key takeaway: Small habits, remarkable results
  - See [[Daily Notes]] for habit tracking

## Up Next

- "Thinking, Fast and Slow" by Daniel Kahneman
- "The Pragmatic Programmer"
- "Designing Data-Intensive Applications"

## Completed

- [x] "Deep Work" by Cal Newport
- [x] "Getting Things Done" by David Allen

## Articles

- Understanding knowledge graphs
- The Zettelkasten method → relates to [[Welcome to Flint]]
- Spaced repetition systems

#reading #books #learning`,
    createdAt: Date.now() - 86400000, updatedAt: Date.now() - 18000000,
  },
  {
    id: 'n6', title: 'Architecture Notes', folderId: 'f2', pinned: false,
    content: `# Architecture Notes

Notes on software architecture and design patterns.

## Patterns

### MVC (Model-View-Controller)
- Separation of concerns
- Used in web frameworks

### Observer Pattern
- Event-driven architecture
- Pub/Sub systems

## System Design

- Microservices vs Monolith
- Database selection criteria
- Caching strategies

## Links

- [[Project Ideas]] — Implementation ideas
- [[Markdown Basics]] — Documentation format
- [[Reading List]] — Books on architecture

#architecture #design #patterns`,
    createdAt: Date.now() - 86400000 * 1.5, updatedAt: Date.now() - 20000000,
  },
];

const DEMO_FOLDERS: Folder[] = [
  { id: 'f1', name: 'Projects', parentId: null, collapsed: false },
  { id: 'f2', name: 'Resources', parentId: null, collapsed: false },
];

const DEFAULT_VAULT: Vault = {
  id: 'v1', name: 'My Vault', color: '#888', createdAt: Date.now() - 86400000 * 5, lastOpened: Date.now(),
};

function getInitialState(): AppState {
  const saved = loadState();
  if (saved && saved.vaults && saved.vaults.length > 0 && saved.activeVaultId) return saved;
  return {
    vaults: [DEFAULT_VAULT], activeVaultId: 'v1',
    notes: DEMO_NOTES, folders: DEMO_FOLDERS,
    openTabs: ['n1'], activeNoteId: 'n1',
    viewMode: 'edit', sidebarOpen: true, rightPanelOpen: false,
    showGraphView: false, showSearch: false, showCommandPalette: false,
  };
}

type Action =
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'CREATE_VAULT'; payload: { id: string; name: string; color: string } }
  | { type: 'OPEN_VAULT'; payload: string }
  | { type: 'CLOSE_VAULT' }
  | { type: 'DELETE_VAULT'; payload: string }
  | { type: 'OPEN_TAB'; payload: string }
  | { type: 'CLOSE_TAB'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'UPDATE_NOTE'; payload: { id: string; content: string } }
  | { type: 'RENAME_NOTE'; payload: { id: string; title: string } }
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'PIN_NOTE'; payload: string }
  | { type: 'ADD_FOLDER'; payload: Folder }
  | { type: 'DELETE_FOLDER'; payload: string }
  | { type: 'TOGGLE_FOLDER'; payload: string }
  | { type: 'SET_VIEW_MODE'; payload: 'edit' | 'preview' | 'split' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_RIGHT_PANEL' }
  | { type: 'TOGGLE_GRAPH_VIEW' }
  | { type: 'TOGGLE_SEARCH' }
  | { type: 'TOGGLE_COMMAND_PALETTE' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE': return action.payload;
    case 'CREATE_VAULT': {
      const vault: Vault = { id: action.payload.id, name: action.payload.name, color: action.payload.color, createdAt: Date.now(), lastOpened: Date.now() };
      return { ...state, vaults: [...state.vaults, vault] };
    }
    case 'OPEN_VAULT': {
      const vault = state.vaults.find(v => v.id === action.payload);
      if (!vault) return state;
      const updated = { ...state, activeVaultId: vault.id, showGraphView: false, showSearch: false, showCommandPalette: false };
      if (!updated.openTabs.length && updated.notes.length) {
        updated.openTabs = [updated.notes[0].id];
        updated.activeNoteId = updated.notes[0].id;
      }
      return updated;
    }
    case 'CLOSE_VAULT': return { ...state, activeVaultId: null, showGraphView: false, showSearch: false, showCommandPalette: false };
    case 'DELETE_VAULT': {
      const vaults = state.vaults.filter(v => v.id !== action.payload);
      if (vaults.length === 0) return { ...state, vaults: [], activeVaultId: null };
      return { ...state, vaults, activeVaultId: state.activeVaultId === action.payload ? vaults[0].id : state.activeVaultId };
    }
    case 'OPEN_TAB': {
      const tabs = state.openTabs.includes(action.payload) ? state.openTabs : [...state.openTabs, action.payload];
      return { ...state, openTabs: tabs, activeNoteId: action.payload, showGraphView: false };
    }
    case 'CLOSE_TAB': {
      const idx = state.openTabs.indexOf(action.payload);
      const tabs = state.openTabs.filter(t => t !== action.payload);
      let activeId = state.activeNoteId;
      if (activeId === action.payload) activeId = tabs.length > 0 ? tabs[Math.min(idx, tabs.length - 1)] : null;
      return { ...state, openTabs: tabs, activeNoteId: activeId };
    }
    case 'SET_ACTIVE_TAB': return { ...state, activeNoteId: action.payload };
    case 'UPDATE_NOTE': return { ...state, notes: state.notes.map(n => n.id === action.payload.id ? { ...n, content: action.payload.content, updatedAt: Date.now() } : n) };
    case 'RENAME_NOTE': return { ...state, notes: state.notes.map(n => n.id === action.payload.id ? { ...n, title: action.payload.title, updatedAt: Date.now() } : n) };
    case 'ADD_NOTE': return { ...state, notes: [...state.notes, action.payload], openTabs: [...state.openTabs, action.payload.id], activeNoteId: action.payload.id, showGraphView: false };
    case 'DELETE_NOTE': {
      const tabs = state.openTabs.filter(t => t !== action.payload);
      let activeId = state.activeNoteId === action.payload ? (tabs[0] || null) : state.activeNoteId;
      return { ...state, notes: state.notes.filter(n => n.id !== action.payload), openTabs: tabs, activeNoteId: activeId };
    }
    case 'PIN_NOTE': return { ...state, notes: state.notes.map(n => n.id === action.payload ? { ...n, pinned: !n.pinned } : n) };
    case 'ADD_FOLDER': return { ...state, folders: [...state.folders, action.payload] };
    case 'DELETE_FOLDER': return { ...state, folders: state.folders.filter(f => f.id !== action.payload), notes: state.notes.map(n => n.folderId === action.payload ? { ...n, folderId: null } : n) };
    case 'TOGGLE_FOLDER': return { ...state, folders: state.folders.map(f => f.id === action.payload ? { ...f, collapsed: !f.collapsed } : f) };
    case 'SET_VIEW_MODE': return { ...state, viewMode: action.payload };
    case 'TOGGLE_SIDEBAR': return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'TOGGLE_RIGHT_PANEL': return { ...state, rightPanelOpen: !state.rightPanelOpen };
    case 'TOGGLE_GRAPH_VIEW': return { ...state, showGraphView: !state.showGraphView };
    case 'TOGGLE_SEARCH': return { ...state, showSearch: !state.showSearch };
    case 'TOGGLE_COMMAND_PALETTE': return { ...state, showCommandPalette: !state.showCommandPalette };
    default: return state;
  }
}

interface StoreContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  createNote: (folderId?: string | null) => void;
  createFolder: (name: string) => void;
  getNoteByTitle: (title: string) => Note | undefined;
  getBacklinks: (noteId: string) => Note[];
  getOutgoingLinks: (noteId: string) => Note[];
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false);
  const [state, dispatch] = useReducer(reducer, null, getInitialState);

  useEffect(() => {
    if (!initialized.current) { initialized.current = true; return; }
    saveState(state);
  }, [state]);

  const createNote = useCallback((folderId?: string | null) => {
    const note: Note = { id: generateId(), title: 'Untitled', content: '# Untitled\n\n', folderId: folderId || null, pinned: false, createdAt: Date.now(), updatedAt: Date.now() };
    dispatch({ type: 'ADD_NOTE', payload: note });
  }, []);

  const createFolder = useCallback((name: string) => {
    const folder: Folder = { id: generateId(), name, parentId: null, collapsed: false };
    dispatch({ type: 'ADD_FOLDER', payload: folder });
  }, []);

  const getNoteByTitle = useCallback((title: string) => {
    return state.notes.find(n => n.title.toLowerCase() === title.toLowerCase());
  }, [state.notes]);

  const getBacklinks = useCallback((noteId: string) => {
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return [];
    const title = note.title;
    return state.notes.filter(n => {
      if (n.id === noteId) return false;
      const regex = new RegExp(`\\[\\[(${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?:\\|[^\\]]+)?\\]\\]`, 'i');
      return regex.test(n.content);
    });
  }, [state.notes]);

  const getOutgoingLinks = useCallback((noteId: string) => {
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return [];
    const matches = note.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
    const titles = new Set<string>();
    for (const m of matches) titles.add(m[1]);
    return state.notes.filter(n => titles.has(n.title));
  }, [state.notes]);

  return (
    <StoreContext.Provider value={{ state, dispatch, createNote, createFolder, getNoteByTitle, getBacklinks, getOutgoingLinks }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
