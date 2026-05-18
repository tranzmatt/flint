import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useStore } from '../store';
import { FlintLogo } from './FlintLogo';
import { X, ZoomIn, ZoomOut, RotateCcw, Search, Maximize2, Settings, ChevronDown, ChevronRight } from 'lucide-react';

interface GNode {
  id: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  conns: number;
}

interface GEdge {
  from: string;
  to: string;
}

function getSettingsKey(vaultId: string | null) {
  return `flint-graph-settings-${vaultId || 'default'}`;
}

function loadSettings(vaultId: string | null) {
  try {
    const raw = localStorage.getItem(getSettingsKey(vaultId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSettings(vaultId: string | null, settings: Record<string, unknown>) {
  try {
    localStorage.setItem(getSettingsKey(vaultId), JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function isDarkTheme(): boolean {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-base').trim();
  if (!bg) return true;
  if (bg.startsWith('#')) {
    const hex = bg.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return (r + g + b) / 3 < 128;
  }
  return true;
}

export function GraphView() {
  const { state, dispatch } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GNode[]>([]);
  const edgesRef = useRef<GEdge[]>([]);
  const dragRef = useRef<string | null>(null);
  const wasDragRef = useRef(false);
  const panRef = useRef({ x: 0, y: 0, dragging: false, sx: 0, sy: 0 });
  const zoomRef = useRef(1);
  const animRef = useRef(0);
  const hoverRef = useRef<string | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  const [query, setQuery] = useState('');
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [zoom, setZoom] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // User customizable settings
  const saved = useMemo(() => loadSettings(state.activeVaultId), [state.activeVaultId]);
  const [nodeColor, setNodeColor] = useState(saved?.nodeColor || '#b0b8c8');
  const [activeNodeColor, setActiveNodeColor] = useState(saved?.activeNodeColor || '#ffffff');
  const [lineColor, setLineColor] = useState(saved?.lineColor || '#5a6478');
  const [activeLineColor, setActiveLineColor] = useState(saved?.activeLineColor || '#8899aa');
  const [nodeBaseSize, setNodeBaseSize] = useState<number>(saved?.nodeBaseSize ?? 4);
  const [connBoost, setConnBoost] = useState<number>(saved?.connBoost ?? 1.2);
  const [lineWidth, setLineWidth] = useState<number>(saved?.lineWidth ?? 1.2);
  const [activeLineWidth, setActiveLineWidth] = useState<number>(saved?.activeLineWidth ?? 2.0);
  const [lineOpacity, setLineOpacity] = useState<number>(saved?.lineOpacity ?? 0.6);
  const [lineDash, setLineDash] = useState<'solid' | 'dashed' | 'dotted'>(saved?.lineDash || 'solid');
  const [showAllLabels, setShowAllLabels] = useState<boolean>(saved?.showAllLabels ?? false);
  const [radialSpread, setRadialSpread] = useState<number>(saved?.radialSpread ?? 220);

  // Persist settings
  useEffect(() => {
    saveSettings(state.activeVaultId, {
      nodeColor, activeNodeColor, lineColor, activeLineColor,
      nodeBaseSize, connBoost, lineWidth, activeLineWidth,
      lineOpacity, lineDash, showAllLabels, radialSpread,
    });
  }, [nodeColor, activeNodeColor, lineColor, activeLineColor,
      nodeBaseSize, connBoost, lineWidth, activeLineWidth,
      lineOpacity, lineDash, showAllLabels, radialSpread, state.activeVaultId]);

  // Settings ref for render loop
  const settingsRef = useRef({
    nodeColor, activeNodeColor, lineColor, activeLineColor,
    nodeBaseSize, connBoost, lineWidth, activeLineWidth,
    lineOpacity, lineDash, showAllLabels, radialSpread,
  });

  useEffect(() => {
    settingsRef.current = {
      nodeColor, activeNodeColor, lineColor, activeLineColor,
      nodeBaseSize, connBoost, lineWidth, activeLineWidth,
      lineOpacity, lineDash, showAllLabels, radialSpread,
    };
  }, [nodeColor, activeNodeColor, lineColor, activeLineColor,
      nodeBaseSize, connBoost, lineWidth, activeLineWidth,
      lineOpacity, lineDash, showAllLabels, radialSpread]);

  // Build graph with circular layout
  const buildGraph = useCallback(() => {
    const links: Record<string, Set<string>> = {};
    const titleMap = new Map(state.notes.map(n => [n.title.toLowerCase(), n.id]));

    state.notes.forEach(n => { links[n.id] = new Set(); });
    state.notes.forEach(n => {
      const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const m of matches) {
        const tid = titleMap.get(m[1].toLowerCase());
        if (tid && tid !== n.id) {
          links[n.id].add(tid);
          if (links[tid]) links[tid].add(n.id);
        }
      }
    });

    const cx = sizeRef.current.w / 2 || 500;
    const cy = sizeRef.current.h / 2 || 400;
    const spread = settingsRef.current.radialSpread;

    // Sort by connections for concentric rings
    const sorted = state.notes
      .map(n => ({ note: n, conns: links[n.id]?.size || 0 }))
      .sort((a, b) => b.conns - a.conns);

    // Place in concentric circles: most connected at center
    const existing = new Map(nodesRef.current.map(n => [n.id, { x: n.x, y: n.y }]));

    nodesRef.current = sorted.map(({ note, conns }, index) => {
      const old = existing.get(note.id);

      // Ring assignment
      let ring: number;
      if (conns >= 5) ring = 0;
      else if (conns >= 3) ring = 1;
      else if (conns >= 1) ring = 2;
      else ring = 3;

      const nodesInRing = sorted.filter(s => {
        if (ring === 0) return s.conns >= 5;
        if (ring === 1) return s.conns >= 3 && s.conns < 5;
        if (ring === 2) return s.conns >= 1 && s.conns < 3;
        return s.conns === 0;
      });

      const indexInRing = nodesInRing.findIndex(s => s.note.id === note.id);
      const countInRing = nodesInRing.length;

      const radius = ring === 0
        ? spread * 0.3
        : ring === 1
        ? spread * 0.65
        : ring === 2
        ? spread * 1.0
        : spread * 1.4;

      const angle = countInRing > 0
        ? (indexInRing / countInRing) * Math.PI * 2 - Math.PI / 2
        : 0;

      const targetX = cx + Math.cos(angle) * radius;
      const targetY = cy + Math.sin(angle) * radius;

      return {
        id: note.id,
        title: note.title,
        x: old?.x ?? targetX + (Math.random() - 0.5) * 20,
        y: old?.y ?? targetY + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        conns,
      };
    });

    const edgeSet = new Set<string>();
    edgesRef.current = [];
    state.notes.forEach(n => {
      const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const m of matches) {
        const tid = titleMap.get(m[1].toLowerCase());
        if (tid && tid !== n.id) {
          const key = [n.id, tid].sort().join('-');
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edgesRef.current.push({ from: n.id, to: tid });
          }
        }
      }
    });

    setStats({ nodes: nodesRef.current.length, edges: edgesRef.current.length });
  }, [state.notes]);

  // Canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let running = true;
    const dark = isDarkTheme();

    const getNode = (id: string) => nodesRef.current.find(n => n.id === id);

    const simulate = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const cx = sizeRef.current.w / 2;
      const cy = sizeRef.current.h / 2;

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 2200 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Springs
      for (const e of edges) {
        const a = getNode(e.from);
        const b = getNode(e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (dist - 100) * 0.004;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Center
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.0002;
        n.vy += (cy - n.y) * 0.0002;
      }

      // Apply
      for (const n of nodes) {
        if (n.id === dragRef.current) { n.vx = 0; n.vy = 0; continue; }
        n.vx *= 0.88;
        n.vy *= 0.88;
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > 6) { n.vx = (n.vx / speed) * 6; n.vy = (n.vy / speed) * 6; }
        n.x += n.vx;
        n.y += n.vy;
      }
    };

    const hexToRgba = (hex: string, alpha: number): string => {
      const c = hex.replace('#', '');
      const r = parseInt(c.substring(0, 2), 16) || 0;
      const g = parseInt(c.substring(2, 4), 16) || 0;
      const b = parseInt(c.substring(4, 6), 16) || 0;
      return `rgba(${r},${g},${b},${alpha})`;
    };

    const draw = () => {
      if (!running) return;
      simulate();

      const w = canvas.width;
      const h = canvas.height;
      const z = zoomRef.current;
      const p = panRef.current;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const activeId = state.activeNoteId;
      const s = settingsRef.current;
      const q = query.toLowerCase();

      // Background
      ctx.fillStyle = dark ? '#1e1e1e' : '#f5f5f5';
      ctx.fillRect(0, 0, w, h);

      // Dot grid
      const dotColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
      ctx.fillStyle = dotColor;
      const gs = 40 * z;
      if (gs > 8) {
        const ox = ((p.x % gs) + gs) % gs;
        const oy = ((p.y % gs) + gs) % gs;
        for (let x = ox; x < w; x += gs) {
          for (let y = oy; y < h; y += gs) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Concentric ring guides
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(z, z);

      const cx = sizeRef.current.w / 2;
      const cy = sizeRef.current.h / 2;
      const ringColor = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      for (let i = 1; i <= 4; i++) {
        const r = s.radialSpread * (i * 0.35);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const isMatch = (n: GNode) => !q || n.title.toLowerCase().includes(q);

      // Get connected node IDs for hover/active
      const getConnectedIds = (nodeId: string): Set<string> => {
        const ids = new Set<string>();
        edges.forEach(e => {
          if (e.from === nodeId) ids.add(e.to);
          if (e.to === nodeId) ids.add(e.from);
        });
        return ids;
      };

      const hoverConnected = hoverRef.current ? getConnectedIds(hoverRef.current) : new Set<string>();
      const activeConnected = activeId ? getConnectedIds(activeId) : new Set<string>();

      // Line dash pattern
      const getDash = (): number[] => {
        if (s.lineDash === 'dashed') return [6, 4];
        if (s.lineDash === 'dotted') return [2, 3];
        return [];
      };

      // Edges
      for (const e of edges) {
        const a = getNode(e.from);
        const b = getNode(e.to);
        if (!a || !b) continue;
        if (q && !isMatch(a) && !isMatch(b)) continue;

        const isActive = activeId === e.from || activeId === e.to;
        const isHover = hoverRef.current === e.from || hoverRef.current === e.to;
        const highlight = isActive || isHover;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);

        if (highlight) {
          ctx.strokeStyle = hexToRgba(s.activeLineColor, 0.9);
          ctx.lineWidth = s.activeLineWidth;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = hexToRgba(s.lineColor, s.lineOpacity);
          ctx.lineWidth = s.lineWidth;
          ctx.setLineDash(getDash());
        }

        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Nodes
      for (const n of nodes) {
        const dimmed = q && !isMatch(n);
        if (dimmed) continue;

        const isActive = n.id === activeId;
        const isHover = n.id === hoverRef.current;
        const isConnectedToHover = hoverConnected.has(n.id);
        const isConnectedToActive = activeConnected.has(n.id);

        // Size: base + small boost for connections
        const boost = Math.min(n.conns * s.connBoost, s.nodeBaseSize * 1.5);
        const radius = s.nodeBaseSize + boost;

        // Glow for active/hover
        if (isActive || isHover) {
          const glowRadius = radius * 3;
          const glow = ctx.createRadialGradient(n.x, n.y, radius, n.x, n.y, glowRadius);
          const glowColor = isActive ? s.activeNodeColor : s.nodeColor;
          glow.addColorStop(0, hexToRgba(glowColor, 0.2));
          glow.addColorStop(1, hexToRgba(glowColor, 0));
          ctx.beginPath();
          ctx.arc(n.x, n.y, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);

        if (isActive) {
          ctx.fillStyle = s.activeNodeColor;
        } else if (isHover || isConnectedToHover || isConnectedToActive) {
          ctx.fillStyle = hexToRgba(s.nodeColor, 1);
        } else if (n.conns === 0) {
          ctx.fillStyle = hexToRgba(s.nodeColor, 0.35);
        } else {
          ctx.fillStyle = hexToRgba(s.nodeColor, 0.7);
        }
        ctx.fill();

        // Border
        if (isActive) {
          ctx.strokeStyle = s.activeNodeColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (isHover) {
          ctx.strokeStyle = hexToRgba(s.nodeColor, 0.8);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Label
        const showLabel = s.showAllLabels || isActive || isHover || isConnectedToHover;
        if (showLabel) {
          const fontSize = isActive ? 12 : isHover ? 11 : 10;
          ctx.font = `${isActive ? '600' : '400'} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          ctx.textAlign = 'center';

          const text = n.title;
          const tw = ctx.measureText(text).width;
          const tx = n.x;
          const ty = n.y + radius + 15;
          const padH = 5;
          const padV = 3;

          // Label bg
          ctx.fillStyle = dark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.8)';
          const bx = tx - tw / 2 - padH;
          const by = ty - fontSize;
          const bw = tw + padH * 2;
          const bh = fontSize + padV * 2;
          const br = 3;
          ctx.beginPath();
          ctx.moveTo(bx + br, by);
          ctx.lineTo(bx + bw - br, by);
          ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
          ctx.lineTo(bx + bw, by + bh - br);
          ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
          ctx.lineTo(bx + br, by + bh);
          ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
          ctx.lineTo(bx, by + br);
          ctx.quadraticCurveTo(bx, by, bx + br, by);
          ctx.closePath();
          ctx.fill();

          // Text
          ctx.fillStyle = isActive
            ? (dark ? '#ffffff' : '#000000')
            : (dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)');
          ctx.fillText(text, tx, ty);
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [state.activeNoteId, state.notes, query]);

  const getNodeAt = useCallback((mx: number, my: number) => {
    const z = zoomRef.current;
    const p = panRef.current;
    const wx = (mx - p.x) / z;
    const wy = (my - p.y) / z;
    const s = settingsRef.current;
    for (const n of [...nodesRef.current].reverse()) {
      const boost = Math.min(n.conns * s.connBoost, s.nodeBaseSize * 1.5);
      const r = s.nodeBaseSize + boost + 6;
      if ((wx - n.x) ** 2 + (wy - n.y) ** 2 < r * r) return n;
    }
    return null;
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    wasDragRef.current = false;
    if (node) {
      dragRef.current = node.id;
    } else {
      panRef.current.dragging = true;
      panRef.current.sx = e.clientX - panRef.current.x;
      panRef.current.sy = e.clientY - panRef.current.y;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (dragRef.current) {
      wasDragRef.current = true;
      const z = zoomRef.current;
      const p = panRef.current;
      const node = nodesRef.current.find(n => n.id === dragRef.current);
      if (node) {
        node.x = (mx - p.x) / z;
        node.y = (my - p.y) / z;
        node.vx = 0;
        node.vy = 0;
      }
    } else if (panRef.current.dragging) {
      panRef.current.x = e.clientX - panRef.current.sx;
      panRef.current.y = e.clientY - panRef.current.sy;
    } else {
      const node = getNodeAt(mx, my);
      hoverRef.current = node?.id || null;
      canvasRef.current!.style.cursor = node ? 'pointer' : 'grab';
    }
  };

  const handleMouseUp = () => {
    dragRef.current = null;
    panRef.current.dragging = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (wasDragRef.current) { wasDragRef.current = false; return; }
    const rect = canvasRef.current!.getBoundingClientRect();
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (node) {
      dispatch({ type: 'OPEN_TAB', payload: node.id });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const oldZ = zoomRef.current;
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newZ = Math.max(0.1, Math.min(5, oldZ * delta));
    panRef.current.x = mx - (mx - panRef.current.x) * (newZ / oldZ);
    panRef.current.y = my - (my - panRef.current.y) * (newZ / oldZ);
    zoomRef.current = newZ;
    setZoom(newZ);
  };

  const handleZoom = (delta: number) => {
    const cx = sizeRef.current.w / 2;
    const cy = sizeRef.current.h / 2;
    const oldZ = zoomRef.current;
    const newZ = Math.max(0.1, Math.min(5, oldZ + delta));
    panRef.current.x = cx - (cx - panRef.current.x) * (newZ / oldZ);
    panRef.current.y = cy - (cy - panRef.current.y) * (newZ / oldZ);
    zoomRef.current = newZ;
    setZoom(newZ);
  };

  const resetView = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0, dragging: false, sx: 0, sy: 0 };
    setZoom(1);
    buildGraph();
  };

  const centerGraph = () => {
    if (nodesRef.current.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodesRef.current.forEach(n => {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    const graphCx = (minX + maxX) / 2;
    const graphCy = (minY + maxY) / 2;
    panRef.current.x = sizeRef.current.w / 2 - graphCx * zoomRef.current;
    panRef.current.y = sizeRef.current.h / 2 - graphCy * zoomRef.current;
  };

  const dark = isDarkTheme();
  const borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const panelBg = dark ? 'rgba(28,28,28,0.94)' : 'rgba(250,250,250,0.95)';
  const textMain = dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
  const textDim = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  const textSub = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
  const inputBg = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  return (
    <div className="fixed inset-0 animate-fade-in" style={{ zIndex: 110, background: dark ? '#1e1e1e' : '#f5f5f5' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab' }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '10px 16px',
          background: panelBg,
          borderBottom: `1px solid ${borderColor}`,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex items-center gap-3">
          <FlintLogo size={14} />
          <span style={{ fontSize: 12, fontWeight: 600, color: textSub }}>Graph View</span>
          <span style={{
            fontSize: 10, color: textDim,
            background: inputBg,
            padding: '2px 8px', borderRadius: 4,
            border: `1px solid ${borderColor}`,
          }}>
            {stats.nodes} nodes · {stats.edges} links
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2" style={{
            padding: '6px 10px', background: inputBg,
            border: `1px solid ${borderColor}`, borderRadius: 6,
          }}>
            <Search size={12} style={{ color: textDim }} />
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Filter nodes..."
              style={{ background: 'none', border: 'none', outline: 'none', color: textMain, fontSize: 12, width: 130 }}
            />
            {query && (
              <button onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', color: textDim, cursor: 'pointer', display: 'flex', padding: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>

          <span style={{ fontSize: 10, color: textDim, minWidth: 38, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(zoom * 100)}%
          </span>

          <button onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })}
            style={{ background: 'none', border: 'none', color: textDim, cursor: 'pointer', display: 'flex', padding: 4 }}
            onMouseEnter={e => { e.currentTarget.style.color = textMain; }}
            onMouseLeave={e => { e.currentTarget.style.color = textDim; }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <div style={{
        position: 'absolute', top: 56, right: 12, width: 240,
        background: panelBg, backdropFilter: 'blur(12px)',
        border: `1px solid ${borderColor}`, borderRadius: 8,
        overflow: 'hidden',
      }}>
        <button onClick={() => setSettingsOpen(!settingsOpen)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '10px 12px',
            background: 'none', border: 'none', color: textMain, cursor: 'pointer',
            borderBottom: settingsOpen ? `1px solid ${borderColor}` : 'none',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings size={13} style={{ color: textDim }} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>Appearance</span>
          </div>
          {settingsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        {settingsOpen && (
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Node Colors */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Nodes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: textSub, width: 65 }}>Color</span>
                  <input type="color" value={nodeColor} onChange={e => setNodeColor(e.target.value)}
                    style={{ width: 24, height: 20, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: textSub, width: 65 }}>Active</span>
                  <input type="color" value={activeNodeColor} onChange={e => setActiveNodeColor(e.target.value)}
                    style={{ width: 24, height: 20, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: textSub, width: 65 }}>Size</span>
                  <input type="range" min={2} max={10} step={0.5} value={nodeBaseSize}
                    onChange={e => setNodeBaseSize(parseFloat(e.target.value))}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: textDim, width: 20, textAlign: 'right' }}>{nodeBaseSize}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: textSub, width: 65 }}>Boost</span>
                  <input type="range" min={0} max={3} step={0.2} value={connBoost}
                    onChange={e => setConnBoost(parseFloat(e.target.value))}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: textDim, width: 20, textAlign: 'right' }}>{connBoost}</span>
                </div>
              </div>
            </div>

            {/* Lines */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Lines
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: textSub, width: 65 }}>Color</span>
                  <input type="color" value={lineColor} onChange={e => setLineColor(e.target.value)}
                    style={{ width: 24, height: 20, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: textSub, width: 65 }}>Active</span>
                  <input type="color" value={activeLineColor} onChange={e => setActiveLineColor(e.target.value)}
                    style={{ width: 24, height: 20, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: textSub, width: 65 }}>Width</span>
                  <input type="range" min={0.5} max={4} step={0.1} value={lineWidth}
                    onChange={e => setLineWidth(parseFloat(e.target.value))}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: textDim, width: 20, textAlign: 'right' }}>{lineWidth}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: textSub, width: 65 }}>Highlight</span>
                  <input type="range" min={1} max={5} step={0.2} value={activeLineWidth}
                    onChange={e => setActiveLineWidth(parseFloat(e.target.value))}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: textDim, width: 20, textAlign: 'right' }}>{activeLineWidth}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: textSub, width: 65 }}>Opacity</span>
                  <input type="range" min={0.1} max={1} step={0.05} value={lineOpacity}
                    onChange={e => setLineOpacity(parseFloat(e.target.value))}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: textDim, width: 20, textAlign: 'right' }}>{lineOpacity.toFixed(1)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: textSub, width: 65 }}>Style</span>
                  <select value={lineDash} onChange={e => setLineDash(e.target.value as 'solid' | 'dashed' | 'dotted')}
                    style={{
                      flex: 1, background: inputBg, border: `1px solid ${borderColor}`,
                      borderRadius: 4, padding: '3px 6px', color: textSub, fontSize: 11, outline: 'none',
                    }}>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Layout */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Layout
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: textSub, width: 65 }}>Spread</span>
                  <input type="range" min={100} max={500} step={10} value={radialSpread}
                    onChange={e => { setRadialSpread(parseInt(e.target.value)); }}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: textDim, width: 24, textAlign: 'right' }}>{radialSpread}</span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: textSub, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showAllLabels} onChange={e => setShowAllLabels(e.target.checked)} />
                  Show all labels
                </label>
              </div>
            </div>

            {/* Reset settings */}
            <button
              onClick={() => {
                setNodeColor('#b0b8c8'); setActiveNodeColor('#ffffff');
                setLineColor('#5a6478'); setActiveLineColor('#8899aa');
                setNodeBaseSize(4); setConnBoost(1.2);
                setLineWidth(1.2); setActiveLineWidth(2.0);
                setLineOpacity(0.6); setLineDash('solid');
                setShowAllLabels(false); setRadialSpread(220);
              }}
              style={{
                width: '100%', padding: '7px 0',
                background: inputBg, border: `1px solid ${borderColor}`,
                borderRadius: 6, color: textSub, cursor: 'pointer',
                fontSize: 11, fontWeight: 500,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = inputBg; }}
            >
              Reset to defaults
            </button>
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div style={{
        position: 'absolute', bottom: 16, right: 12,
        display: 'flex', flexDirection: 'column', gap: 2,
        background: panelBg, border: `1px solid ${borderColor}`,
        borderRadius: 8, padding: 3, backdropFilter: 'blur(8px)',
      }}>
        {[
          { icon: <ZoomIn size={14} />, fn: () => handleZoom(0.2), t: 'Zoom in' },
          { icon: <ZoomOut size={14} />, fn: () => handleZoom(-0.2), t: 'Zoom out' },
          { icon: <Maximize2 size={14} />, fn: centerGraph, t: 'Center' },
          { icon: <RotateCcw size={14} />, fn: resetView, t: 'Reset' },
        ].map((b, i) => (
          <button key={i} onClick={b.fn} title={b.t}
            style={{
              width: 32, height: 32, background: 'none', border: 'none',
              color: textDim, cursor: 'pointer', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = inputBg; e.currentTarget.style.color = textMain; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = textDim; }}>
            {b.icon}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 16, left: 12,
        background: panelBg, border: `1px solid ${borderColor}`,
        borderRadius: 8, padding: '10px 14px',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Legend
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeNodeColor, border: `1.5px solid ${activeNodeColor}` }} />
            <span style={{ fontSize: 10, color: textSub }}>Active note</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: nodeColor }} />
            <span style={{ fontSize: 10, color: textSub }}>Connected</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: nodeColor, opacity: 0.35 }} />
            <span style={{ fontSize: 10, color: textSub }}>Orphan</span>
          </div>
        </div>
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: `1px solid ${borderColor}`,
          fontSize: 9, color: textDim, lineHeight: 1.6,
        }}>
          Scroll to zoom · Drag to pan
          <br />
          Click node to open
        </div>
      </div>
    </div>
  );
}
