import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useStore } from '../store';
import { FlintLogo } from './FlintLogo';
import { Grip, RotateCcw, Search, X, Plus, Type, Trash2, FileText } from 'lucide-react';
import type { CanvasCard } from '../types';

// ─── Persistence ──────────────────────────────────────────────────────────────

function getCanvasKey(vaultId: string | null) {
  return `flint-canvas-state-${vaultId || 'default'}`;
}

interface CanvasConnection {
  id: string;
  fromCard: string;
  toCard: string;
  fromSide: 'top' | 'right' | 'bottom' | 'left';
  toSide: 'top' | 'right' | 'bottom' | 'left';
  color?: string;
}

interface CanvasPersistedState {
  connections: CanvasConnection[];
}

function loadCanvasState(vaultId: string | null): CanvasPersistedState {
  try {
    const raw = localStorage.getItem(getCanvasKey(vaultId));
    return raw ? JSON.parse(raw) : { connections: [] };
  } catch {
    return { connections: [] };
  }
}

function saveCanvasState(vaultId: string | null, data: CanvasPersistedState) {
  try {
    localStorage.setItem(getCanvasKey(vaultId), JSON.stringify(data));
  } catch {
    // ignore
  }
}

// ─── Card color palette (Obsidian-style) ──────────────────────────────────────

const CARD_COLORS = [
  { label: 'Default', border: '#3a3a3a', glow: '' },
  { label: 'Red',     border: '#e5555a', glow: 'rgba(229,85,90,0.15)' },
  { label: 'Orange',  border: '#e68a00', glow: 'rgba(230,138,0,0.15)' },
  { label: 'Yellow',  border: '#c9b400', glow: 'rgba(201,180,0,0.15)' },
  { label: 'Green',   border: '#43a047', glow: 'rgba(67,160,71,0.15)' },
  { label: 'Cyan',    border: '#00acc1', glow: 'rgba(0,172,193,0.15)' },
  { label: 'Purple',  border: '#7f6df2', glow: 'rgba(127,109,242,0.15)' },
  { label: 'Pink',    border: '#e040a0', glow: 'rgba(224,64,160,0.15)' },
];

// ─── Connection colors ────────────────────────────────────────────────────────

