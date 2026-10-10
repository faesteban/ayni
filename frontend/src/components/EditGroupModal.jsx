import { useState, useEffect } from 'react';
import { useGroupStore, useToastStore } from '../store';
import { Modal, Spinner } from './common';
import { ImagePicker } from './ImagePicker';

const EMOJIS = ['🏠', '🏖️', '🎉', '🏢', '⚽', '🎸', '🍕', '🏕️', '💼', '❤️', '🎓', '🌍'];

export function EditGroupModal({ open, onClose, group }) {
  const { updateGroup } = useGroupStore();
  const toast = useToastStore();

  const [form, setForm] = useState({
    name: '',
    description: '',
    emoji: '🏠',
    image_url: null,
    currency: 'EUR',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (group && open) {
      setForm({
        name: group.name || '',
        description: group.description || '',
        emoji: group.emoji || '🏠',
        image_url: group.image_url || null,
        currency: group.currency || 'EUR',
      });
    }
  }, [group, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre del grupo es obligatorio');
      return;
    }

    setSaving(true);
    try {
      await updateGroup(group.id, {
        name: form.name.trim(),
        description: form.description?.trim() || null,
        emoji: form.emoji,
        image_url: form.image_url,
        currency: form.currency,
      });
      toast.success('¡Grupo actualizado!');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error al actualizar el grupo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar grupo">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Group Photo */}
          <ImagePicker
            value={form.image_url}
            onChange={(url) => setForm(f => ({ ...f, image_url: url }))}
            fallback={form.emoji}
            shape="square"
            size={88}
            label="Foto del grupo"
            hint="Sube una foto personalizada para el grupo."
          />

          {/* Emoji selector (shown if no photo or as icon fallback) */}
          <div className="form-group">
            <label className="form-label">
              Emoji {form.image_url ? '(icono alternativo)' : ''}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, emoji }))}
                  style={{
                    fontSize: '1.4rem',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    background: form.emoji === emoji ? 'var(--primary-glow)' : 'var(--bg-elevated)',
                    border: form.emoji === emoji ? '2px solid var(--primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input
              className="form-input"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Opcional"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Moneda</label>
            <select
              className="form-select"
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            >
              <option value="EUR">€ Euro</option>
              <option value="USD">$ Dólar</option>
              <option value="GBP">£ Libra</option>
              <option value="MXN">$ Peso MX</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !form.name.trim()}
            >
              {saving ? <Spinner size={16} /> : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
