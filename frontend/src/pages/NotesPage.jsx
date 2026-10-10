import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNoteStore, useGroupStore, useToastStore } from '../store';
import { EmptyState, Spinner, ConfirmModal, formatRelativeTime } from '../components/common';

const NOTE_COLORS = [
  { value: '#1e1e2e', label: 'Default' },
  { value: '#1a2a1a', label: 'Verde' },
  { value: '#2a1a1a', label: 'Rojo' },
  { value: '#1a1a2a', label: 'Azul' },
  { value: '#2a2a1a', label: 'Amarillo' },
  { value: '#2a1a2a', label: 'Morado' },
  { value: '#1a2a2a', label: 'Turquesa' },
];

const NOTE_COLORS_DISPLAY = [
  '#1e1e2e', '#1f3320', '#2d1515', '#0f1d3d', '#2d2800', '#2a1040', '#0d2b2b',
];

function NoteContentDisplay({ note, onUpdate }) {
  const content = note.content || '';
  if (!content) return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Nota vacía</span>;

  const lines = content.split('\n');
  
  const handleToggle = (index, currentChecked) => {
    const newLines = [...lines];
    const line = newLines[index];
    if (currentChecked) {
      newLines[index] = line.replace(/-\s+\[[xX]\]/, '- [ ]');
    } else {
      newLines[index] = line.replace(/-\s+\[\s\]/, '- [x]');
    }
    onUpdate(note.id, { content: newLines.join('\n') });
  };

  return (
    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, wordBreak: 'break-word' }}>
      {lines.map((line, i) => {
        const trimmed = line.trimStart();
        const isUnchecked = trimmed.startsWith('- [ ]');
        const isChecked = trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]');
        
        if (isUnchecked || isChecked) {
          const text = line.replace(/^\s*-\s+\[[ xX]\]\s*/, '');
          return (
            <div 
              key={i} 
              style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', marginTop: 2, marginBottom: 2 }} 
              onClick={(e) => { e.stopPropagation(); handleToggle(i, isChecked); }}
            >
              <input 
                type="checkbox" 
                checked={isChecked} 
                readOnly
                style={{ marginTop: 4, cursor: 'pointer' }}
              />
              <span style={{ textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1, cursor: 'pointer', flex: 1 }}>
                {text}
              </span>
            </div>
          );
        }
        
        return <div key={i} style={{ minHeight: '1.2em' }}>{line}</div>;
      })}
    </div>
  );
}

