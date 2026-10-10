import { useState } from 'react';
import { useToastStore } from '../store';

export function Toast() {
  const toasts = useToastStore(s => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {toast.type === 'success' && '✓ '}
          {toast.type === 'error' && '✕ '}
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export function Spinner({ size = 20 }) {
  return (
    <div
      className="spinner"
      style={{ width: size, height: size }}
    />
  );
}

export function PageLoading() {
  return (
    <div className="page-loading">
      <div style={{ fontSize: '2rem' }}>🏠</div>
      <Spinner size={32} />
    </div>
  );
}

export function Avatar({ user, size = 'default', className = '' }) {
  const [hasError, setHasError] = useState(false);
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const sizeClass = size === 'sm' ? 'avatar-sm' : size === 'lg' ? 'avatar-lg' : size === 'xl' ? 'avatar-xl' : '';

  if (user?.avatar_url && !hasError) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name}
        className={`avatar ${sizeClass} ${className}`}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className={`avatar ${sizeClass} ${className}`} title={user?.name}>
      {initials}
    </div>
  );
}

export function GroupAvatar({ group, size = 'md', className = '', style = {} }) {
  const [hasError, setHasError] = useState(false);
  const sizeMap = {
    sm: { size: 36, fontSize: '1.2rem', radius: 'var(--radius-sm)' },
    md: { size: 52, fontSize: '1.6rem', radius: 'var(--radius-md)' },
    lg: { size: 68, fontSize: '2rem', radius: 'var(--radius-lg)' },
    xl: { size: 88, fontSize: '2.5rem', radius: 'var(--radius-xl)' },
  };
  const { size: dim, fontSize, radius } = sizeMap[size] || sizeMap.md;

  if (group?.image_url && !hasError) {
    return (
      <img
        src={group.image_url}
        alt={group.name}
        className={`group-avatar ${className}`}
        onError={() => setHasError(true)}
        style={{
          width: dim,
          height: dim,
          borderRadius: radius,
          objectFit: 'cover',
          border: '1px solid var(--border)',
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  return (
    <div
      className={`group-avatar ${className}`}
      style={{
        width: dim,
        height: dim,
        borderRadius: radius,
        background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-hover))',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        flexShrink: 0,
        ...style,
      }}
    >
      {group?.emoji || '🏠'}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-slide-up">
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)' }}>
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'Eliminar', loading }) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p style={{ marginBottom: 'var(--space-6)' }}>{message}</p>
      <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
          Cancelar
        </button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? <Spinner size={16} /> : confirmText}
        </button>
      </div>
    </Modal>
  );
}

export function formatCurrency(amount, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / 86400000);

  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins}m`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 7) return `Hace ${days}d`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
