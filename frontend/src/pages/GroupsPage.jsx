import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupStore, useAuthStore, useToastStore } from '../store';
import { Avatar, GroupAvatar, EmptyState, Modal, Spinner, ConfirmModal, formatCurrency, formatDate, formatRelativeTime } from '../components/common';
import { ImagePicker } from '../components/ImagePicker';
import { ProfileModal } from '../components/ProfileModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { requestNotificationPermission } from '../hooks/useNotifications';
import { api } from '../api/client';

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
  const { groups, overview, overviewLoading, fetchOverview } = useGroupStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToastStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDebtsDetail, setShowDebtsDetail] = useState(false);
  const [notifState, setNotifState] = useState(Notification?.permission || 'default');

  useEffect(() => {
    fetchOverview().catch(err => toast.error(err.message));
  }, []);

  const handleEnableNotifications = async () => {
    const ok = await requestNotificationPermission();
    setNotifState(Notification.permission);
    if (ok) toast.success('¡Notificaciones activadas!');
    else toast.error('No se pudieron activar las notificaciones');
  };

  const handleTaskToggle = async (task) => {
    const nextStatus = task.status === 'done' ? 'pending' : 'done';
    try {
      await api.tasks.setStatus(task.group_id, task.id, nextStatus);
      toast.success(nextStatus === 'done' ? '¡Tarea completada! 🎉' : 'Tarea reactivada');
      fetchOverview();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const summary = overview?.summary || {
    total_owed_to_me: 0,
    total_i_owe: 0,
    net_balance: 0,
    debts_owed_to_me: [],
    debts_i_owe: [],
  };

  const tasks = overview?.tasks || [];
  const notes = overview?.notes || [];
  const displayGroups = overview?.groups || groups || [];

  const hasDebts = (summary.debts_owed_to_me?.length > 0) || (summary.debts_i_owe?.length > 0);

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 className="page-title">
            <span className="gradient-text">Ayni</span>
          </h1>
          <p style={{ fontSize: '0.9rem', marginTop: 2, color: 'var(--text-secondary)' }}>
            Hola, {user?.name?.split(' ')[0]} 👋
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', position: 'relative' }}>
          <ThemeToggle />
          <button className="btn btn-ghost btn-icon" onClick={() => setShowMenu(!showMenu)} aria-label="Menú de perfil">
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
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{user?.name}</div>
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

      {/* Notifications prompt banner */}
      {notifState === 'default' && (
        <div
          className="glass-card"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            background: 'rgba(108, 99, 255, 0.08)',
            border: '1px solid rgba(108, 99, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Activa las notificaciones</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Avisos de gastos, deudas y tareas
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleEnableNotifications}>
            Activar
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowCreate(true)}>
          + Crear grupo
        </button>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowJoin(true)}>
          🔗 Unirse
        </button>
      </div>

      {overviewLoading && !overview ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
          <Spinner size={32} />
        </div>
      ) : displayGroups.length === 0 ? (
        <EmptyState
          icon="🏠"
          title="Sin grupos aún"
          description="Crea un grupo para empezar a compartir gastos, notas y tareas con tus compañeros"
          action={
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Crear primer grupo
            </button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          
          {/* 1. RESUMEN GLOBAL DE CUENTAS / DINERO */}
          <div
            className="card"
            style={{
              padding: 'var(--space-5)',
              background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-elevated))',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: '1.2rem' }}>💰</span>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  Balance general
                </span>
              </div>
              <span
                className={`badge ${
                  summary.net_balance > 0.01 ? 'badge-success' : summary.net_balance < -0.01 ? 'badge-danger' : 'badge-neutral'
                }`}
                style={{ fontSize: '0.8rem', padding: '4px 10px', fontWeight: 700 }}
              >
                {summary.net_balance > 0.01 ? `+${formatCurrency(summary.net_balance)}` : formatCurrency(summary.net_balance)} neto
              </span>
            </div>

            {/* Dos métricas destacadas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div style={{
                background: 'rgba(67, 233, 123, 0.08)',
                border: '1px solid rgba(67, 233, 123, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Te deben en total
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-green)', marginTop: 2 }}>
                  {formatCurrency(summary.total_owed_to_me)}
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 107, 107, 0.08)',
                border: '1px solid rgba(255, 107, 107, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Debes en total
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-red)', marginTop: 2 }}>
                  {formatCurrency(summary.total_i_owe)}
                </div>
              </div>
            </div>

            {/* Desglose de deudas o mensaje de paz */}
            {hasDebts ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowDebtsDetail(!showDebtsDetail)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: 'var(--space-2) 0', color: 'var(--primary-light)',
                    fontSize: '0.82rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <span>
                    {showDebtsDetail ? 'Ocultar desglose detallado' : `Ver desglose (${(summary.debts_owed_to_me?.length || 0) + (summary.debts_i_owe?.length || 0)} deudas activas)`}
                  </span>
                  <span>{showDebtsDetail ? '▲' : '▼'}</span>
                </button>

                {showDebtsDetail && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    {/* Quién me debe */}
                    {summary.debts_owed_to_me?.map((d, idx) => (
                      <div
                        key={`owed-${idx}`}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: 'var(--bg-surface)', padding: 'var(--space-2) var(--space-3)',
                          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <Avatar user={d.from_user} size="sm" />
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.from_user.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 6 }}>en {d.group_name}</span>
                          </div>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                          +{formatCurrency(d.amount, d.currency)}
                        </span>
                      </div>
                    ))}

                    {/* A quién debo */}
                    {summary.debts_i_owe?.map((d, idx) => (
                      <div
                        key={`owe-${idx}`}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: 'var(--bg-surface)', padding: 'var(--space-2) var(--space-3)',
                          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <Avatar user={d.to_user} size="sm" />
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Debes a {d.to_user.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 6 }}>en {d.group_name}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent-red)' }}>
                            -{formatCurrency(d.amount, d.currency)}
                          </span>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            onClick={() => navigate(`/groups/${d.group_id}/expenses`)}
                          >
                            Pagar ›
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', paddingTop: 'var(--space-2)' }}>
                ✨ ¡Todas las cuentas están al día en todos tus grupos!
              </div>
            )}
          </div>

          {/* 2. TAREAS POR HACER */}
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: '1.2rem' }}>📋</span>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  Tareas por hacer
                </span>
              </div>
              <span className={`badge ${tasks.length > 0 ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: '0.78rem' }}>
                {tasks.length} {tasks.length === 1 ? 'pendiente' : 'pendientes'}
              </span>
            </div>

            {tasks.length === 0 ? (
              <div style={{
                background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem',
              }}>
                🎉 ¡Estás al día! No tienes tareas pendientes asignadas.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {tasks.map(task => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                  return (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                        padding: 'var(--space-3)', background: 'var(--bg-surface)',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                        transition: 'background var(--transition-fast)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={task.status === 'done'}
                        onChange={() => handleTaskToggle(task)}
                        style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
                        title="Marcar como completada"
                      />
                      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/groups/${task.group_id}/tasks`)}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }} className="truncate">
                          {task.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--primary-light)', fontWeight: 600 }}>
                            {task.group_emoji || '🏠'} {task.group_name}
                          </span>
                          {task.due_date && (
                            <span style={{
                              fontSize: '0.72rem',
                              color: isOverdue ? 'var(--accent-red)' : 'var(--text-muted)',
                              fontWeight: isOverdue ? 700 : 500,
                            }}>
                              {isOverdue ? '⚠️ Vencida: ' : '📅 '} {formatDate(task.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`badge ${
                        task.priority === 'high' ? 'badge-danger' : task.priority === 'medium' ? 'badge-warning' : 'badge-neutral'
                      }`} style={{ fontSize: '0.7rem' }}>
                        {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. ÚLTIMAS NOTAS Y LISTAS DE LA COMPRA */}
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: '1.2rem' }}>📝</span>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  Últimas notas y listas
                </span>
              </div>
              <span className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>
                {notes.length} reciente{notes.length !== 1 ? 's' : ''}
              </span>
            </div>

            {notes.length === 0 ? (
              <div style={{
                background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem',
              }}>
                No hay notas compartidas aún en tus grupos.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {notes.map(note => {
                  const isChecklist = note.content && (note.content.includes('- [ ]') || note.content.includes('- [x]'));
                  const checklistLines = (note.content || '').split('\n').filter(l => l.trimStart().startsWith('- ['));
                  const completedCount = checklistLines.filter(l => l.trimStart().startsWith('- [x]') || l.trimStart().startsWith('- [X]')).length;

                  return (
                    <div
                      key={note.id}
                      className="card-clickable"
                      onClick={() => navigate(`/groups/${note.group_id}/notes`)}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }} className="truncate">
                          {note.pinned ? '📌 ' : ''}{note.title || 'Nota sin título'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {formatRelativeTime(note.updated_at)}
                        </span>
                      </div>

                      {isChecklist ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>🛒 {completedCount} de {checklistLines.length} elementos completados</span>
                        </div>
                      ) : (
                        <div style={{
                          fontSize: '0.8rem', color: 'var(--text-secondary)',
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        }}>
                          {note.content || 'Sin contenido'}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--primary-light)', fontWeight: 600 }}>
                          {note.group_emoji || '🏠'} {note.group_name}
                        </span>
                        {note.creator_name && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            por {note.creator_name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. TUS GRUPOS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: '1.2rem' }}>🏠</span>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  Tus grupos ({displayGroups.length})
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {displayGroups.map(group => (
                <div
                  key={group.id}
                  className="card card-clickable"
                  style={{ textAlign: 'left', width: '100%', color: 'var(--text-primary)', cursor: 'pointer' }}
                  onClick={() => navigate(`/groups/${group.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/groups/${group.id}`); }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <GroupAvatar group={group} size="md" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }} className="truncate">
                        {group.name}
                      </div>
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
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      <CreateGroupModal open={showCreate} onClose={() => { setShowCreate(false); fetchOverview(); }} />
      <JoinGroupModal open={showJoin} onClose={() => { setShowJoin(false); fetchOverview(); }} />
      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}
