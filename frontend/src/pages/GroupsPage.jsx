import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupStore, useAuthStore, useToastStore } from '../store';
import { Avatar, GroupAvatar, EmptyState, Modal, Spinner, ConfirmModal } from '../components/common';
import { ImagePicker } from '../components/ImagePicker';
import { ProfileModal } from '../components/ProfileModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { requestNotificationPermission } from '../hooks/useNotifications';

const EMOJIS = ['🏠', '🏖️', '🎉', '🏢', '⚽', '🎸', '🍕', '🏕️', '💼', '❤️', '🎓', '🌍'];

function CreateGroupModal({ open, onClose }) {
  const { createGroup } = useGroupStore();
  const toast = useToastStore();
  const [form, setForm] = useState({ name: '', description: '', emoji: '🏠', image_url: null, currency: 'EUR' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      await createGroup(form);
      toast.success('¡Grupo creado!');
      onClose();
      setForm({ name: '', description: '', emoji: '🏠', image_url: null, currency: 'EUR' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Crear grupo">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <ImagePicker
            value={form.image_url}
            onChange={(url) => setForm(f => ({ ...f, image_url: url }))}
            fallback={form.emoji}
            shape="square"
            size={80}
            label="Foto del grupo (opcional)"
            hint="Personaliza el grupo con una foto o elige un emoji abajo."
          />

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
              placeholder="Ej: Piso Barcelona, Trip NY..."
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input
              className="form-input"
              placeholder="Opcional"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
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

          <button className="btn btn-primary" type="submit" disabled={loading || !form.name.trim()}>
            {loading ? <Spinner size={16} /> : 'Crear grupo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function JoinGroupModal({ open, onClose }) {
  const { joinGroup } = useGroupStore();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const group = await joinGroup(code.trim().toUpperCase());
      toast.success(`¡Te has unido a ${group.name}!`);
      onClose();
      navigate(`/groups/${group.id}`);
    } catch (err) {
      toast.error(err.message || 'Código inválido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Unirse a un grupo">
      <form onSubmit={handleSubmit}>
        <p style={{ marginBottom: 'var(--space-5)' }}>
          Introduce el código de invitación que te ha enviado un miembro del grupo.
        </p>
        <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
          <label className="form-label">Código de invitación</label>
          <input
            className="form-input"
            placeholder="Ej: ABC123"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '1.2rem', textAlign: 'center' }}
            autoFocus
          />
        </div>
        <button className="btn btn-primary w-full" type="submit" disabled={loading || code.length < 4}>
          {loading ? <Spinner size={16} /> : 'Unirse'}
        </button>
      </form>
    </Modal>
  );
}

export function GroupsPage() {
  const { groups, fetchGroups, loading } = useGroupStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifState, setNotifState] = useState(Notification?.permission || 'default');

  useEffect(() => {
    fetchGroups().catch(err => toast.error(err.message));
  }, []);

  const handleEnableNotifications = async () => {
    const ok = await requestNotificationPermission();
    setNotifState(Notification.permission);
    if (ok) toast.success('¡Notificaciones activadas!');
    else toast.error('No se pudieron activar las notificaciones');
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <span className="gradient-text">Ayni</span>
          </h1>
          <p style={{ fontSize: '0.9rem', marginTop: 2 }}>Hola, {user?.name?.split(' ')[0]} 👋</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', position: 'relative' }}>
          <ThemeToggle />
          <button className="btn btn-ghost btn-icon" onClick={() => setShowMenu(!showMenu)}>
            <Avatar user={user} size="sm" />
          </button>
          {showMenu && (
            <div style={{
              position: 'absolute', top: '110%', right: 0,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              minWidth: 190,
              zIndex: 100,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-md)',
            }}>
              <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user?.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.email}</div>
              </div>
              <button
                onClick={() => { setShowProfile(true); setShowMenu(false); }}
                style={{ width: '100%', padding: 'var(--space-3) var(--space-4)', textAlign: 'left', color: 'var(--primary-light)', fontSize: '0.9rem', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                👤 Mi perfil y foto
              </button>
              <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <ThemeToggle showLabel style={{ width: '100%', padding: 'var(--space-3) var(--space-4)', border: 'none', background: 'none', color: 'var(--text-primary)', borderRadius: 0 }} />
              </div>
              {notifState !== 'granted' && (
                <button
                  onClick={() => { handleEnableNotifications(); setShowMenu(false); }}
                  style={{ width: '100%', padding: 'var(--space-3) var(--space-4)', textAlign: 'left', color: 'var(--accent-orange)', fontSize: '0.9rem', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  🔔 Activar notificaciones
                </button>
              )}
              <button
                onClick={() => { logout(); setShowMenu(false); }}
                style={{ width: '100%', padding: 'var(--space-3) var(--space-4)', textAlign: 'left', color: 'var(--accent-red)', fontSize: '0.9rem', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                🚪 Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notifications banner */}
      {notifState === 'default' && (
        <div
          className="glass-card"
          style={{
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-5)',
            background: 'rgba(108, 99, 255, 0.08)',
            border: '1px solid rgba(108, 99, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Activa las notificaciones</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Para saber de gastos nuevos y tareas pendientes
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleEnableNotifications}>
            Activar
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowCreate(true)}>
          + Crear grupo
        </button>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowJoin(true)}>
          🔗 Unirse
        </button>
      </div>

      {/* Groups list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
          <Spinner size={32} />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="🏠"
          title="Sin grupos aún"
          description="Crea un grupo para empezar a compartir gastos, notas y tareas"
          action={
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Crear primer grupo
            </button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {groups.map(group => (
            <button
              key={group.id}
              className="card card-clickable"
              style={{ textAlign: 'left', width: '100%' }}
              onClick={() => navigate(`/groups/${group.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <GroupAvatar group={group} size="md" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }} className="truncate">{group.name}</div>
                  {group.description && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }} className="truncate">
                      {group.description}
                    </div>
                  )}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    👥 {group.member_count} miembro{group.member_count !== 1 ? 's' : ''} · {group.role === 'admin' ? 'Admin' : 'Miembro'}
                  </div>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <CreateGroupModal open={showCreate} onClose={() => setShowCreate(false)} />
      <JoinGroupModal open={showJoin} onClose={() => setShowJoin(false)} />
      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}
