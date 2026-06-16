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
  { label: 'Default', border: '#484848', bg: '#262626', headerBg: '#1e1e1e', glow: '' },
  { label: 'Red', border: '#a63d40', bg: '#2a1f1f', headerBg: '#231a1a', glow: 'rgba(166,61,64,0.08)' },
  { label: 'Orange', border: '#b5722a', bg: '#2a2319', headerBg: '#231d15', glow: 'rgba(181,114,42,0.08)' },
  { label: 'Yellow', border: '#a89a2a', bg: '#28271a', headerBg: '#222116', glow: 'rgba(168,154,42,0.08)' },
  { label: 'Green', border: '#3b8a3e', bg: '#1c2a1d', headerBg: '#182318', glow: 'rgba(59,138,62,0.08)' },
  { label: 'Cyan', border: '#1a8a9a', bg: '#1a2729', headerBg: '#162123', glow: 'rgba(26,138,154,0.08)' },
  { label: 'Purple', border: '#7b5fc7', bg: '#231f2e', headerBg: '#1e1a28', glow: 'rgba(123,95,199,0.08)' },
  { label: 'Pink', border: '#b84a8a', bg: '#2a1d26', headerBg: '#231821', glow: 'rgba(184,74,138,0.08)' },
];

// ─── Connection colors ────────────────────────────────────────────────────────
const CONN_COLORS = [
  '#8b7ec8', '#a63d40', '#3b8a3e', '#1a8a9a', '#b5722a', '#a89a2a', '#b84a8a', '#888888', '#555555',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
type Side = 'top' | 'right' | 'bottom' | 'left';

function getSidePt(card: CanvasCard, side: Side) {
  switch (side) {
    case 'top': return { x: card.x + card.w / 2, y: card.y };
    case 'bottom': return { x: card.x + card.w / 2, y: card.y + card.h };
    case 'left': return { x: card.x, y: card.y + card.h / 2 };
    case 'right': return { x: card.x + card.w, y: card.y + card.h / 2 };
  }
}

function getBestSides(from: CanvasCard, to: CanvasCard) {
  const sides: Side[] = ['top', 'right', 'bottom', 'left'];
  let bestDist = Infinity;
  let bestFrom: Side = 'right';
  let bestTo: Side = 'left';
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

function getControlPt(pt: { x: number; y: number }, side: Side, offset: number) {
  switch (side) {
    case 'top': return { x: pt.x, y: pt.y - offset };
    case 'bottom': return { x: pt.x, y: pt.y + offset };
    case 'left': return { x: pt.x - offset, y: pt.y };
    case 'right': return { x: pt.x + offset, y: pt.y };
  }
}

function smartBezier(
  p1: { x: number; y: number }, s1: Side,
  p2: { x: number; y: number }, s2: Side | null
) {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const offset = Math.min(dist * 0.5, 80);
  const c1 = getControlPt(p1, s1, offset);

  if (!s2) {
    return `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${p2.x} ${p2.y}, ${p2.x} ${p2.y}`;
  }

  const c2 = getControlPt(p2, s2, offset);
  return `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
}

function findNearestAnchor(
  mx: number, my: number,
  cards: CanvasCard[], excludeId: string,
  snapRadius: number
): { cardId: string; side: Side; pt: { x: number; y: number } } | null {
  const sides: Side[] = ['top', 'right', 'bottom', 'left'];
  let best: { cardId: string; side: Side; pt: { x: number; y: number } } | null = null;
  let bestDist = snapRadius;
  for (const card of cards) {
    if (card.id === excludeId) continue;
    for (const side of sides) {
      const pt = getSidePt(card, side);
      const d = Math.hypot(mx - pt.x, my - pt.y);
      if (d < bestDist) {
        bestDist = d;
        best = { cardId: card.id, side, pt };
      }
    }
  }
  return best;
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
  const connDragRef = useRef<{
    fromCard: string;
    fromSide: Side;
    mx: number;
    my: number;
    toSide: Side | null;
  } | null>(null);

  const [connDrag, setConnDrag] = useState<{
    fromCard: string;
    fromSide: Side;
    mx: number;
    my: number;
    toSide: Side | null;
  } | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [snapTarget, setSnapTarget] = useState<{ cardId: string; side: Side } | null>(null);
  const [selectedConnColor, setSelectedConnColor] = useState<string>(CONN_COLORS[0]);
  const [hoveredConn, setHoveredConn] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);

  const activeVaultId = state.activeVaultId;

  const [connections, setConnections] = useState<CanvasConnection[]>(
    () => loadCanvasState(activeVaultId).connections
  );

  useEffect(() => {
    saveCanvasState(activeVaultId, { connections });
  }, [connections, activeVaultId]);

  const workspace = activeVaultId ? state.vaultData[activeVaultId] : null;
  const cards = workspace?.canvasCards || [];

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
      w: 260,
      h: 180,
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (connDragRef.current) {
          connDragRef.current = null;
          setConnDrag(null);
          setSnapTarget(null);
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

    const handleContextMenu = (e: MouseEvent) => {
      if (connDragRef.current) {
        e.preventDefault();
        connDragRef.current = null;
        setConnDrag(null);
        setSnapTarget(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [selectedCard]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      const rawX = (e.clientX - pan.x - dragRef.current.offsetX) / zoom;
      const rawY = (e.clientY - pan.y - dragRef.current.offsetY) / zoom;
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
      const anchor = findNearestAnchor(mx, my, filteredCards, connDragRef.current.fromCard, 30 / zoom);
      if (anchor) {
        connDragRef.current = { ...connDragRef.current, mx: anchor.pt.x, my: anchor.pt.y, toSide: anchor.side };
        setSnapTarget({ cardId: anchor.cardId, side: anchor.side });
      } else {
        connDragRef.current = { ...connDragRef.current, mx, my, toSide: null };
        setSnapTarget(null);
      }
      setConnDrag({ ...connDragRef.current });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (connDragRef.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = (e.clientX - rect.left - pan.x) / zoom;
      const my = (e.clientY - rect.top - pan.y) / zoom;
      const anchor = findNearestAnchor(mx, my, filteredCards, connDragRef.current.fromCard, 30 / zoom);
      if (anchor) {
        const newConn: CanvasConnection = {
          id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fromCard: connDragRef.current.fromCard,
          toCard: anchor.cardId,
          fromSide: connDragRef.current.fromSide,
          toSide: anchor.side,
          color: selectedConnColor,
        };
        setConnections(prev => [...prev, newConn]);
      }
      setSnapTarget(null);
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

  // ─── Obsidian Theme Tokens ────────────────────────────────────────────────
  const obsidian = {
    canvasBg: '#202020',
    dotColor: 'rgba(255,255,255,0.035)',
    cardBg: '#262626',
    cardBgHover: '#2c2c2c',
    cardHeaderBg: '#1e1e1e',
    cardBorder: '#383838',
    cardBorderSelected: '#7b6fc7',
    cardBorderSelectedGlow: 'rgba(123,111,199,0.25)',
    cardRadius: 6,
    textPrimary: '#dcddde',
    textSecondary: '#a7a7a7',
    textMuted: '#5c5c5c',
    textFaint: '#444',
    accentColor: '#7b6fc7',
    accentColorDim: 'rgba(123,111,199,0.5)',
    accentBg: 'rgba(123,111,199,0.08)',
    dangerColor: '#c74e4e',
    toolbarBg: '#1a1a1a',
    toolbarBorder: '#2e2e2e',
    inputBg: '#2a2a2a',
    inputBorder: '#3a3a3a',
    anchorDot: '#7b6fc7',
    anchorDotBg: 'rgba(123,111,199,0.35)',
    shadow: '0 2px 12px rgba(0,0,0,0.5)',
    shadowLg: '0 8px 32px rgba(0,0,0,0.6)',
  };

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
            stroke="#404040"
            strokeWidth={1 / zoom}
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
      const color = conn.color || obsidian.accentColor;
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const isHovered = hoveredConn === conn.id;

      allEdges.push(
        <g key={conn.id}>
          <path
            d={smartBezier(p1, conn.fromSide, p2, conn.toSide)}
            stroke="transparent"
            strokeWidth={16 / zoom}
            fill="none"
            style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
            onMouseEnter={() => setHoveredConn(conn.id)}
            onMouseLeave={() => setHoveredConn(null)}
          />
          <path
            d={smartBezier(p1, conn.fromSide, p2, conn.toSide)}
            stroke={color}
            strokeWidth={isHovered ? 2.2 / zoom : 1.5 / zoom}
            fill="none"
            strokeOpacity={isHovered ? 1 : 0.6}
            markerEnd={`url(#arrow-${color.replace('#', '')})`}
            style={{ pointerEvents: 'none', transition: 'stroke-opacity 0.15s' }}
          />
          {isHovered && (
            <g transform={`translate(${midX}, ${midY})`} style={{ pointerEvents: 'auto' }}>
              <g
                transform={`translate(${-10 / zoom}, 0)`}
                style={{ cursor: 'pointer' }}
                onClick={() => deleteConnection(conn.id)}
              >
                <circle r={7 / zoom} fill={obsidian.toolbarBg} stroke={color} strokeWidth={1 / zoom} />
                <text
                  x={0} y={0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9 / zoom}
                  fill={color}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  ×
                </text>
              </g>
              <g
                transform={`translate(${10 / zoom}, 0)`}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  const idx = CONN_COLORS.indexOf(conn.color || CONN_COLORS[0]);
                  const nextColor = CONN_COLORS[(idx + 1) % CONN_COLORS.length];
                  setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, color: nextColor } : c));
                }}
              >
                <circle r={7 / zoom} fill={obsidian.toolbarBg} stroke={color} strokeWidth={1 / zoom} />
                <circle r={3.5 / zoom} fill={color} />
              </g>
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: obsidian.canvasBg,
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* ─── Dot Grid Background ─── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle, ${obsidian.dotColor} 1px, transparent 1px)`,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x % (20 * zoom)}px ${pan.y % (20 * zoom)}px`,
          pointerEvents: 'none',
        }}
      />

      {/* ─── Canvas Transform Layer (Cards) ─── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
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
            ? note.content.split('\n').filter(line => line.trim() && !line.startsWith('#')).slice(0, 6).join('\n')
            : '';
          const titleLine = isNote && note
            ? note.content.split('\n').find(l => l.startsWith('# '))?.replace(/^# /, '') || note.title
            : '';
          const colorIdx = cardColors[card.id] ?? 0;
          const cardColor = CARD_COLORS[colorIdx];
          const isSelected = selectedCard === card.id;
          const isColorPickerOpen = colorPickerOpen === card.id;
          const isHovered = hoveredCard === card.id;

          const borderColor = isSelected
            ? obsidian.cardBorderSelected
            : isActive
            ? obsidian.accentColor
            : colorIdx > 0
            ? cardColor.border
            : obsidian.cardBorder;

          const bgColor = colorIdx > 0 ? cardColor.bg : obsidian.cardBg;
          const headerBgColor = colorIdx > 0 ? cardColor.headerBg : obsidian.cardHeaderBg;

          const edges: Side[] = ['top', 'right', 'bottom', 'left'];

          const getAnchorDotStyle = (side: Side): React.CSSProperties => {
            const dotSize = 8 / zoom;
            const isSnapped = snapTarget?.cardId === card.id && snapTarget?.side === side;
            const isSource = connDrag?.fromCard === card.id && connDrag?.fromSide === side;
            const showDots = isHovered || connDrag !== null;
            const isDotActive = isSnapped || isSource;
            const finalSize = isDotActive ? dotSize * 1.6 : dotSize;

            const base: React.CSSProperties = {
              position: 'absolute',
              width: finalSize,
              height: finalSize,
              borderRadius: '50%',
              background: isDotActive ? obsidian.accentColor : obsidian.anchorDotBg,
              border: `${1.5 / zoom}px solid ${isDotActive ? '#fff' : obsidian.accentColorDim}`,
              cursor: 'crosshair',
              zIndex: 10,
              opacity: showDots || isDotActive ? 1 : 0,
              transition: 'all 0.18s ease',
              transform: 'translate(-50%, -50%)',
              boxShadow: isDotActive
                ? `0 0 ${6 / zoom}px ${obsidian.accentColor}`
                : 'none',
              pointerEvents: showDots || isDotActive ? 'auto' : 'none',
            };
            if (side === 'top') return { ...base, top: 0, left: '50%' };
            if (side === 'bottom') return { ...base, top: '100%', left: '50%' };
            if (side === 'left') return { ...base, top: '50%', left: 0 };
            return { ...base, top: '50%', left: '100%' };
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
                background: bgColor,
                border: `${isSelected ? 1.5 : 1}px solid ${borderColor}`,
                borderRadius: obsidian.cardRadius / zoom,
                boxShadow: isSelected
                  ? `0 0 0 ${1 / zoom}px ${obsidian.cardBorderSelectedGlow}, ${obsidian.shadow}`
                  : isHovered
                  ? `0 4px 16px rgba(0,0,0,0.45)`
                  : `0 2px 8px rgba(0,0,0,0.35)`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
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
              {/* Anchor dots */}
              {edges.map(side => (
                <div
                  key={side}
                  style={getAnchorDotStyle(side)}
                  onMouseDown={e => {
                    e.stopPropagation();
                    e.preventDefault();
                    const fromCard = filteredCards.find(c => c.id === card.id)!;
                    const pt = getSidePt(fromCard, side);
                    connDragRef.current = { fromCard: card.id, fromSide: side, mx: pt.x, my: pt.y, toSide: null };
                    setConnDrag({ fromCard: card.id, fromSide: side, mx: pt.x, my: pt.y, toSide: null });
                  }}
                />
              ))}

              {/* ─── Card Header ─── */}
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
                  padding: `${5 / zoom}px ${10 / zoom}px`,
                  borderBottom: `${1 / zoom}px solid rgba(255,255,255,0.04)`,
                  cursor: 'grab',
                  background: headerBgColor,
                  flexShrink: 0,
                  borderRadius: `${obsidian.cardRadius / zoom}px ${obsidian.cardRadius / zoom}px 0 0`,
                  minHeight: 28 / zoom,
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center',
                  gap: 6 / zoom, minWidth: 0, flex: 1
                }}>
                  <Grip
                    size={10 / zoom}
                    style={{ color: obsidian.textFaint, flexShrink: 0, opacity: 0.5 }}
                  />
                  {isNote && (
                    <FileText
                      size={11 / zoom}
                      style={{ color: obsidian.textMuted, flexShrink: 0 }}
                    />
                  )}
                  {!isNote && (
                    <Type
                      size={11 / zoom}
                      style={{ color: obsidian.textMuted, flexShrink: 0 }}
                    />
                  )}
                  <span style={{
                    fontSize: 12 / zoom,
                    fontWeight: 500,
                    color: isActive ? obsidian.textPrimary : obsidian.textSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em',
                  }}>
                    {isNote ? titleLine : 'Text'}
                  </span>
                </div>

                {/* Header actions - only show on hover */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  gap: 1 / zoom, flexShrink: 0,
                  opacity: isHovered || isSelected ? 1 : 0,
                  transition: 'opacity 0.15s ease',
                }}>
                  {/* Color dot */}
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation();
                      setColorPickerOpen(prev => prev === card.id ? null : card.id);
                    }}
                    title="Card color"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: `${3 / zoom}px`, display: 'flex',
                      borderRadius: 3 / zoom,
                    }}
                  >
                    <div style={{
                      width: 10 / zoom, height: 10 / zoom, borderRadius: '50%',
                      background: colorIdx > 0 ? cardColor.border : 'rgba(255,255,255,0.2)',
                      border: `${1 / zoom}px solid rgba(255,255,255,0.1)`,
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
                        color: obsidian.textMuted, cursor: 'pointer',
                        padding: `${3 / zoom}px`, display: 'flex',
                        borderRadius: 3 / zoom,
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = obsidian.textPrimary}
                      onMouseLeave={e => e.currentTarget.style.color = obsidian.textMuted}
                    >
                      <Plus size={11 / zoom} />
                    </button>
                  )}
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); deleteCard(card.id); }}
                    title="Remove"
                    style={{
                      background: 'none', border: 'none',
                      color: obsidian.textMuted, cursor: 'pointer',
                      padding: `${3 / zoom}px`, display: 'flex',
                      borderRadius: 3 / zoom,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = obsidian.dangerColor}
                    onMouseLeave={e => e.currentTarget.style.color = obsidian.textMuted}
                  >
                    <Trash2 size={11 / zoom} />
                  </button>
                </div>
              </div>

              {/* ─── Color Picker Popover ─── */}
              {isColorPickerOpen && (
                <div
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 32 / zoom,
                    right: 4 / zoom,
                    background: obsidian.toolbarBg,
                    border: `${1 / zoom}px solid ${obsidian.toolbarBorder}`,
                    borderRadius: 8 / zoom,
                    padding: `${6 / zoom}px ${8 / zoom}px`,
                    display: 'flex',
                    gap: 5 / zoom,
                    zIndex: 20,
                    boxShadow: obsidian.shadowLg,
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
                        width: 14 / zoom, height: 14 / zoom, borderRadius: '50%',
                        background: idx === 0 ? 'rgba(255,255,255,0.15)' : col.border,
                        cursor: 'pointer',
                        border: colorIdx === idx
                          ? `${2 / zoom}px solid ${obsidian.textPrimary}`
                          : `${1 / zoom}px solid rgba(255,255,255,0.08)`,
                        transition: 'transform 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    />
                  ))}
                </div>
              )}

              {/* ─── Card Body ─── */}
              <div style={{
                padding: `${10 / zoom}px ${12 / zoom}px`,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}>
                {isNote ? (
                  <div style={{
                    fontSize: 12 / zoom,
                    color: obsidian.textSecondary,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflow: 'hidden',
                    fontFamily: 'inherit',
                  }}>
                    {previewLines.slice(0, 280) || (
                      <span style={{
                        color: obsidian.textFaint,
                        fontStyle: 'italic',
                      }}>
                        Empty note
                      </span>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={card.content || ''}
                    onChange={e => updateCard(card.id, { content: e.target.value })}
                    onMouseDown={e => e.stopPropagation()}
                    placeholder="Type here..."
                    style={{
                      flex: 1,
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      color: obsidian.textPrimary,
                      fontSize: 12 / zoom,
                      resize: 'none',
                      fontFamily: 'inherit',
                      lineHeight: 1.7,
                      minHeight: 80 / zoom,
                    }}
                  />
                )}
              </div>

              {/* ─── Resize Handle ─── */}
              <div
                onMouseDown={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  resizeRef.current = {
                    id: card.id, startX: e.clientX, startY: e.clientY,
                    startW: card.w, startH: card.h
                  };
                }}
                style={{
                  position: 'absolute',
                  bottom: 0, right: 0,
                  width: 14 / zoom, height: 14 / zoom,
                  cursor: 'nwse-resize',
                  zIndex: 10,
                  opacity: isHovered ? 0.5 : 0,
                  transition: 'opacity 0.15s ease',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-end',
                  padding: 2 / zoom,
                }}
              >
                <svg width={7 / zoom} height={7 / zoom} viewBox="0 0 10 10">
                  <path
                    d="M9 1L1 9M9 5L5 9"
                    stroke={obsidian.textFaint}
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── SVG Connection Layer ─── */}
      <svg
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
          zIndex: 2,
        }}
      >
        <defs>
          {CONN_COLORS.map(color => (
            <marker
              key={`arrow-${color}`}
              id={`arrow-${color.replace('#', '')}`}
              viewBox="0 0 10 10"
              refX="0" refY="5"
              markerWidth={7} markerHeight={7}
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 Z" fill={color} fillOpacity={0.75} />
            </marker>
          ))}
          <marker
            id="arrow-drag-preview"
            viewBox="0 0 10 10"
            refX="0" refY="5"
            markerWidth={7} markerHeight={7}
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 10 5 L 0 8.5 Z" fill={obsidian.accentColor} fillOpacity={0.6} />
          </marker>
        </defs>
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {renderConnections()}
          {connDrag && (() => {
            const fromCard = findCard(connDrag.fromCard);
            if (!fromCard) return null;
            const p1 = getSidePt(fromCard, connDrag.fromSide);
            const p2 = { x: connDrag.mx, y: connDrag.my };
            return (
              <path
                d={smartBezier(p1, connDrag.fromSide, p2, connDrag.toSide)}
                stroke={obsidian.accentColor}
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${5 / zoom} ${3 / zoom}`}
                fill="none"
                strokeOpacity={0.6}
                markerEnd="url(#arrow-drag-preview)"
                style={{ pointerEvents: 'none' }}
              />
            );
          })()}
        </g>
      </svg>

      {/* ─── Top Toolbar (Obsidian style) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: obsidian.toolbarBg,
          borderBottom: `1px solid ${obsidian.toolbarBorder}`,
          zIndex: 10,
          minHeight: 38,
        }}
      >
        {/* Left group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FlintLogo size={14} />
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: obsidian.textSecondary,
            letterSpacing: '0.02em',
          }}>
            Canvas
          </span>

          <div style={{
            height: 16,
            width: 1,
            background: obsidian.toolbarBorder,
            margin: '0 2px',
          }} />

          {/* Stats badge */}
          <span style={{
            fontSize: 10.5,
            color: obsidian.textMuted,
            background: 'rgba(255,255,255,0.03)',
            padding: '2px 8px',
            borderRadius: 4,
            border: `1px solid ${obsidian.toolbarBorder}`,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''} · {wikilinkEdges.length + connections.length} link{(wikilinkEdges.length + connections.length) !== 1 ? 's' : ''}
          </span>

          {/* Add card button */}
          <button
            onClick={addTextCard}
            title="Add text card"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${obsidian.inputBorder}`,
              color: obsidian.textSecondary,
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: 5,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = obsidian.accentBg;
              e.currentTarget.style.borderColor = 'rgba(123,111,199,0.35)';
              e.currentTarget.style.color = obsidian.textPrimary;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.borderColor = obsidian.inputBorder;
              e.currentTarget.style.color = obsidian.textSecondary;
            }}
          >
            <Plus size={12} />
            <span>Add card</span>
          </button>

          {/* Connection color picker */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${obsidian.inputBorder}`,
            borderRadius: 5,
          }}>
            <span style={{
              fontSize: 10, color: obsidian.textMuted,
              marginRight: 2, whiteSpace: 'nowrap',
            }}>
              Line
            </span>
            {CONN_COLORS.map(color => (
              <div
                key={color}
                onClick={() => setSelectedConnColor(color)}
                title={`Connection color: ${color}`}
                style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: color,
                  cursor: 'pointer',
                  border: selectedConnColor === color
                    ? `2px solid ${obsidian.textPrimary}`
                    : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: selectedConnColor === color
                    ? `0 0 4px ${color}`
                    : 'none',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* Right group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: obsidian.inputBg,
            border: `1px solid ${obsidian.inputBorder}`,
            borderRadius: 5,
          }}>
            <Search size={12} style={{ color: obsidian.textFaint }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter cards..."
              style={{
                background: 'none',
                border: 'none',
                outline: 'none',
                color: obsidian.textPrimary,
                fontSize: 12,
                width: 130,
                fontFamily: 'inherit',
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{
                  background: 'none', border: 'none',
                  color: obsidian.textMuted, cursor: 'pointer',
                  padding: 0, display: 'flex',
                }}
                onMouseEnter={e => e.currentTarget.style.color = obsidian.textPrimary}
                onMouseLeave={e => e.currentTarget.style.color = obsidian.textMuted}
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Zoom indicator */}
          <span style={{
            fontSize: 10.5,
            color: obsidian.textMuted,
            fontVariantNumeric: 'tabular-nums',
            minWidth: 38,
            textAlign: 'center',
          }}>
            {Math.round(zoom * 100)}%
          </span>

          {/* Reset */}
          <button
            onClick={resetLayout}
            title="Reset layout"
            style={{
              background: 'none', border: 'none',
              color: obsidian.textMuted, cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              padding: '4px 5px', borderRadius: 4,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = obsidian.textPrimary;
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = obsidian.textMuted;
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
              color: obsidian.textMuted, cursor: 'pointer',
              display: 'flex', padding: 4, borderRadius: 4,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = obsidian.textPrimary;
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = obsidian.textMuted;
              e.currentTarget.style.background = 'none';
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ─── Bottom Hints ─── */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 10,
        color: obsidian.textFaint,
        display: 'flex',
        gap: 8,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        zIndex: 5,
        opacity: 0.7,
        letterSpacing: '0.01em',
      }}>
        <span>Scroll to pan</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Ctrl+Scroll to zoom</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Drag header to move</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Drag dot to connect</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Esc to cancel</span>
      </div>
    </div>
  );
}
