import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExpenseStore, useGroupStore, useAuthStore, useToastStore } from '../store';
import { Avatar, EmptyState, Modal, ConfirmModal, Spinner, formatCurrency, formatDate } from '../components/common';
import { ThemeToggle } from '../components/ThemeToggle';

const CATEGORIES = [
  { value: 'general', label: '🛍️ General' },
  { value: 'food', label: '🍕 Comida' },
  { value: 'transport', label: '🚗 Transporte' },
  { value: 'housing', label: '🏠 Alojamiento' },
  { value: 'entertainment', label: '🎉 Ocio' },
  { value: 'health', label: '💊 Salud' },
  { value: 'shopping', label: '🛒 Compras' },
  { value: 'utilities', label: '💡 Servicios' },
  { value: 'travel', label: '✈️ Viaje' },
  { value: 'other', label: '📦 Otro' },
];

function AddExpenseModal({ open, onClose, groupId, members, currentUser }) {
  const { addExpense } = useExpenseStore();
  const toast = useToastStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    amount: '',
    paid_by: currentUser?.id || '',
    category: 'general',
    notes: '',
    is_recurring: false,
    recurring_period: 'monthly',
    split_equally: true,
    split_with: members.map(m => m.user_id),
  });

  // Reset paid_by when currentUser loads
  useEffect(() => {
    if (currentUser?.id && !form.paid_by) {
      setForm(f => ({ ...f, paid_by: currentUser.id, split_with: members.map(m => m.user_id) }));
    }
  }, [currentUser?.id]);

  const toggleMember = (userId) => {
    setForm(f => ({
      ...f,
      split_with: f.split_with.includes(userId)
        ? f.split_with.filter(id => id !== userId)
        : [...f.split_with, userId],
    }));
  };

  const perPersonAmount = form.amount && form.split_with.length > 0
    ? (parseFloat(form.amount) / form.split_with.length).toFixed(2)
    : '0.00';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.amount) return;
    setLoading(true);
    try {
      await addExpense(groupId, {
        ...form,
        amount: parseFloat(form.amount),
        notes: form.notes || undefined,
      });
      toast.success('Gasto añadido');
      onClose();
      setForm({
        title: '', amount: '', paid_by: currentUser?.id || '',
        category: 'general', notes: '',
        is_recurring: false, recurring_period: 'monthly',
        split_equally: true, split_with: members.map(m => m.user_id),
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Añadir gasto">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Title */}
          <div className="form-group">
            <label className="form-label">Concepto *</label>
            <input
              className="form-input"
              placeholder="Ej: Cena restaurante, Gasolina..."
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required autoFocus
            />
          </div>

          {/* Amount */}
          <div className="form-group">
            <label className="form-label">Cantidad *</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                required
                style={{ paddingRight: 40 }}
              />
              <span style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)',
              }}>€</span>
            </div>
          </div>

          {/* Category */}
          <div className="form-group">
            <label className="form-label">Categoría</label>
            <select
              className="form-select"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Paid by */}
          <div className="form-group">
            <label className="form-label">Pagado por</label>
            <select
              className="form-select"
              value={form.paid_by}
              onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}
            >
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}{m.user_id === currentUser?.id ? ' (tú)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Split with */}
          <div className="form-group">
            <label className="form-label">Dividir entre</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {members.map(m => (
                <label key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.split_with.includes(m.user_id)}
                    onChange={() => toggleMember(m.user_id)}
                    style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                  />
                  <span>{m.name}{m.user_id === currentUser?.id ? ' (tú)' : ''}</span>
                </label>
              ))}
            </div>
            {form.amount && form.split_with.length > 0 && (
              <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--accent-green)' }}>
                💡 {form.split_with.length} persona{form.split_with.length > 1 ? 's' : ''} · {perPersonAmount}€ cada una
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notas (opcional)</label>
            <textarea
              className="form-textarea"
              placeholder="Añade detalles del gasto..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ minHeight: 70 }}
            />
          </div>

          {/* Recurring */}
          <div className="glass-card" style={{ padding: 'var(--space-4)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', marginBottom: form.is_recurring ? 'var(--space-3)' : 0 }}>
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))}
                style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>🔄 Gasto recurrente</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Recibirás recordatorios automáticos</div>
              </div>
            </label>
            {form.is_recurring && (
              <select
                className="form-select"
                value={form.recurring_period}
                onChange={e => setForm(f => ({ ...f, recurring_period: e.target.value }))}
              >
                <option value="weekly">Cada semana</option>
                <option value="monthly">Cada mes</option>
                <option value="yearly">Cada año</option>
              </select>
            )}
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !form.title.trim() || !form.amount || form.split_with.length === 0}
          >
            {loading ? <Spinner size={16} /> : 'Añadir gasto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RegisterPaymentModal({ open, onClose, groupId, debts, members, currentUser }) {
  const { registerPayment } = useExpenseStore();
  const toast = useToastStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ to_user: '', amount: '', note: '' });

  const myDebts = debts.filter(d => d.from.id === currentUser?.id);

  useEffect(() => {
    if (myDebts.length > 0 && !form.to_user) {
      setForm(f => ({ ...f, to_user: myDebts[0].to.id, amount: String(myDebts[0].amount) }));
    }
  }, [debts, currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerPayment(groupId, { ...form, amount: parseFloat(form.amount) });
      toast.success('Pago registrado');
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar pago">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {myDebts.length > 0 && (
            <div style={{ background: 'rgba(67,233,123,0.08)', border: '1px solid rgba(67,233,123,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--accent-green)', fontWeight: 600 }}>Tus deudas pendientes:</div>
              {myDebts.map((d, i) => (
                <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Debes {formatCurrency(d.amount)} a {d.to.name}
                </div>
              ))}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Pagar a</label>
            <select className="form-select" value={form.to_user} onChange={e => setForm(f => ({ ...f, to_user: e.target.value }))}>
              <option value="">Seleccionar persona</option>
              {members.filter(m => m.user_id !== currentUser?.id).map(m => (
                <option key={m.user_id} value={m.user_id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Cantidad</label>
            <input
              className="form-input"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nota (opcional)</label>
            <input
              className="form-input"
              placeholder="Ej: Transferencia del lunes"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading || !form.to_user || !form.amount}>
            {loading ? <Spinner size={16} /> : 'Registrar pago'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ExpensesPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { expenses, balances, debts, payments, fetchExpenses, deleteExpense, loading } = useExpenseStore();
  const { currentGroup: group, members, fetchGroup } = useGroupStore();
  const { user } = useAuthStore();
  const toast = useToastStore();
  const [activeTab, setActiveTab] = useState('expenses');
  const [showAdd, setShowAdd] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedExpense, setExpandedExpense] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchExpenses(groupId),
      !group ? fetchGroup(groupId) : Promise.resolve(),
    ]).catch(err => toast.error(err.message));
  }, [groupId]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteExpense(groupId, deleteTarget.id);
      toast.success('Gasto eliminado');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const myBalance = balances.find(b => b.user.id === user?.id);
  const myDebts = debts.filter(d => d.from.id === user?.id);
  const owedToMe = debts.filter(d => d.to.id === user?.id);

  const getCategoryLabel = (cat) => CATEGORIES.find(c => c.value === cat)?.label || cat;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(`/groups/${groupId}`)}>‹</button>
        <h2 style={{ flex: 1 }}>💰 Gastos</h2>
        <ThemeToggle />
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Añadir</button>
      </div>

      {/* Balance summary */}
      {myBalance && (
        <div className="glass-card" style={{
          padding: 'var(--space-5)',
          marginBottom: 'var(--space-5)',
          background: myBalance.balance >= 0
            ? 'rgba(67, 233, 123, 0.05)'
            : 'rgba(255, 107, 107, 0.05)',
          borderColor: myBalance.balance >= 0
            ? 'rgba(67, 233, 123, 0.2)'
            : 'rgba(255, 107, 107, 0.2)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Tu balance</div>
            <div style={{
              fontSize: '2rem', fontWeight: 800,
              color: myBalance.balance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            }}>
              {myBalance.balance >= 0 ? '+' : ''}{formatCurrency(myBalance.balance)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              {myBalance.balance > 0 ? '🎉 Te deben dinero' : myBalance.balance < 0 ? '⚠️ Tienes deudas' : '✓ Estás al día'}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 'var(--space-5)' }}>
        {[
          { key: 'expenses', label: 'Gastos' },
          { key: 'balances', label: 'Balances' },
          { key: 'history', label: 'Historial' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}><Spinner size={32} /></div>
      ) : (
        <>
          {/* EXPENSES TAB */}
          {activeTab === 'expenses' && (
            expenses.length === 0 ? (
              <EmptyState
                icon="💸"
                title="Sin gastos aún"
                description="Añade el primer gasto del grupo"
                action={<button className="btn btn-primary" onClick={() => setShowAdd(true)}>Añadir gasto</button>}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {expenses.map(expense => (
                  <div key={expense.id} className="card">
                    <div
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', cursor: 'pointer' }}
                      onClick={() => setExpandedExpense(expandedExpense === expense.id ? null : expense.id)}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-elevated)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.3rem', flexShrink: 0,
                      }}>
                        {getCategoryLabel(expense.category).split(' ')[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }} className="truncate">{expense.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {expense.payer_name || 'Alguien'} · {formatDate(expense.date)}
                        </div>
                        {expense.is_recurring && (
                          <span className="badge badge-info" style={{ marginTop: 4 }}>
                            🔄 {expense.recurring_period === 'monthly' ? 'Mensual' : expense.recurring_period === 'weekly' ? 'Semanal' : 'Anual'}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatCurrency(expense.amount)}</div>
                        {expense.splits?.find(s => s.user_id === user?.id) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--accent-red)' }}>
                            Te toca: {formatCurrency(expense.splits.find(s => s.user_id === user?.id)?.amount_owed || 0)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {expandedExpense === expense.id && (
                      <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border)' }}>
                        {expense.notes && (
                          <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)', fontSize: '0.88rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            💬 {expense.notes}
                          </div>
                        )}
                        {expense.splits && expense.splits.length > 0 && (
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>División:</div>
                            {expense.splits.map(split => (
                              <div key={split.user_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '2px 0' }}>
                                <span>{split.name || split.user_id}{split.user_id === user?.id ? ' (tú)' : ''}</span>
                                <span style={{ color: split.user_id === expense.paid_by ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                                  {formatCurrency(split.amount_owed)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {(expense.paid_by === user?.id) && (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ marginTop: 'var(--space-3)' }}
                            onClick={() => setDeleteTarget(expense)}
                          >
                            🗑️ Eliminar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {/* BALANCES TAB */}
          {activeTab === 'balances' && (
            <div>
              {debts.length === 0 ? (
                <EmptyState icon="🎉" title="¡Todos al día!" description="No hay deudas pendientes en el grupo" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <h3 style={{ marginBottom: 'var(--space-2)' }}>Deudas simplificadas</h3>
                  {debts.map((debt, i) => (
                    <div key={i} className="card" style={{
                      background: debt.from.id === user?.id ? 'rgba(255,107,107,0.05)' : 'rgba(255,255,255,0.02)',
                      borderColor: debt.from.id === user?.id ? 'rgba(255,107,107,0.2)' : 'var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <Avatar user={debt.from} size="sm" />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600 }}>{debt.from.id === user?.id ? 'Tú' : debt.from.name}</span>
                          <span style={{ color: 'var(--text-muted)', margin: '0 var(--space-2)' }}>→</span>
                          <span style={{ fontWeight: 600 }}>{debt.to.id === user?.id ? 'tú' : debt.to.name}</span>
                        </div>
                        <div style={{ fontWeight: 700, color: debt.from.id === user?.id ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                          {formatCurrency(debt.amount)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {myDebts.length > 0 && (
                    <button className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }} onClick={() => setShowPay(true)}>
                      💸 Registrar mi pago
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            payments.length === 0 ? (
              <EmptyState icon="📋" title="Sin pagos registrados" description="Aquí aparecerán los pagos y liquidaciones" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {payments.map(payment => (
                  <div key={payment.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: '1.3rem' }}>💸</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {payment.from_name} → {payment.to_name}
                      </div>
                      {payment.note && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{payment.note}</div>}
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(payment.date)}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                      {formatCurrency(payment.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      <AddExpenseModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        groupId={groupId}
        members={members}
        currentUser={user}
      />
      <RegisterPaymentModal
        open={showPay}
        onClose={() => setShowPay(false)}
        groupId={groupId}
        debts={debts}
        members={members}
        currentUser={user}
      />
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar gasto"
        message={`¿Eliminar "${deleteTarget?.title}"? Se eliminarán las divisiones asociadas.`}
      />
    </div>
  );
}
