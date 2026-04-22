import { useStore } from '../store';

export function StatusBar() {
  const { state } = useStore();
  const note = state.notes.find(n => n.id === state.activeNoteId);
  const words = note ? note.content.trim().split(/\s+/).filter(Boolean).length : 0;
  const chars = note ? note.content.length : 0;

  return (
    <div className="flex items-center justify-between shrink-0"
      style={{ height: 24, padding: '0 12px', background: '#060606', borderTop: '1px solid #1a1a1a', fontSize: 11, color: '#333' }}>
      <div className="flex items-center gap-4">
        <span>{words} words</span>
        <span>{chars} chars</span>
      </div>
      <div className="flex items-center gap-4">
        <span style={{ color: '#444' }}>Auto-save ✓</span>
        <div className="flex items-center gap-1">
          <img src="/flint-logo.png" alt="" style={{ width: 10, height: 10, borderRadius: 2, opacity: 0.4 }} />
          <span style={{ color: '#333' }}>Flint v1.0</span>
        </div>
      </div>
    </div>
  );
}
