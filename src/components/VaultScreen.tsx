import { useState } from 'react';
import { useStore } from '../store';
import { Plus, Trash2, Lock } from 'lucide-react';

export function VaultScreen() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState('');
  const [showNew, setShowNew] = useState(false);

  const colors = ['#888', '#777', '#999', '#aaa', '#666', '#bbb', '#555', '#999'];

  const create = () => {
    if (!name.trim()) return;
    const id = 'v' + Date.now();
    dispatch({ type: 'CREATE_VAULT', payload: { id, name: name.trim(), color: colors[Math.floor(Math.random() * colors.length)] } });
    dispatch({ type: 'OPEN_VAULT', payload: id });
    setName('');
    setShowNew(false);
  };

  return (
    <div className="h-screen flex items-center justify-center" style={{ background: '#050505' }}>
      <div className="animate-fade-in" style={{ width: 480, maxWidth: '95vw' }}>
        <div className="text-center" style={{ marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#111', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <img src="/flint-logo.png" alt="Flint" style={{ width: 34, height: 34, borderRadius: 6 }} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e0e0e0', letterSpacing: '-0.02em' }}>Flint</h1>
          <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Local knowledge base</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10, color: '#444', marginTop: 8 }}>
            <Lock size={9} /> Offline & Secure
          </div>
        </div>

        {state.vaults.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, padding: '0 4px' }}>
              Your Vaults
            </div>
            {state.vaults.map(vault => (
              <div key={vault.id}
                className="flex items-center gap-3 cursor-pointer"
                style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 2, background: '#0a0a0a', border: '1px solid #1a1a1a', transition: 'all 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.borderColor = '#2a2a2a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.borderColor = '#1a1a1a'; }}
                onClick={() => dispatch({ type: 'OPEN_VAULT', payload: vault.id })}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #222' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: vault.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#ccc' }}>{vault.name}</div>
                  <div style={{ fontSize: 11, color: '#444', marginTop: 1 }}>
                    {state.notes.length} notes
                  </div>
                </div>
                <button
                  style={{ padding: 4, background: 'none', border: 'none', color: '#333', cursor: 'pointer', borderRadius: 4, display: 'flex' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#888'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#333'; }}
                  onClick={e => { e.stopPropagation(); if (confirm('Delete vault "' + vault.name + '"?')) dispatch({ type: 'DELETE_VAULT', payload: vault.id }); }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showNew ? (
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 10, padding: 16 }} className="animate-scale-in">
            <div style={{ fontSize: 13, fontWeight: 600, color: '#bbb', marginBottom: 12 }}>Create new vault</div>
            <input type="text" placeholder="Vault name" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setShowNew(false); }}
              autoFocus
              style={{ width: '100%', padding: '8px 12px', background: '#050505', border: '1px solid #1a1a1a', borderRadius: 6, color: '#ccc', fontSize: 14, outline: 'none', marginBottom: 12 }}
            />
            <div className="flex items-center gap-2">
              <button onClick={create}
                style={{ flex: 1, padding: '8px 0', background: '#888', color: '#000', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Create Vault
              </button>
              <button onClick={() => { setShowNew(false); setName(''); }}
                style={{ padding: '8px 16px', background: '#1a1a1a', color: '#888', border: '1px solid #222', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowNew(true)}
            className="flex items-center justify-center gap-2"
            style={{ width: '100%', padding: '10px 0', background: '#0a0a0a', border: '1px dashed #222', borderRadius: 8, color: '#666', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#999'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#666'; }}>
            <Plus size={15} /> Create new vault
          </button>
        )}

        <div className="text-center" style={{ marginTop: 32 }}>
          <div className="flex items-center justify-center gap-4" style={{ fontSize: 10, color: '#333' }}>
            <span>Encrypted storage</span>
            <span>·</span>
            <span>Zero telemetry</span>
            <span>·</span>
            <span>100% offline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
