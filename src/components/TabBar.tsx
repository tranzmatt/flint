import { useStore } from '../store';
import { X } from 'lucide-react';

export function TabBar() {
  const { state, dispatch } = useStore();

  if (state.openTabs.length === 0) return null;

  return (
    <div className="flex shrink-0" style={{ height: 32, borderBottom: '1px solid #1a1a1a', background: '#080808', overflow: 'hidden' }}>
      {state.openTabs.map(tabId => {
        const note = state.notes.find(n => n.id === tabId);
        if (!note) return null;
        const active = tabId === state.activeNoteId;
        return (
          <div key={tabId} className="flex items-center gap-1 cursor-pointer"
            style={{ padding: '0 12px', borderRight: '1px solid #1a1a1a', background: active ? '#0a0a0a' : '#060606', borderBottom: active ? '2px solid #555' : '2px solid transparent', maxWidth: 160, minWidth: 100, transition: 'all 0.08s' }}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tabId })}>
            <span style={{ flex: 1, fontSize: 11, color: active ? '#bbb' : '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {note.title}
            </span>
            <button onClick={e => { e.stopPropagation(); dispatch({ type: 'CLOSE_TAB', payload: tabId }); }}
              style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', padding: 2, display: 'flex', borderRadius: 3 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.background = '#1a1a1a'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#333'; e.currentTarget.style.background = 'none'; }}>
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
