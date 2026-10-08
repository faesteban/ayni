import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroupStore, useAuthStore, useToastStore } from '../store';
import { Avatar, Spinner, EmptyState, Modal, ConfirmModal } from '../components/common';

export function GroupPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { fetchGroup, currentGroup: group, members, myRole, deleteGroup, regenerateInvite } = useGroupStore();
  const { user } = useAuthStore();
  const toast = useToastStore();
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchGroup(groupId)
      .catch(err => { toast.error(err.message); navigate('/'); })
      .finally(() => setLoading(false));
  }, [groupId]);

  const handleCopyCode = async () => {
    if (!group) return;
    const inviteLink = `${window.location.origin}?join=${group.invite_code}`;
    await navigator.clipboard.writeText(inviteLink);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDelete = async () => {
    setDeletingGroup(true);
    try {
      await deleteGroup(groupId);
      toast.success('Grupo eliminado');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
      setDeletingGroup(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Spinner size={32} />
    </div>
  );

  if (!group) return null;

  const MODULES = [
    {
      icon: '💰',
      label: 'Gastos',
      desc: 'Divide y lleva la cuenta',
      color: '#43e97b',
      path: 'expenses',
    },
    {
      icon: '📝',
      label: 'Notas',
      desc: 'Ideas y apuntes del grupo',
      color: '#4dabf7',
      path: 'notes',
    },
    {
      icon: '✅',
      label: 'Tareas',
      desc: 'Quién hace qué y cuándo',
      color: '#f783ac',
      path: 'tasks',
    },
  ];

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/')}>‹</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ marginBottom: 2 }}>{group.emoji} {group.name}</h2>
          {group.description && (
            <p style={{ fontSize: '0.85rem', margin: 0 }}>{group.description}</p>
          )}
        </div>
        {myRole === 'admin' && (
          <button className="btn btn-ghost btn-icon" onClick={() => setShowDelete(true)}>🗑️</button>
        )}
      </div>

      {/* Module cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        {MODULES.map(mod => (
          <button
            key={mod.path}
            className="card card-clickable"
            style={{ textAlign: 'left' }}
            onClick={() => navigate(`/groups/${groupId}/${mod.path}`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div style={{
                width: 56, height: 56,
                borderRadius: 'var(--radius-md)',
                background: `linear-gradient(135deg, ${mod.color}22, ${mod.color}44)`,
                border: `1px solid ${mod.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.8rem', flexShrink: 0,
              }}>
                {mod.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: mod.color }}>{mod.label}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{mod.desc}</div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '1.4rem' }}>›</span>
            </div>
          </button>
        ))}
      </div>

      {/* Members section */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h3>Miembros ({members.length})</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowInvite(true)}>
            🔗 Invitar
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {members.map(member => (
            <div key={member.user_id} className="glass-card" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {member.avatar_url ? (
                <img src={member.avatar_url} alt={member.name} className="avatar" style={{ width: 36, height: 36, borderRadius: '50%' }} />
              ) : (
                <div className="avatar">{member.name?.[0]?.toUpperCase()}</div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {member.name}
                  {member.user_id === user?.id && ' (tú)'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{member.email}</div>
              </div>
              {member.role === 'admin' && (
                <span className="badge badge-primary">Admin</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invitar al grupo">
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 'var(--space-5)' }}>
            Comparte este código o enlace con quien quieras invitar:
          </p>

          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-5)',
            marginBottom: 'var(--space-5)',
          }}>
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              letterSpacing: '0.2em',
              color: 'var(--primary-light)',
              marginBottom: 'var(--space-2)',
            }}>
              {group.invite_code}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Código de invitación
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCopyCode}>
              {copiedCode ? '✓ Copiado' : '📋 Copiar enlace'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        loading={deletingGroup}
        title="Eliminar grupo"
        message={`¿Seguro que quieres eliminar "${group.name}"? Se borrarán todos los gastos, notas y tareas permanentemente.`}
        confirmText="Eliminar grupo"
      />
    </div>
  );
}
