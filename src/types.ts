export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
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
}

export type ViewMode = 'edit' | 'split' | 'preview';

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
}
