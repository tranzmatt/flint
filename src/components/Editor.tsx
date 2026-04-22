import { useRef, useEffect } from 'react';
import { useStore } from '../store';

export function Editor({ noteId }: { noteId: string }) {
  const { state, dispatch } = useStore();
  const note = state.notes.find(n => n.id === noteId);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (taRef.current && note) {
      if (taRef.current.value !== note.content) taRef.current.value = note.content;
    }
  }, [noteId, note]);

  if (!note) return null;

  const handleChange = (val: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => dispatch({ type: 'UPDATE_NOTE', payload: { id: noteId, content: val } }), 500);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = taRef.current!;
      const s = ta.selectionStart;
      const end = ta.selectionEnd;
      ta.value = ta.value.substring(0, s) + '  ' + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = s + 2;
      handleChange(ta.value);
    }
  };

  return (
    <textarea ref={taRef} className="flint-editor"
      defaultValue={note.content}
      onChange={e => handleChange(e.target.value)}
      onKeyDown={handleKey}
      placeholder="Start writing..."
      spellCheck={false}
    />
  );
}
