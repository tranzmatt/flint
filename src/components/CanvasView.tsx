import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { FlintLogo } from './FlintLogo';
import { Grip, RotateCcw, Search, X } from 'lucide-react';

type CardPos = Record<string, { x: number; y: number; w: number; h: number }>;

function getStorageKey(vaultId: string | null) {
  return `flint-canvas-${vaultId || 'default'}`;
}

function loadPositions(vaultId: string | null): CardPos {
  try {
    const raw = localStorage.getItem(getStorageKey(vaultId));
    return raw ? JSON.parse(raw) as CardPos : {};
  } catch {
    return {};
  }
}

function savePositions(vaultId: string | null, positions: CardPos) {
  try {
    localStorage.setItem(getStorageKey(vaultId), JSON.stringify(positions));
  } catch {
    // ignore
  }
}

export function CanvasView() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [positions, setPositions] = useState<CardPos>({});
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    setPositions(loadPositions(state.activeVaultId));
  }, [state.activeVaultId]);

  useEffect(() => {
    savePositions(state.activeVaultId, positions);
  }, [positions, state.activeVaultId]);

  const nodes = useMemo(() => {
    const filtered = query.trim()
      ? state.notes.filter(note => (`${note.title}\n${note.content}`).toLowerCase().includes(query.toLowerCase()))
      : state.notes;

    return filtered.map((note, index) => {
      const saved = positions[note.id];
      const col = index % 4;
      const row = Math.floor(index / 4);
      return {
        note,
        x: saved?.x ?? 80 + col * 320,
        y: saved?.y ?? 100 + row * 220,
        w: saved?.w ?? 260,
        h: saved?.h ?? 150,
      };
    });
  }, [positions, query, state.notes]);

  const edges = useMemo(() => {
    const filteredIds = new Set(nodes.map(node => node.note.id));
    const noteByTitle = new Map(state.notes.map(note => [note.title.toLowerCase(), note]));
    const pairs = new Set<string>();
    const list: Array<{ from: string; to: string }> = [];
    nodes.forEach(({ note }) => {
      const matches = note.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const match of matches) {
        const target = noteByTitle.get(match[1].toLowerCase());
        if (!target || !filteredIds.has(target.id) || target.id === note.id) continue;
        const key = [note.id, target.id].sort().join('::');
        if (pairs.has(key)) continue;
        pairs.add(key);
        list.push({ from: note.id, to: target.id });
      }
    });
    return list;
  }, [nodes, state.notes]);

  const setNodePosition = (id: string, x: number, y: number) => {
    setPositions(prev => ({
      ...prev,
      [id]: {
        x,
        y,
        w: prev[id]?.w ?? 260,
        h: prev[id]?.h ?? 150,
      },
    }));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setNodePosition(
      dragRef.current.id,
      e.clientX - dragRef.current.offsetX,
      e.clientY - dragRef.current.offsetY,
    );
  };

  const resetLayout = () => {
    setPositions({});
  };

  const findNode = (id: string) => nodes.find(node => node.note.id === id);

  return (
    <div
      className="fixed inset-0 animate-fade-in"
      style={{ zIndex: 110, background: 'var(--bg-deep)' }}
      onMouseMove={handleMouseMove}
      onMouseUp={() => { dragRef.current = null; }}
      onMouseLeave={() => { dragRef.current = null; }}
    >
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {edges.map(edge => {
          const from = findNode(edge.from);
          const to = findNode(edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x + from.w / 2}
              y1={from.y + from.h / 2}
              x2={to.x + to.w / 2}
              y2={to.y + to.h / 2}
              stroke="var(--border-light)"
              strokeWidth="1.4"
              opacity="0.65"
            />
          );
        })}
      </svg>

      <div className="flex items-center justify-between" style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 16px', background: 'color-mix(in srgb, var(--bg-base) 92%, transparent)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <FlintLogo size={14} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Canvas</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>
            {nodes.length} cards
          </span>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2" style={{ padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <Search size={12} style={{ color: 'var(--text-dim)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter canvas..."
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 12, width: 180 }}
            />
          </div>
          <button
            onClick={resetLayout}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6 }}
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button onClick={() => dispatch({ type: 'TOGGLE_CANVAS_VIEW' })} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {nodes.map(node => {
        const preview = node.note.content.split('\n').find(line => line.trim() && !line.startsWith('#')) || 'Empty note';
        const active = node.note.id === state.activeNoteId;
        return (
          <div
            key={node.note.id}
            style={{
              position: 'absolute',
              left: node.x,
              top: node.y,
              width: node.w,
              minHeight: node.h,
              background: active ? 'var(--bg-elevated)' : 'var(--bg-surface)',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 12,
              boxShadow: '0 16px 30px rgba(0,0,0,0.24)',
              overflow: 'hidden',
            }}
          >
            <div
              onMouseDown={e => {
                dragRef.current = {
                  id: node.note.id,
                  offsetX: e.clientX - node.x,
                  offsetY: e.clientY - node.y,
                };
              }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border)', cursor: 'grab', background: 'color-mix(in srgb, var(--bg-elevated) 88%, transparent)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Grip size={12} style={{ color: 'var(--text-dim)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.note.title}</span>
              </div>
              <button
                onClick={() => dispatch({ type: 'OPEN_TAB', payload: node.note.id })}
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}
              >
                Open
              </button>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{preview.slice(0, 180)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

