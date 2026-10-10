import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroupStore, useAuthStore, useToastStore, useExpenseStore, useNoteStore, useTaskStore } from '../store';
import { Avatar, GroupAvatar, Spinner, EmptyState, Modal, ConfirmModal, formatCurrency, formatDate, formatRelativeTime } from '../components/common';
import { EditGroupModal } from '../components/EditGroupModal';
import { ThemeToggle } from '../components/ThemeToggle';

const CATEGORY_COLORS = {
  general: '#6c63ff',
  food: '#ff6b6b',
  transport: '#4dabf7',
  housing: '#43e97b',
  entertainment: '#f783ac',
  health: '#20c997',
  shopping: '#ffa94d',
  utilities: '#ffd43b',
  travel: '#a78bfa',
};

const CATEGORY_LABELS = {
  general: '🛍️ General',
  food: '🍕 Comida',
  transport: '🚗 Transporte',
  housing: '🏠 Hogar',
  entertainment: '🎉 Ocio',
  health: '💊 Salud',
  shopping: '🛒 Compras',
  utilities: '💡 Servicios',
  travel: '✈️ Viajes',
};

export function GroupPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { fetchGroup, currentGroup: group, members, myRole, deleteGroup, regenerateInvite } = useGroupStore();
  const { expenses, debts, fetchExpenses } = useExpenseStore();
  const { notes, fetchNotes } = useNoteStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { user } = useAuthStore();
  const toast = useToastStore();

  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [emailInvite, setEmailInvite] = useState('');
  const [inviting, setInviting] = useState(false);
  const { inviteByEmail } = useGroupStore();

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchGroup(groupId),
      fetchExpenses(groupId),
      fetchNotes(groupId),
      fetchTasks(groupId),
    ])
      .then(([groupRes]) => {
        if (groupRes.status === 'rejected') {
          toast.error(groupRes.reason?.message || 'Error al cargar el grupo');
          navigate('/');
        }
      })
      .finally(() => setLoading(false));
  }, [groupId]);

  const handleCopyCode = async () => {
    if (!group) return;
    const inviteLink = `${window.location.origin}?join=${group.invite_code}`;
    await navigator.clipboard.writeText(inviteLink);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleInviteEmail = async (e) => {
    e.preventDefault();
    if (!emailInvite.trim()) return;
    setInviting(true);
    try {
      await inviteByEmail(groupId, emailInvite);
      toast.success('Persona añadida al grupo');
      setEmailInvite('');
      setShowInvite(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setInviting(false);
    }
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

  // ---- 1. GASTOS DATA & STATS ----
  const now = new Date();
  const currentMonthExpenses = expenses.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyTotal = currentMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalAllTime = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Categories chart
  const chartExpenses = currentMonthExpenses.length > 0 ? currentMonthExpenses : expenses;
  const categoryMap = {};
  chartExpenses.forEach(e => {
    const cat = e.category || 'general';
    categoryMap[cat] = (categoryMap[cat] || 0) + (e.amount || 0);
  });
  const chartTotal = Object.values(categoryMap).reduce((a, b) => a + b, 0);
  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // ---- 2. NOTAS DATA ----
  const latestNote = notes.length > 0 ? notes[0] : null;
  const noteLines = latestNote?.content ? latestNote.content.split('\n') : [];
  const checklistLines = noteLines.filter(l => l.trimStart().startsWith('- [ ]') || l.trimStart().startsWith('- [x]') || l.trimStart().startsWith('- [X]'));
  const isChecklist = checklistLines.length > 0;
  const completedChecklist = checklistLines.filter(l => l.trimStart().startsWith('- [x]') || l.trimStart().startsWith('- [X]')).length;

  // ---- 3. TAREAS DATA ----
  const pendingTasks = tasks.filter(t => t.status !== 'done');
  const previewTasks = [...pendingTasks]
    .sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
    })
    .slice(0, 3);

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/')}>‹</button>
        <GroupAvatar group={group} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ marginBottom: 2 }} className="truncate">{group.name}</h2>
          {group.description && (
            <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-secondary)' }} className="truncate">{group.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <ThemeToggle />
          {myRole === 'admin' && (
            <>
              <button className="btn btn-ghost btn-icon" title="Editar grupo y foto" onClick={() => setShowEdit(true)}>⚙️</button>
              <button className="btn btn-ghost btn-icon" title="Eliminar grupo" onClick={() => setShowDelete(true)}>🗑️</button>
            </>
          )}
        </div>
      </div>

      {/* DASHBOARD MODULE CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>

        {/* 1. GASTOS WIDGET */}
        <div
          className="card card-clickable"
          style={{ padding: 'var(--space-5)', cursor: 'pointer' }}
          onClick={() => navigate(`/groups/${groupId}/expenses`)}
        >
          {/* Card Title Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: 'rgba(67, 233, 123, 0.15)',
                border: '1px solid rgba(67, 233, 123, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem', flexShrink: 0,
              }}>
                💰
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--accent-green)' }}>Gastos</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Cuentas, balances y deudas</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="badge badge-success" style={{ fontSize: '0.8rem', padding: '3px 10px' }}>
                {formatCurrency(monthlyTotal, group.currency)} este mes
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '1.3rem' }}>›</span>
            </div>
          </div>

          {/* Monthly Total & Category Breakdown Chart */}
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-2)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Gasto mensual ({now.toLocaleDateString('es-ES', { month: 'long' })})
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                  {formatCurrency(monthlyTotal, group.currency)}
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                {chartExpenses.length} {chartExpenses.length === 1 ? 'gasto registrado' : 'gastos registrados'}
              </div>
            </div>

            {chartTotal > 0 ? (
              <div>
                {/* Horizontal Segmented Bar Chart */}
                <div style={{
                  height: 10,
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  overflow: 'hidden',
                  background: 'var(--border)',
                  marginBottom: 'var(--space-3)',
                  marginTop: 'var(--space-2)',
                }}>
                  {topCategories.map(([cat, amount]) => {
                    const pct = Math.max(4, Math.round((amount / chartTotal) * 100));
                    const color = CATEGORY_COLORS[cat] || 'var(--primary)';
                    return (
                      <div
                        key={cat}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: color,
                          transition: 'width var(--transition-base)',
                        }}
                        title={`${CATEGORY_LABELS[cat] || cat}: ${pct}% (${formatCurrency(amount, group.currency)})`}
                      />
                    );
                  })}
                </div>

                {/* Category Legend Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {topCategories.map(([cat, amount]) => {
                    const pct = Math.round((amount / chartTotal) * 100);
                    const color = CATEGORY_COLORS[cat] || 'var(--primary)';
                    return (
                      <div
                        key={cat}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: '0.75rem',
                          background: 'var(--bg-surface)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{CATEGORY_LABELS[cat] || cat}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: 'var(--space-2) 0' }}>
                Sin gastos registrados aún. Pulsa para añadir el primero.
              </div>
            )}
          </div>

          {/* Quién debe a quién (Debts Section) */}
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Quién debe a quién
            </div>

            {debts.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-green)', fontSize: '0.85rem', fontWeight: 500, padding: '4px 0' }}>
                <span>✓</span>
                <span>¡Cuentas saldadas! Nadie tiene deudas pendientes en el grupo.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {debts.slice(0, 3).map((debt, idx) => {
                  const isOwedByMe = debt.from.id === user?.id;
                  const isOwedToMe = debt.to.id === user?.id;

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                        padding: '4px 0',
                        borderBottom: idx < Math.min(debts.length, 3) - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                        <Avatar user={debt.from} size="sm" />
                        <span style={{ fontWeight: 600, color: isOwedByMe ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                          {isOwedByMe ? 'Tú' : debt.from.name.split(' ')[0]}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>debe a</span>
                        <Avatar user={debt.to} size="sm" />
                        <span style={{ fontWeight: 600, color: isOwedToMe ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                          {isOwedToMe ? 'ti' : debt.to.name.split(' ')[0]}
                        </span>
                      </div>
                      <span style={{
                        fontWeight: 700,
                        color: isOwedByMe ? 'var(--accent-red)' : isOwedToMe ? 'var(--accent-green)' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        marginLeft: 'var(--space-2)',
                      }}>
                        {formatCurrency(debt.amount, group.currency)}
                      </span>
                    </div>
                  );
                })}

                {debts.length > 3 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', marginTop: 2 }}>
                    + {debts.length - 3} deudas más pendientes
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. NOTAS WIDGET */}
        <div
          className="card card-clickable"
          style={{ padding: 'var(--space-5)', cursor: 'pointer' }}
          onClick={() => navigate(`/groups/${groupId}/notes`)}
        >
          {/* Card Title Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: 'rgba(77, 171, 247, 0.15)',
                border: '1px solid rgba(77, 171, 247, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem', flexShrink: 0,
              }}>
                📝
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--accent-blue)' }}>Notas</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Lista de la compra y apuntes</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="badge badge-info" style={{ fontSize: '0.8rem', padding: '3px 10px' }}>
                {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '1.3rem' }}>›</span>
            </div>
          </div>

          {latestNote ? (
            <div style={{
              background: (!latestNote.color || latestNote.color === '#1e1e2e') ? 'var(--bg-elevated)' : latestNote.color,
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              border: `1px solid ${latestNote.pinned ? 'var(--primary)' : 'var(--border)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {latestNote.pinned ? '📌 ' : ''}{latestNote.title || 'Última nota'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {formatRelativeTime(latestNote.updated_at)}
                </span>
              </div>

              {isChecklist ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8rem', color: 'var(--accent-blue)', marginBottom: 'var(--space-2)' }}>
                    <span>🛒 {completedChecklist} de {checklistLines.length} elementos completados</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {checklistLines.slice(0, 3).map((line, idx) => {
                      const isDone = line.trimStart().startsWith('- [x]') || line.trimStart().startsWith('- [X]');
                      const text = line.replace(/^\s*-\s+\[[ xX]\]\s*/, '');
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.82rem', color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
                          <span>{isDone ? '☑️' : '⬜'}</span>
                          <span className="truncate">{text}</span>
                        </div>
                      );
                    })}
                    {checklistLines.length > 3 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        + {checklistLines.length - 3} elementos más...
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {latestNote.content || 'Sin contenido adicional'}
                </div>
              )}

              <div style={{ marginTop: 'var(--space-3)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>✍️ {latestNote.creator_name ? `Por ${latestNote.creator_name}` : 'Nota compartida'}</span>
                <span style={{ color: 'var(--primary-light)', fontWeight: 600 }}>Toca para ver o editar ›</span>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
            }}>
              💡 No hay notas creadas aún. Pulsa aquí para hacer una lista de compras o apuntes.
            </div>
          )}
        </div>

        {/* 3. TAREAS WIDGET */}
        <div
          className="card card-clickable"
          style={{ padding: 'var(--space-5)', cursor: 'pointer' }}
          onClick={() => navigate(`/groups/${groupId}/tasks`)}
        >
          {/* Card Title Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: 'rgba(247, 131, 172, 0.15)',
                border: '1px solid rgba(247, 131, 172, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem', flexShrink: 0,
              }}>
                ✅
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--accent-pink)' }}>Tareas</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Responsables y pendientes</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className={`badge ${pendingTasks.length > 0 ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.8rem', padding: '3px 10px' }}>
                {pendingTasks.length > 0 ? `${pendingTasks.length} pendientes` : 'Todo al día ✓'}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '1.3rem' }}>›</span>
            </div>
          </div>

          {previewTasks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {previewTasks.map((t) => {
                const assignee = members.find(m => m.user_id === t.assigned_to);
                const isMine = assignee?.user_id === user?.id;
                const priorityColor = t.priority === 'high' ? 'var(--accent-red)' : t.priority === 'medium' ? 'var(--accent-orange)' : 'var(--accent-green)';
                const priorityLabel = t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Media' : 'Baja';

                return (
                  <div
                    key={t.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3) var(--space-4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderLeft: `3px solid ${priorityColor}`,
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }} className="truncate">
                        {t.status === 'in_progress' ? '🔵 ' : '⏳ '}{t.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 2, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span style={{ color: priorityColor, fontWeight: 600 }}>● {priorityLabel}</span>
                        {t.due_date && <span>📅 {formatDate(t.due_date)}</span>}
                      </div>
                    </div>

                    {/* Assigned Person */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {assignee ? (
                        <>
                          <Avatar user={{ name: assignee.name, avatar_url: assignee.avatar_url }} size="sm" />
                          <span style={{
                            fontSize: '0.8rem',
                            fontWeight: isMine ? 700 : 500,
                            color: isMine ? 'var(--primary-light)' : 'var(--text-secondary)',
                          }}>
                            {isMine ? 'Tú' : assignee.name.split(' ')[0]}
                          </span>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>👤 Sin asignar</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {pendingTasks.length > 3 && (
                <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: 2 }}>
                  + {pendingTasks.length - 3} tareas más pendientes
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
            }}>
              🎉 ¡No hay tareas pendientes! Todas las tareas del grupo están completadas.
            </div>
          )}
        </div>

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
              <Avatar user={{ name: member.name, avatar_url: member.avatar_url }} size="default" />
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
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Añadir al grupo">
        <div>
          <form onSubmit={handleInviteEmail} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            <input 
              type="email" 
              placeholder="Añadir por email..." 
              value={emailInvite} 
              onChange={e => setEmailInvite(e.target.value)}
              style={{ flex: 1, padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            />
            <button className="btn btn-primary" type="submit" disabled={inviting}>
              {inviting ? <Spinner size={16} /> : 'Añadir'}
            </button>
          </form>

          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)' }}>
              O comparte este código o enlace:
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
              <button className="btn btn-ghost" style={{ flex: 1, background: 'var(--bg-elevated)' }} onClick={handleCopyCode}>
                {copiedCode ? '✓ Copiado' : '📋 Copiar enlace'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit Group Modal */}
      <EditGroupModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        group={group}
      />

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