function NoteCard({ note, onUpdate, onDelete, onPin }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: note.title || '', content: note.content || '' });
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const titleRef = useRef(null);

  const handleSave = async () => {
    if (!form.content.trim() && !form.title.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onUpdate(note.id, form);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = async (color) => {
    await onUpdate(note.id, { color });
  };

  return (
    <>
      <div
        style={{
          background: note.color || '#1e1e2e',
          border: `1px solid ${note.pinned ? 'rgba(108,99,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          position: 'relative',
          cursor: editing ? 'default' : 'pointer',
          transition: 'all var(--transition-base)',
          minHeight: 100,
        }}
        onClick={() => { if (!editing) { setEditing(true); setTimeout(() => titleRef.current?.focus(), 50); } }}
      >
        {/* Pin indicator */}
        {note.pinned && (
          <div style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.9rem' }}>📌</div>
        )}

        {editing ? (
          <div>
            <input
              ref={titleRef}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Título"
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem',
                width: '100%', marginBottom: 'var(--space-2)', fontFamily: 'var(--font)',
              }}
            />
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Escribe algo..."
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-secondary)', resize: 'none', width: '100%',
                minHeight: 80, fontFamily: 'var(--font)', fontSize: '0.9rem',
              }}
              autoFocus={!form.title}
            />

            {/* Color picker */}
            <div style={{ display: 'flex', gap: 6, marginTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              {NOTE_COLORS_DISPLAY.map(color => (
                <button
                  key={color}
                  onClick={(e) => { e.stopPropagation(); handleColorChange(color); }}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', background: color,
                    border: note.color === color ? '2px solid white' : '2px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <button
                onClick={(e) => { e.stopPropagation(); handleSave(); }}
                className="btn btn-primary btn-sm"
                disabled={saving}
              >
                {saving ? <Spinner size={14} /> : 'Guardar'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(false); setForm({ title: note.title || '', content: note.content || '' }); }}
                className="btn btn-ghost btn-sm"
              >
                Cancelar
              </button>
              <div style={{ flex: 1 }} />
              <button
                onClick={(e) => { e.stopPropagation(); onPin(note.id); }}
                className="btn btn-ghost btn-sm"
                title="Anclar"
              >
                {note.pinned ? '📌' : '📍'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDelete(true); }}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--accent-red)' }}
              >
                🗑️
              </button>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', overflow: 'hidden' }}>
            {note.title && <h4 style={{ marginBottom: 'var(--space-2)', fontSize: '1rem', wordBreak: 'break-word' }}>{note.title}</h4>}
            <NoteContentDisplay note={note} onUpdate={onUpdate} />
            <div style={{ marginTop: 'var(--space-3)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {note.creator_name} · {formatRelativeTime(note.updated_at)}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => onDelete(note.id)}
        title="Eliminar nota"
        message={`¿Eliminar esta nota${note.title ? ` "${note.title}"` : ''}?`}
      />
    </>
  );
}

function NewNoteCard({ onSave }) {
  const [active, setActive] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.content.trim() && !form.title.trim()) {
      setActive(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      setForm({ title: '', content: '' });
      setActive(false);
    } finally {
      setSaving(false);
    }
  };

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        style={{
          background: 'var(--bg-glass)',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text-muted)',
          width: '100%',
          transition: 'all var(--transition-base)',
          fontSize: '0.9rem',
        }}
      >
        + Añadir nota...
      </button>
    );
  }

  return (
    <div style={{
      background: '#1a1a2e',
      border: '1px solid rgba(108,99,255,0.4)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4)',
    }}>
      <input
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        placeholder="Título"
        autoFocus
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem',
          width: '100%', marginBottom: 'var(--space-2)', fontFamily: 'var(--font)',
        }}
      />
      <textarea
        value={form.content}
        onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
        placeholder="Escribe tu nota aquí..."
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          color: 'var(--text-secondary)', resize: 'none', width: '100%',
          minHeight: 80, fontFamily: 'var(--font)', fontSize: '0.9rem',
        }}
      />
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size={14} /> : 'Guardar'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setActive(false); setForm({ title: '', content: '' }); }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function NotesPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { notes, fetchNotes, createNote, updateNote, deleteNote, togglePin, loading } = useNoteStore();
  const toast = useToastStore();

  useEffect(() => {
    fetchNotes(groupId).catch(err => toast.error(err.message));
  }, [groupId]);

  const handleCreate = async (form) => {
    try {
      await createNote(groupId, form);
      toast.success('Nota creada');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUpdate = async (noteId, data) => {
    try {
      await updateNote(groupId, noteId, data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (noteId) => {
    try {
      await deleteNote(groupId, noteId);
      toast.success('Nota eliminada');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handlePin = async (noteId) => {
    try {
      await togglePin(groupId, noteId);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const pinnedNotes = notes.filter(n => n.pinned);
  const unpinnedNotes = notes.filter(n => !n.pinned);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(`/groups/${groupId}`)}>‹</button>
        <h2>📝 Notas</h2>
      </div>

      {/* New note input at top */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <NewNoteCard onSave={handleCreate} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}><Spinner size={32} /></div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon="📝"
          title="Sin notas aún"
          description="Añade notas, ideas y recordatorios del grupo"
        />
      ) : (
        <>
          {/* Pinned section */}
          {pinnedNotes.length > 0 && (
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 'var(--space-3)', textTransform: 'uppercase' }}>
                📌 Ancladas
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
                {pinnedNotes.map(note => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onPin={handlePin}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All notes */}
          {unpinnedNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && (
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 'var(--space-3)', textTransform: 'uppercase' }}>
                  Otras
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
                {unpinnedNotes.map(note => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onPin={handlePin}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
