import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useStore } from '../store';
import { FlintLogo } from './FlintLogo';
import { Grip, RotateCcw, Search, X, Plus, Type, Trash2, FileText } from 'lucide-react';
import type { CanvasCard } from '../types';

export function CanvasView() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const canvasDragRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeVaultId = state.activeVaultId;
  const workspace = activeVaultId ? state.vaultData[activeVaultId] : null;
  const cards = workspace?.canvasCards || [];

  const updateCards = useCallback((newCards: CanvasCard[]) => {
    dispatch({ type: 'UPDATE_CANVAS_CARDS', payload: newCards });
  }, [dispatch]);

  // Initial layout
  useEffect(() => {
    if (activeVaultId && cards.length === 0 && state.notes.length > 0) {
      const initialCards: CanvasCard[] = state.notes.slice(0, 20).map((note, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        return {
          id: note.id,
          type: 'note',
          noteId: note.id,
          x: 60 + col * 300,
          y: 80 + row * 200,
          w: 240,
          h: 140,
        };
      });
      updateCards(initialCards);
    }
  }, [activeVaultId]);

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

  const edges = useMemo(() => {
    const filteredIds = new Set(filteredCards.map(c => c.id));
    const noteTitleIdMap = new Map(
      state.notes.map(note => [note.title.toLowerCase(), note.id])
    );
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
      x: Math.round((400 - pan.x) / zoom),
      y: Math.round((300 - pan.y) / zoom),
      w: 220,
      h: 140,
    };
    updateCards([...cards, newCard]);
  };

  const deleteCard = (id: string) => {
    updateCards(cards.filter(c => c.id !== id));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      updateCard(dragRef.current.id, {
        x: Math.round((e.clientX - pan.x - dragRef.current.offsetX) / zoom),
        y: Math.round((e.clientY - pan.y - dragRef.current.offsetY) / zoom),
      });
    } else if (canvasDragRef.current) {
      setPan({
        x: e.clientX - canvasDragRef.current.x,
        y: e.clientY - canvasDragRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    dragRef.current = null;
    canvasDragRef.current = null;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'default';
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    canvasDragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
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
      setPan(p => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }));
    }
  };

  const resetLayout = () => {
    if (confirm('Reset canvas layout? All card positions and text cards will be cleared.')) {
      updateCards([]);
      setPan({ x: 0, y: 0 });
      setZoom(1);
    }
  };

  const findCard = (id: string) => filteredCards.find(c => c.id === id);

  const borderColor = 'rgba(255,255,255,0.08)';
  const surfaceBg = 'rgba(30,30,30,0.95)';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 animate-fade-in overflow-hidden select-none"
      style={{ zIndex: 110, background: '#1a1a1a' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Dot grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
          backgroundPosition: `${pan.x % (28 * zoom)}px ${pan.y % (28 * zoom)}px`,
          pointerEvents: 'none',
        }}
      />

      {/* SVG edge layer */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          <defs>
            <marker
              id="arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path
                d="M0,0 L0,6 L6,3 z"
                fill="rgba(255,255,255,0.2)"
              />
            </marker>
          </defs>
          {edges.map(edge => {
            const from = findCard(edge.from);
            const to = findCard(edge.to);
            if (!from || !to) return null;

            const x1 = from.x + from.w / 2;
            const y1 = from.y + from.h / 2;
            const x2 = to.x + to.w / 2;
            const y2 = to.y + to.h / 2;

            // Bezier control points
            const dx = x2 - x1;
            const dy = y2 - y1;
            const cx1 = x1 + dx * 0.4;
            const cy1 = y1;
            const cx2 = x2 - dx * 0.4;
            const cy2 = y2;

            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1 / zoom}
                fill="none"
                markerEnd="url(#arrow)"
              />
            );
          })}
        </g>
      </svg>

      {/* Canvas content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
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
                .slice(0, 5)
                .join('\n')
            : '';

          const titleLine = isNote && note
            ? note.content.split('\n').find(l => l.startsWith('# '))?.replace(/^# /, '') || note.title
            : 'Text Note';

          return (
            <div
              key={card.id}
              style={{
                position: 'absolute',
                left: card.x,
                top: card.y,
                width: card.w,
                minHeight: card.h,
                background: isActive
                  ? 'rgba(45,45,48,0.98)'
                  : surfaceBg,
                border: `${1 / zoom}px solid ${isActive
                  ? 'rgba(255,255,255,0.2)'
                  : borderColor}`,
                borderRadius: 6 / zoom,
                boxShadow: isActive
                  ? '0 8px 32px rgba(0,0,0,0.5)'
                  : '0 4px 16px rgba(0,0,0,0.4)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Card header / drag handle */}
              <div
                onMouseDown={e => {
                  e.stopPropagation();
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
                  background: 'rgba(0,0,0,0.2)',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5 / zoom,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <Grip
                    size={9 / zoom}
                    style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}
                  />
                  {isNote && (
                    <FileText
                      size={9 / zoom}
                      style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: 11 / zoom,
                      fontWeight: 500,
                      color: isActive
                        ? 'rgba(255,255,255,0.85)'
                        : 'rgba(255,255,255,0.5)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {titleLine}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2 / zoom,
                    flexShrink: 0,
                  }}
                >
                  {isNote && (
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        dispatch({ type: 'OPEN_TAB', payload: card.noteId! });
                      }}
                      title="Open note"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.25)',
                        cursor: 'pointer',
                        padding: `${2 / zoom}px`,
                        display: 'flex',
                        borderRadius: 3 / zoom,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = 'rgba(255,255,255,0.25)';
                        e.currentTarget.style.background = 'none';
                      }}
                    >
                      <Plus size={10 / zoom} />
                    </button>
                  )}
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation();
                      deleteCard(card.id);
                    }}
                    title="Remove from canvas"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.25)',
                      cursor: 'pointer',
                      padding: `${2 / zoom}px`,
                      display: 'flex',
                      borderRadius: 3 / zoom,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = 'rgba(220,80,80,0.8)';
                      e.currentTarget.style.background = 'rgba(220,80,80,0.1)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'rgba(255,255,255,0.25)';
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    <Trash2 size={10 / zoom} />
                  </button>
                </div>
              </div>

              {/* Card body */}
              <div
                style={{
                  padding: `${8 / zoom}px ${10 / zoom}px`,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {isNote ? (
                  <div
                    style={{
                      fontSize: 11 / zoom,
                      color: 'rgba(255,255,255,0.45)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflow: 'hidden',
                      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    }}
                  >
                    {previewLines.slice(0, 180) || (
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>
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
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: 11 / zoom,
                      resize: 'none',
                      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                      lineHeight: 1.6,
                      minHeight: 80 / zoom,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Header toolbar */}
      <div
        className="flex items-center justify-between"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '10px 16px',
          background: 'rgba(20,20,20,0.88)',
          borderBottom: `1px solid ${borderColor}`,
          backdropFilter: 'blur(10px)',
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-3">
          <FlintLogo size={14} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            Canvas
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.05)',
              padding: '2px 8px',
              borderRadius: 4,
              border: `1px solid ${borderColor}`,
            }}
          >
            {filteredCards.length} cards · {edges.length} links
          </span>

          {/* Add text card */}
          <button
            onClick={addTextCard}
            title="Add text card"
            className="flex items-center gap-2"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${borderColor}`,
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: 5,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
            }}
          >
            <Type size={12} />
            Add card
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div
            className="flex items-center gap-2"
            style={{
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${borderColor}`,
              borderRadius: 6,
            }}
          >
            <Search size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter cards..."
              style={{
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'rgba(255,255,255,0.8)',
                fontSize: 12,
                width: 160,
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Zoom display */}
          <span
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              fontVariantNumeric: 'tabular-nums',
              minWidth: 38,
              textAlign: 'center',
            }}
          >
            {Math.round(zoom * 100)}%
          </span>

          {/* Reset */}
          <button
            onClick={resetLayout}
            title="Reset layout"
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              padding: '4px 6px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.3)';
            }}
          >
            <RotateCcw size={13} />
          </button>

          {/* Close */}
          <button
            onClick={() => dispatch({ type: 'TOGGLE_CANVAS_VIEW' })}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              display: 'flex',
              padding: 4,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.3)';
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Hint bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 10,
          color: 'rgba(255,255,255,0.2)',
          display: 'flex',
          gap: 12,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span>Scroll to pan</span>
        <span>·</span>
        <span>Ctrl+Scroll to zoom</span>
        <span>·</span>
        <span>Drag header to move card</span>
      </div>
    </div>
  );
}
