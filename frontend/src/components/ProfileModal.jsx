import { useState, useEffect } from 'react';
import { useAuthStore, useToastStore } from '../store';
import { Modal, Spinner } from './common';
import { ImagePicker } from './ImagePicker';

export function ProfileModal({ open, onClose }) {
  const { user, updateProfile } = useAuthStore();
  const toast = useToastStore();

  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && open) {
      setName(user.name || '');
      setAvatarUrl(user.avatar_url || null);
    }
  }, [user, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        avatar_url: avatarUrl,
      });
      toast.success('¡Perfil actualizado correctamente!');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error al actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '👤';

  return (
    <Modal open={open} onClose={onClose} title="Editar mi perfil">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Avatar Upload */}
          <ImagePicker
            value={avatarUrl}
            onChange={setAvatarUrl}
            fallback={initials}
            shape="circle"
            size={90}
            label="Foto de perfil"
            hint="Sube una foto desde tu dispositivo o introduce una URL."
          />

          {/* Name */}
          <div className="form-group">
            <label className="form-label">Nombre para mostrar *</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              required
            />
          </div>

          {/* Email (Readonly) */}
          <div className="form-group">
            <label className="form-label">Correo electrónico</label>
            <input
              className="form-input"
              value={user?.email || ''}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Asociado a tu cuenta de Google
            </span>
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
              disabled={saving || !name.trim()}
            >
              {saving ? <Spinner size={16} /> : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