const CONN_COLORS = [
  '#555555', '#7f6df2', '#43a047', '#e5555a', '#00acc1', '#e68a00',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSidePt(card: CanvasCard, side: 'top' | 'right' | 'bottom' | 'left') {
  switch (side) {
    case 'top':    return { x: card.x + card.w / 2,  y: card.y };
    case 'bottom': return { x: card.x + card.w / 2,  y: card.y + card.h };
    case 'left':   return { x: card.x,               y: card.y + card.h / 2 };
    case 'right':  return { x: card.x + card.w,      y: card.y + card.h / 2 };
  }
}

function nearestSide(
  fromCard: CanvasCard,
  fromSide: 'top' | 'right' | 'bottom' | 'left',
  toCard: CanvasCard
): 'top' | 'right' | 'bottom' | 'left' {
  const from = getSidePt(fromCard, fromSide);
  const sides: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left'];
  let best: 'top' | 'right' | 'bottom' | 'left' = 'left';
  let bestDist = Infinity;
  for (const s of sides) {
    const pt = getSidePt(toCard, s);
    const d = Math.hypot(pt.x - from.x, pt.y - from.y);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

// Smart Bezier that exits properly based on card side (Obsidian style)
function getControlPt(pt: { x: number; y: number }, side: 'top' | 'right' | 'bottom' | 'left', offset: number) {
  switch (side) {
    case 'top': return { x: pt.x, y: pt.y - offset };
    case 'bottom': return { x: pt.x, y: pt.y + offset };
    case 'left': return { x: pt.x - offset, y: pt.y };
    case 'right': return { x: pt.x + offset, y: pt.y };
  }
}

function smartBezier(
  p1: { x: number; y: number }, s1: 'top' | 'right' | 'bottom' | 'left',
  p2: { x: number; y: number }, s2: 'top' | 'right' | 'bottom' | 'left'
) {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const offset = Math.min(dist * 0.5, 80); // Dynamic offset for smooth curves
  const c1 = getControlPt(p1, s1, offset);
  const c2 = getControlPt(p2, s2, offset);
  return `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
}

function getBestSides(from: CanvasCard, to: CanvasCard) {
  const sides: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left'];
  let bestDist = Infinity;
  let bestFrom: 'top' | 'right' | 'bottom' | 'left' = 'right';
  let bestTo: 'top' | 'right' | 'bottom' | 'left' = 'left';
  for (const sf of sides) {
    const pf = getSidePt(from, sf);
    for (const st of sides) {
      const pt = getSidePt(to, st);
      const d = Math.hypot(pf.x - pt.x, pf.y - pt.y);
      if (d < bestDist) {
        bestDist = d;
        bestFrom = sf;
        bestTo = st;
      }
    }
  }
  return { fromSide: bestFrom, toSide: bestTo };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CanvasView() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const canvasDragRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Connection dragging state
  const connDragRef = useRef<{
    fromCard: string;
    fromSide: 'top' | 'right' | 'bottom' | 'left';
    mx: number;
    my: number;
  } | null>(null);
  const [connDrag, setConnDrag] = useState<{
    fromCard: string;
    fromSide: 'top' | 'right' | 'bottom' | 'left';
    mx: number;
    my: number;
  } | null>(null);

  // Interaction states
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredConn, setHoveredConn] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);

  // Connections stored in localStorage
  const activeVaultId = state.activeVaultId;
  const [connections, setConnections] = useState<CanvasConnection[]>(
    () => loadCanvasState(activeVaultId).connections
  );

  useEffect(() => {
    saveCanvasState(activeVaultId, { connections });
  }, [connections, activeVaultId]);

  const workspace = activeVaultId ? state.vaultData[activeVaultId] : null;
  const cards = workspace?.canvasCards || [];

  // Card color map stored in localStorage
  const [cardColors, setCardColors] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(`flint-canvas-colors-${activeVaultId || 'default'}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        `flint-canvas-colors-${activeVaultId || 'default'}`,
        JSON.stringify(cardColors)
      );
    } catch {}
  }, [cardColors, activeVaultId]);

  const updateCards = useCallback((newCards: CanvasCard[]) => {
    dispatch({ type: 'UPDATE_CANVAS_CARDS', payload: newCards });
  }, [dispatch]);

  const filteredCards = useMemo(() => {
    if (!query.trim()) return cards;
    const q = query.toLowerCase();
    return cards.filter(card => {
      if (card.type === 'note' && card.noteId) {
        const note = state.notes.find(n => n.id === card.noteId);
        return note && (
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q)
        );
      }
      return card.content?.toLowerCase().includes(q);
    });
  }, [cards, query, state.notes]);

  // Wikilink edges (auto from note content)
  const wikilinkEdges = useMemo(() => {
    const filteredIds = new Set(filteredCards.map(c => c.id));
    const noteTitleIdMap = new Map(state.notes.map(note => [note.title.toLowerCase(), note.id]));
    const pairs = new Set<string>();
    const list: Array<{ from: string; to: string }> = [];
    filteredCards.forEach(card => {
      if (card.type !== 'note' || !card.noteId) return;
      const note = state.notes.find(n => n.id === card.noteId);
      if (!note) return;
      const matches = note.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const match of matches) {
        const targetId = noteTitleIdMap.get(match[1].toLowerCase());
        if (!targetId || !filteredIds.has(targetId) || targetId === note.id) continue;
        const key = [note.id, targetId].sort().join('::');
        if (pairs.has(key)) continue;
        pairs.add(key);
        list.push({ from: note.id, to: targetId });
      }
    });
    return list;
  }, [filteredCards, state.notes]);

  const updateCard = (id: string, updates: Partial<CanvasCard>) => {
    updateCards(cards.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addTextCard = () => {
    const newCard: CanvasCard = {
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'text',
      content: '',
      x: Math.round(((window.innerWidth / 2 - pan.x) / zoom) / 20) * 20,
      y: Math.round(((window.innerHeight / 2 - pan.y) / zoom) / 20) * 20,
      w: 240,
      h: 160,
    };
    updateCards([...cards, newCard]);
    setSelectedCard(newCard.id);
  };

  const deleteCard = (id: string) => {
    updateCards(cards.filter(c => c.id !== id));
    setConnections(prev => prev.filter(c => c.fromCard !== id && c.toCard !== id));
    setCardColors(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (colorPickerOpen === id) setColorPickerOpen(null);
    if (selectedCard === id) setSelectedCard(null);
  };

  const deleteConnection = (id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
    if (hoveredConn === id) setHoveredConn(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (connDragRef.current) {
          connDragRef.current = null;
          setConnDrag(null);
        }
        setSelectedCard(null);
        setColorPickerOpen(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCard) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        deleteCard(selectedCard);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCard]);

  // ── Mouse handlers ────────────────────────────────────────────────────────

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      const rawX = (e.clientX - pan.x - dragRef.current.offsetX) / zoom;
      const rawY = (e.clientY - pan.y - dragRef.current.offsetY) / zoom;
      // Snap to 20px grid
      updateCard(dragRef.current.id, {
        x: Math.round(rawX / 20) * 20,
        y: Math.round(rawY / 20) * 20,
      });
    } else if (resizeRef.current) {
      const dx = (e.clientX - resizeRef.current.startX) / zoom;
      const dy = (e.clientY - resizeRef.current.startY) / zoom;
      const newW = Math.round((resizeRef.current.startW + dx) / 20) * 20;
      const newH = Math.round((resizeRef.current.startH + dy) / 20) * 20;
      updateCard(resizeRef.current.id, {
        w: Math.max(160, newW),
        h: Math.max(80, newH)
      });
    } else if (canvasDragRef.current) {
      setPan({
        x: e.clientX - canvasDragRef.current.x,
        y: e.clientY - canvasDragRef.current.y,
      });
    } else if (connDragRef.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = (e.clientX - rect.left - pan.x) / zoom;
      const my = (e.clientY - rect.top - pan.y) / zoom;
      connDragRef.current.mx = mx;
      connDragRef.current.my = my;
      setConnDrag({ ...connDragRef.current });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (connDragRef.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = (e.clientX - rect.left - pan.x) / zoom;
      const my = (e.clientY - rect.top - pan.y) / zoom;

      const target = filteredCards.find(c =>
        c.id !== connDragRef.current!.fromCard &&
        mx >= c.x && mx <= c.x + c.w &&
        my >= c.y && my <= c.y + c.h
      );

      if (target) {
        const fromCard = filteredCards.find(c => c.id === connDragRef.current!.fromCard);
        if (fromCard) {
          const toSide = nearestSide(fromCard, connDragRef.current!.fromSide, target);
          const newConn: CanvasConnection = {
            id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            fromCard: connDragRef.current!.fromCard,
            toCard: target.id,
            fromSide: connDragRef.current!.fromSide,
            toSide,
            color: CONN_COLORS[connections.length % CONN_COLORS.length],
          };
          setConnections(prev => [...prev, newConn]);
        }
      }
    }

    dragRef.current = null;
    resizeRef.current = null;
    canvasDragRef.current = null;
    connDragRef.current = null;
    setConnDrag(null);
    if (containerRef.current) containerRef.current.style.cursor = 'default';
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    setColorPickerOpen(null);
    setSelectedCard(null);
    canvasDragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      const newZoom = Math.max(0.15, Math.min(4, zoom * delta));
      setPan(p => ({
        x: mx - (mx - p.x) * (newZoom / zoom),
        y: my - (my - p.y) * (newZoom / zoom),
      }));
      setZoom(newZoom);
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const resetLayout = () => {
    if (confirm('Reset canvas layout? All card positions, connections, and text cards will be cleared.')) {
      updateCards([]);
      setConnections([]);
      setCardColors({});
      setPan({ x: 0, y: 0 });
      setZoom(1);
    }
  };

  const findCard = (id: string) => filteredCards.find(c => c.id === id);

  // ── Obsidian aesthetic constants ─────────────────────────────────────────
  const accentColor = '#7f6df2';
  const canvasBg = '#1c1c1c';
  const cardBg = '#2b2b2b';
  const cardBgActive = '#303030';
  const cardBorderDefault = '#3a3a3a';
  const textPrimary = '#dcddde';
  const textSecondary = '#999999';
  const textMuted = '#666666';

  // ─── Render connection SVG path ───────────────────────────────────────────
  const renderConnections = () => {
    const allEdges: JSX.Element[] = [];

    wikilinkEdges.forEach(edge => {
      const from = findCard(edge.from);
      const to = findCard(edge.to);
      if (!from || !to) return;
      const { fromSide, toSide } = getBestSides(from, to);
      const p1 = getSidePt(from, fromSide);
      const p2 = getSidePt(to, toSide);
      allEdges.push(
        <g key={`wiki-${edge.from}-${edge.to}`}>
          <path
            d={smartBezier(p1, fromSide, p2, toSide)}
            stroke="#4a4a4a"
            strokeWidth={1.2 / zoom}
            strokeDasharray={`${4 / zoom} ${4 / zoom}`}
            fill="none"
            style={{ pointerEvents: 'none' }}
          />
        </g>
      );
    });

    connections.forEach(conn => {
      const from = findCard(conn.fromCard);
      const to = findCard(conn.toCard);
      if (!from || !to) return;
      const p1 = getSidePt(from, conn.fromSide);
      const p2 = getSidePt(to, conn.toSide);
      const color = conn.color || accentColor;
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      allEdges.push(
        <g key={conn.id}>
          <path
            d={smartBezier(p1, conn.fromSide, p2, conn.toSide)}
            stroke="transparent"
            strokeWidth={14 / zoom}
            fill="none"
            style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
            onClick={() => deleteConnection(conn.id)}
            onMouseEnter={() => setHoveredConn(conn.id)}
            onMouseLeave={() => setHoveredConn(null)}
          />
          <path
            d={smartBezier(p1, conn.fromSide, p2, conn.toSide)}
            stroke={color}
            strokeWidth={hoveredConn === conn.id ? 2.5 / zoom : 1.8 / zoom}
            fill="none"
            strokeOpacity={0.8}
            markerEnd={`url(#arrow-colored-${conn.id})`}
            style={{ pointerEvents: 'none' }}
          />
          {hoveredConn === conn.id && (
            <g
              transform={`translate(${midX}, ${midY})`}
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              onClick={() => deleteConnection(conn.id)}
            >
              <circle r={8 / zoom} fill="#1c1c1c" stroke={color} strokeWidth={1.2 / zoom} />
              <text
                x={0} y={1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9 / zoom}
                fill={color}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                ×
              </text>
            </g>
          )}
        </g>
      );
    });

    return allEdges;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 animate-fade-in overflow-hidden select-none"
      style={{ zIndex: 110, background: canvasBg }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Obsidian-style fine dot grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)`,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x % (20 * zoom)}px ${pan.y % (20 * zoom)}px`,
          pointerEvents: 'none',
        }}
      />

      {/* Canvas cards */}
      <div
        style={{
          position: 'absolute', inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          zIndex: 1,
        }}
        onMouseDown={handleCanvasMouseDown}
      >
        {filteredCards.map(card => {
          const isNote = card.type === 'note';
          const note = isNote ? state.notes.find(n => n.id === card.noteId) : null;
          const isActive = isNote && note?.id === state.activeNoteId;

          const previewLines = isNote && note
            ? note.content
                .split('\n')
                .filter(line => line.trim() && !line.startsWith('#'))
                .slice(0, 6)
                .join('\n')
            : '';

          const titleLine = isNote && note
            ? note.content.split('\n').find(l => l.startsWith('# '))?.replace(/^# /, '') || note.title
            : 'Text Note';

          const colorIdx = cardColors[card.id] ?? 0;
          const cardColor = CARD_COLORS[colorIdx];
          const isColorPickerOpen = colorPickerOpen === card.id;

          const cardBorder = selectedCard === card.id 
            ? accentColor 
            : isActive 
            ? accentColor 
            : colorIdx > 0 
            ? cardColor.border 
            : cardBorderDefault;

          const SIDES: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left'];
          const sideStyle = (side: 'top' | 'right' | 'bottom' | 'left'): React.CSSProperties => {
            const base: React.CSSProperties = {
              position: 'absolute',
              background: accentColor,
              borderRadius: '50%',
              width: 8 / zoom,
              height: 8 / zoom,
              zIndex: 5,
              cursor: 'crosshair',
              opacity: hoveredCard === card.id ? 0.85 : 0,
              transition: 'opacity 0.15s ease, transform 0.15s ease',
              boxShadow: `0 0 4px rgba(127, 109, 242, 0.4)`,
            };
            if (side === 'top')    return { ...base, top: 0, left: '50%', transform: 'translate(-50%, -50%)' };
            if (side === 'bottom') return { ...base, bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' };
            if (side === 'left')   return { ...base, top: '50%', left: 0, transform: 'translate(-50%, -50%)' };
            return { ...base, top: '50%', right: 0, transform: 'translate(50%, -50%)' };
          };

          return (
            <div
              key={card.id}
              style={{
                position: 'absolute',
                left: card.x,
                top: card.y,
                width: card.w,
                minHeight: card.h,
                background: isActive ? cardBgActive : cardBg,
                border: `${selectedCard === card.id ? 2 : 1}px solid ${cardBorder}`,
                borderRadius: 8 / zoom,
                boxShadow: selectedCard === card.id
                  ? `0 0 0 1px ${accentColor}40, 0 0 20px ${accentColor}20`
                  : cardColor.glow
                  ? `0 0 0 1px ${cardColor.glow}, 0 6px 20px rgba(0,0,0,0.4)`
                  : '0 6px 20px rgba(0,0,0,0.4)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                transition: 'box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease',
              }}
              onClick={e => {
                e.stopPropagation();
                setSelectedCard(card.id);
                setColorPickerOpen(null);
              }}
              onDoubleClick={() => {
                if (isNote && card.noteId) dispatch({ type: 'OPEN_TAB', payload: card.noteId });
              }}
              onMouseEnter={() => setHoveredCard(card.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {SIDES.map(side => (
                <div
                  key={side}
                  style={sideStyle(side)}
                  title={`Connect from ${side}`}
                  onMouseDown={e => {
                    e.stopPropagation();
                    e.preventDefault();
                    const fromCard = filteredCards.find(c => c.id === card.id)!;
                    const pt = getSidePt(fromCard, side);
                    connDragRef.current = { fromCard: card.id, fromSide: side, mx: pt.x, my: pt.y };
                    setConnDrag({ fromCard: card.id, fromSide: side, mx: pt.x, my: pt.y });
                  }}
                />
              ))}

              {/* Card header */}
              <div
                onMouseDown={e => {
                  e.stopPropagation();
                  setSelectedCard(card.id);
                  dragRef.current = {
                    id: card.id,
                    offsetX: e.clientX - pan.x - card.x * zoom,
                    offsetY: e.clientY - pan.y - card.y * zoom,
                  };
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `${6 / zoom}px ${8 / zoom}px`,
                  borderBottom: `${1 / zoom}px solid rgba(255,255,255,0.05)`,
                  cursor: 'grab',
                  background: 'rgba(0,0,0,0.15)',
                  flexShrink: 0,
                  borderRadius: `${8 / zoom}px ${8 / zoom}px 0 0`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 / zoom, minWidth: 0, flex: 1 }}>
                  <Grip size={9 / zoom} style={{ color: textMuted, flexShrink: 0 }} />
                  {isNote && <FileText size={9 / zoom} style={{ color: textMuted, flexShrink: 0 }} />}
                  <span style={{
                    fontSize: 11 / zoom,
                    fontWeight: 500,
                    color: isActive ? textPrimary : textSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {titleLine}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 2 / zoom, flexShrink: 0 }}>
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation();
                      setColorPickerOpen(prev => prev === card.id ? null : card.id);
                    }}
                    title="Card color"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: `${2 / zoom}px`, display: 'flex', borderRadius: 3 / zoom,
                    }}
                  >
                    <div style={{
                      width: 9 / zoom, height: 9 / zoom, borderRadius: '50%',
                      background: colorIdx > 0 ? cardColor.border : 'rgba(255,255,255,0.25)',
                      border: `${1 / zoom}px solid rgba(255,255,255,0.15)`,
                    }} />
                  </button>

                  {isNote && (
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        dispatch({ type: 'OPEN_TAB', payload: card.noteId! });
                      }}
                      title="Open note"
                      style={{
                        background: 'none', border: 'none',
                        color: textMuted, cursor: 'pointer',
                        padding: `${2 / zoom}px`, display: 'flex', borderRadius: 3 / zoom,
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = textPrimary}
                      onMouseLeave={e => e.currentTarget.style.color = textMuted}
                    >
                      <Plus size={10 / zoom} />
                    </button>
                  )}
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); deleteCard(card.id); }}
                    title="Remove from canvas"
                    style={{
                      background: 'none', border: 'none',
                      color: textMuted, cursor: 'pointer',
                      padding: `${2 / zoom}px`, display: 'flex', borderRadius: 3 / zoom,
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#e5555a'}
                    onMouseLeave={e => e.currentTarget.style.color = textMuted}
                  >
                    <Trash2 size={10 / zoom} />
                  </button>
                </div>
              </div>

              {/* Color picker dropdown */}
              {isColorPickerOpen && (
                <div
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: (36 / zoom),
                    right: 0,
                    background: '#242424',
                    border: `${1 / zoom}px solid #3a3a3a`,
                    borderRadius: 8 / zoom,
                    padding: 8 / zoom,
                    display: 'flex',
                    gap: 6 / zoom,
                    zIndex: 20,
                    boxShadow: `0 8px 30px rgba(0,0,0,0.6)`,
                  }}
                >
                  {CARD_COLORS.map((col, idx) => (
                    <div
                      key={col.label}
                      title={col.label}
                      onClick={() => {
                        setCardColors(prev => ({ ...prev, [card.id]: idx }));
                        setColorPickerOpen(null);
                      }}
                      style={{
                        width: 16 / zoom, height: 16 / zoom,
                        borderRadius: '50%',
                        background: idx === 0 ? 'rgba(255,255,255,0.2)' : col.border,
                        cursor: 'pointer',
                        border: colorIdx === idx
                          ? `${2 / zoom}px solid ${textPrimary}`
                          : `${1 / zoom}px solid rgba(255,255,255,0.1)`,
                        boxShadow: colorIdx === idx ? `0 0 8px ${col.border}` : 'none',
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Card body */}
              <div style={{
                padding: `${8 / zoom}px ${10 / zoom}px`,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
              }}>
                {isNote ? (
                  <div style={{
                    fontSize: 11 / zoom,
                    color: textSecondary,
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflow: 'hidden',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}>
                    {previewLines.slice(0, 220) || (
                      <span style={{ color: textMuted, fontStyle: 'italic' }}>
                        Empty note
                      </span>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={card.content || ''}
                    onChange={e => updateCard(card.id, { content: e.target.value })}
                    onMouseDown={e => e.stopPropagation()}
                    placeholder="Write something..."
                    style={{
                      flex: 1,
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      color: textPrimary,
                      fontSize: 11 / zoom,
                      resize: 'none',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      lineHeight: 1.65,
                      minHeight: 90 / zoom,
                    }}
                  />
                )}
              </div>

              {/* Resize handle */}
              <div
                onMouseDown={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  resizeRef.current = {
                    id: card.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    startW: card.w,
                    startH: card.h
                  };
                }}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 16 / zoom,
                  height: 16 / zoom,
                  cursor: 'nwse-resize',
                  zIndex: 10,
                  opacity: hoveredCard === card.id ? 0.6 : 0,
                  transition: 'opacity 0.15s ease',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-end',
                  padding: 2 / zoom,
                }}
              >
                <svg width={8 / zoom} height={8 / zoom} viewBox="0 0 10 10">
                  <path d="M9 1L1 9M9 5L5 9" stroke={textMuted} strokeWidth="1.5" fill="none" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* SVG layer: connections + live drag line */}
      <svg
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
          zIndex: 2, // Above cards to allow clickable connection hitboxes
        }}
      >
        <defs>
          <marker id="arrow-dim" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L7,3.5 z" fill="#4a4a4a" />
          </marker>
          {connections.map(conn => (
            <marker
              key={conn.id}
              id={`arrow-colored-${conn.id}`}
              markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"
            >
              <path d="M0,0 L0,7 L7,3.5 z" fill={conn.color || accentColor} fillOpacity={0.8} />
            </marker>
          ))}
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {renderConnections()}

          {connDrag && (() => {
            const fromCard = findCard(connDrag.fromCard);
            if (!fromCard) return null;
            const p1 = getSidePt(fromCard, connDrag.fromSide);
            const c1 = getControlPt(p1, connDrag.fromSide, 50);
            const p2 = { x: connDrag.mx, y: connDrag.my };
            return (
              <path
                d={`M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${p2.x} ${p2.y}, ${p2.x} ${p2.y}`}
                stroke={accentColor}
                strokeWidth={1.8 / zoom}
                strokeDasharray={`${5 / zoom} ${3 / zoom}`}
                fill="none"
                strokeOpacity={0.7}
                style={{ pointerEvents: 'none' }}
              />
            );
          })()}
        </g>
      </svg>

      {/* Header toolbar */}
      <div
        className="flex items-center justify-between"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '9px 14px',
          background: 'rgba(28,28,28,0.85)',
          borderBottom: `1px solid #2b2b2b`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-3">
          <FlintLogo size={14} />
          <span style={{ fontSize: 12, fontWeight: 600, color: textSecondary, letterSpacing: 0.2 }}>
            Canvas
          </span>
          <span style={{
            fontSize: 10, color: textMuted,
            background: 'rgba(255,255,255,0.03)',
            padding: '2px 8px', borderRadius: 4,
            border: `1px solid #2b2b2b`,
          }}>
            {filteredCards.length} cards · {wikilinkEdges.length + connections.length} links
          </span>

          {/* Add text card */}
          <button
            onClick={addTextCard}
            title="Add text card"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid #3a3a3a`,
              color: textSecondary,
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              display: 'flex', alignItems: 'center', gap: 5,
              letterSpacing: 0.1,
              transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(127,109,242,0.12)';
              e.currentTarget.style.color = textPrimary;
              e.currentTarget.style.borderColor = 'rgba(127,109,242,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.color = textSecondary;
              e.currentTarget.style.borderColor = '#3a3a3a';
            }}
          >
            <Type size={11} />
            Add card
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2" style={{
            padding: '5px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid #2b2b2b`,
            borderRadius: 6,
          }}>
            <Search size={11} style={{ color: textMuted }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter cards..."
              style={{
                background: 'none', border: 'none', outline: 'none',
                color: textPrimary, fontSize: 12, width: 150,
                fontFamily: 'inherit',
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', color: textMuted, cursor: 'pointer', padding: 0, display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.color = textPrimary}
                onMouseLeave={e => e.currentTarget.style.color = textMuted}
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Zoom */}
          <span style={{
            fontSize: 10, color: textMuted,
            fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'center',
          }}>
            {Math.round(zoom * 100)}%
          </span>

          {/* Reset */}
          <button
            onClick={resetLayout}
            title="Reset layout"
            style={{
              background: 'none', border: 'none',
              color: textMuted, cursor: 'pointer',
              display: 'flex', alignItems: 'center', fontSize: 11, padding: '4px 6px', borderRadius: 4,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = textPrimary;
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = textMuted;
              e.currentTarget.style.background = 'none';
            }}
          >
            <RotateCcw size={13} />
          </button>

          {/* Close */}
          <button
            onClick={() => dispatch({ type: 'TOGGLE_CANVAS_VIEW' })}
            style={{
              background: 'none', border: 'none',
              color: textMuted, cursor: 'pointer',
              display: 'flex', padding: 4, borderRadius: 4,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = textPrimary;
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = textMuted;
              e.currentTarget.style.background = 'none';
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Hint bar */}
      <div style={{
        position: 'absolute', bottom: 12, left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 10, color: '#444444',
        display: 'flex', gap: 10,
        pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 5,
      }}>
        <span>Scroll to pan</span>
        <span>·</span>
        <span>Ctrl+Scroll to zoom</span>
        <span>·</span>
        <span>Drag header to move</span>
        <span>·</span>
        <span>Hover card edge to connect</span>
        <span>·</span>
        <span>Press ESC to cancel select/drag</span>
      </div>
    </div>
  );
}
