import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTaskStore, useGroupStore, useAuthStore, useToastStore } from '../store';
import { EmptyState, Spinner, Modal, ConfirmModal, formatDate, Avatar } from '../components/common';
import { ThemeToggle } from '../components/ThemeToggle';

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', icon: '⏳', color: 'var(--text-muted)' },
  in_progress: { label: 'En progreso', icon: '🔵', color: 'var(--accent-blue)' },
  done: { label: 'Hecho', icon: '✅', color: 'var(--accent-green)' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Baja', icon: '🟢', color: 'var(--accent-green)' },
  medium: { label: 'Media', icon: '🟡', color: 'var(--accent-orange)' },
  high: { label: 'Alta', icon: '🔴', color: 'var(--accent-red)' },
};

function TaskModal({ open, onClose, task, groupId, members, currentUser }) {
  const { createTask, updateTask } = useTaskStore();
  const toast = useToastStore();
  const isEdit = !!task;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'pending',
    priority: task?.priority || 'medium',
    assigned_to: task?.assigned_to || currentUser?.id || '',
    due_date: task?.due_date ? task.due_date.split('T')[0] : '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const data = {
        ...form,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to || null,
      };
      if (isEdit) {
        await updateTask(groupId, task.id, data);
        toast.success('Tarea actualizada');
      } else {
        await createTask(groupId, data);
        toast.success('Tarea creada');
      }
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar tarea' : 'Nueva tarea'}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Tarea *</label>
            <input
              className="form-input"
              placeholder="¿Qué hay que hacer?"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea
              className="form-textarea"
              placeholder="Añade más detalles..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ minHeight: 80 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div className="form-group">
              <label className="form-label">Prioridad</label>
              <select
                className="form-select"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              >
                {Object.entries(PRIORITY_CONFIG).map(([key, val]) => (
                  <option key={key} value={key}>{val.icon} {val.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Estado</label>
              <select
                className="form-select"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                  <option key={key} value={key}>{val.icon} {val.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Asignado a</label>
            <select
              className="form-select"
              value={form.assigned_to}
              onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
            >
              <option value="">Sin asignar</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}{m.user_id === currentUser?.id ? ' (tú)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Fecha límite</label>
            <input
              className="form-input"
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading || !form.title.trim()}>
            {loading ? <Spinner size={16} /> : isEdit ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TaskCard({ task, groupId, members, currentUser, onEdit, onDelete }) {
  const { setStatus } = useTaskStore();
  const toast = useToastStore();
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const now = new Date();
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate && dueDate < now && task.status !== 'done';
  const isDueToday = dueDate && dueDate.toDateString() === now.toDateString() && task.status !== 'done';

  const assignee = members.find(m => m.user_id === task.assigned_to);
  const statusConfig = STATUS_CONFIG[task.status];
  const priorityConfig = PRIORITY_CONFIG[task.priority];

  const cycleStatus = async () => {
    const next = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'pending';
    try {
      await setStatus(groupId, task.id, next);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(task.id);
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  return (
    <>
      <div
        className="card"
        style={{
          opacity: task.status === 'done' ? 0.6 : 1,
          borderLeft: `3px solid ${priorityConfig.color}`,
          ...(isOverdue ? { background: 'rgba(255,107,107,0.05)', borderColor: 'var(--accent-red)' } : {}),
          ...(isDueToday ? { background: 'rgba(255,169,77,0.05)', borderLeftColor: 'var(--accent-orange)' } : {}),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          {/* Status toggle */}
          <button
            onClick={cycleStatus}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: `2px solid ${statusConfig.color === 'var(--text-muted)' ? 'var(--border)' : statusConfig.color}`,
              background: task.status === 'done' ? 'var(--accent-green)' : 'transparent',
              cursor: 'pointer', flexShrink: 0, marginTop: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all var(--transition-fast)',
              fontSize: '0.8rem',
            }}
            title={`Estado: ${statusConfig.label}. Click para cambiar`}
          >
            {task.status === 'done' ? '✓' : task.status === 'in_progress' ? '▶' : ''}
          </button>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 600, fontSize: '0.95rem',
              textDecoration: task.status === 'done' ? 'line-through' : 'none',
              color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)',
            }}>
              {task.title}
            </div>

            {task.description && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }} className="truncate">
                {task.description}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 'var(--space-2)' }}>
              {/* Priority */}
              <span style={{ fontSize: '0.75rem', color: priorityConfig.color }}>
                {priorityConfig.icon} {priorityConfig.label}
              </span>

              {/* Assignee */}
              {assignee && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Avatar user={{ name: assignee.name, avatar_url: assignee.avatar_url }} size="sm" />
                  {assignee.user_id === currentUser?.id ? 'Tú' : assignee.name}
                </span>
              )}

              {/* Due date */}
              {dueDate && (
                <span style={{
                  fontSize: '0.75rem',
                  color: isOverdue ? 'var(--accent-red)' : isDueToday ? 'var(--accent-orange)' : 'var(--text-muted)',
                  fontWeight: isOverdue || isDueToday ? 600 : 400,
                }}>
                  📅 {isOverdue ? `¡Vencida! ${formatDate(task.due_date)}` : isDueToday ? '¡Hoy!' : formatDate(task.due_date)}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => onEdit(task)} style={{ width: 28, height: 28 }}>
              ✏️
            </button>
            <button className="btn btn-ghost btn-icon" onClick={() => setShowDelete(true)} style={{ width: 28, height: 28, color: 'var(--accent-red)' }}>
              🗑️
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar tarea"
        message={`¿Eliminar la tarea "${task.title}"?`}
      />
    </>
  );
}

export function TasksPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { tasks, fetchTasks, deleteTask, loading } = useTaskStore();
  const { members, fetchGroup, currentGroup } = useGroupStore();
  const { user } = useAuthStore();
  const toast = useToastStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');

  useEffect(() => {
    Promise.all([
      fetchTasks(groupId),
      !currentGroup ? fetchGroup(groupId) : Promise.resolve(),
    ]).catch(err => toast.error(err.message));
  }, [groupId]);

  const handleDelete = async (taskId) => {
    try {
      await deleteTask(groupId, taskId);
      toast.success('Tarea eliminada');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterAssignee === 'mine' && t.assigned_to !== user?.id) return false;
    if (filterAssignee === 'unassigned' && t.assigned_to) return false;
    return true;
  });

  // Group by status for summary
  const counts = { pending: 0, in_progress: 0, done: 0 };
  tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(`/groups/${groupId}`)}>‹</button>
        <h2 style={{ flex: 1 }}>✅ Tareas</h2>
        <ThemeToggle />
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Nueva</button>
      </div>

      {/* Stats */}
      {tasks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div
              key={key}
              className="glass-card"
              style={{
                padding: 'var(--space-3)',
                textAlign: 'center',
                cursor: 'pointer',
                background: filterStatus === key ? 'rgba(108,99,255,0.1)' : undefined,
                borderColor: filterStatus === key ? 'rgba(108,99,255,0.4)' : undefined,
              }}
              onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
            >
              <div style={{ fontSize: '1.2rem' }}>{cfg.icon}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: cfg.color }}>{counts[key] || 0}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{cfg.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'Todas' },
          { key: 'mine', label: '👤 Mías' },
          { key: 'unassigned', label: 'Sin asignar' },
        ].map(f => (
          <button
            key={f.key}
            className={`chip ${filterAssignee === f.key ? 'active' : ''}`}
            onClick={() => setFilterAssignee(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}><Spinner size={32} /></div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon="✅"
          title={tasks.length === 0 ? 'Sin tareas aún' : 'Sin resultados'}
          description={tasks.length === 0 ? 'Crea tareas y asígnalas a los miembros del grupo' : 'Prueba a cambiar los filtros'}
          action={tasks.length === 0 ? (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Crear primera tarea</button>
          ) : null}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Overdue first */}
          {filteredTasks
            .filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
            .length > 0 && (
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-red)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              ⚠️ Vencidas
            </div>
          )}
          {filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              groupId={groupId}
              members={members}
              currentUser={user}
              onEdit={setEditTask}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <TaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        groupId={groupId}
        members={members}
        currentUser={user}
      />
      <TaskModal
        open={!!editTask}
        onClose={() => setEditTask(null)}
        task={editTask}
        groupId={groupId}
        members={members}
        currentUser={user}
      />
    </div>
  );
}
