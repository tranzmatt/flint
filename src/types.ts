export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  filePath?: string; // for folder-based vaults
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  collapsed: boolean;
}

export interface Vault {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  lastOpened: number;
  isFolderVault?: boolean;
  folderPath?: string;
}

export type ViewMode = 'edit' | 'split' | 'preview';

export interface FlintSettings {
  fontSize: number;
  spellCheck: boolean;
  autoSave: boolean;
  showLineNumbers: boolean;
  tabSize: number;
  wordWrap: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  noteContext?: string[];
  webResults?: string;
}

export type AIProvider = 'ollama' | 'openai' | 'gemini' | 'openai-compatible';

export interface AISettings {
  provider: AIProvider;
  ollamaUrl: string;
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  maxContextNotes: number;
  temperature: number;
  systemPrompt: string;
  internetAccess: boolean;
}

export interface AppState {
  vaults: Vault[];
  activeVaultId: string | null;
  notes: Note[];
  folders: Folder[];
  openTabs: string[];
  activeNoteId: string | null;
  viewMode: ViewMode;
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  showGraphView: boolean;
  showSearch: boolean;
  showCommandPalette: boolean;
  settingsOpen: boolean;
  showAIChat: boolean;
  aiMessages: ChatMessage[];
  aiSettings: AISettings;
  hasFolderHandle: boolean; // whether current vault has a live folder handle
}
