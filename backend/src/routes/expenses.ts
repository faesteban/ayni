import { Hono } from 'hono';
import { Env, Expense, ExpenseSplit, User } from '../types';
import { getAuthUser, generateId } from '../middleware/auth';
import { notifyUser } from './notifications';


const expenses = new Hono<{ Bindings: Env }>();

// Helper: check group membership
async function checkMembership(db: D1Database, groupId: string, userId: string) {
  return db.prepare(
    'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(groupId, userId).first<{ role: string }>();
}

// Get all expenses for a group
expenses.get('/groups/:groupId/expenses', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('groupId');
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const expensesResult = await c.env.DB.prepare(`
    SELECT e.*, u.name as payer_name, u.avatar_url as payer_avatar
    FROM expenses e
    JOIN users u ON e.paid_by = u.id
    WHERE e.group_id = ?
    ORDER BY e.date DESC
  `).bind(groupId).all<Expense & { payer_name: string; payer_avatar: string }>();

  // Get splits for each expense
  const expenseIds = expensesResult.results.map(e => e.id);
  let splitsMap: Record<string, ExpenseSplit[]> = {};

  if (expenseIds.length > 0) {
    const placeholders = expenseIds.map(() => '?').join(',');
    const splitsResult = await c.env.DB.prepare(`
      SELECT es.*, u.name, u.avatar_url
      FROM expense_splits es
      JOIN users u ON es.user_id = u.id
      WHERE es.expense_id IN (${placeholders})
    `).bind(...expenseIds).all<ExpenseSplit & { name: string; avatar_url: string }>();

    for (const split of splitsResult.results) {
      if (!splitsMap[split.expense_id]) splitsMap[split.expense_id] = [];
      splitsMap[split.expense_id].push(split);
    }
  }

  const enrichedExpenses = expensesResult.results.map(e => ({
    ...e,
    splits: splitsMap[e.id] || [],
  }));

  return c.json({ expenses: enrichedExpenses });
});

// Add an expense
expenses.post('/groups/:groupId/expenses', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('groupId');
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const body = await c.req.json<{
    title: string;
    amount: number;
    paid_by?: string;
    category?: string;
    notes?: string;
    date?: string;
    splits?: { user_id: string; amount: number }[];
    split_equally?: boolean;
    split_with?: string[];
    is_recurring?: boolean;
    recurring_period?: 'weekly' | 'monthly' | 'yearly';
    next_due_date?: string;
  }>();

  if (!body.title?.trim()) return c.json({ error: 'Title required' }, 400);
  if (!body.amount || body.amount <= 0) return c.json({ error: 'Valid amount required' }, 400);

  const paidBy = body.paid_by || user.id;
  const expenseId = generateId();

  // Get group members for auto-split
  const members = await c.env.DB.prepare(
    'SELECT user_id FROM group_members WHERE group_id = ?'
  ).bind(groupId).all<{ user_id: string }>();

  let splits: { user_id: string; amount_owed: number }[] = [];

  if (body.splits && body.splits.length > 0) {
    // Custom splits provided
    splits = body.splits.map(s => ({ user_id: s.user_id, amount_owed: s.amount }));
  } else {
    // Auto-split equally among specified members or all members
    const splitWith = body.split_with || members.results.map(m => m.user_id);
    const perPerson = Math.round((body.amount / splitWith.length) * 100) / 100;
    splits = splitWith.map(uid => ({ user_id: uid, amount_owed: perPerson }));
  }

  // Insert expense and splits in batch
  // Calculate next_due_date for recurring expenses
  let nextDueDate: string | null = null;
  if (body.is_recurring && body.recurring_period) {
    const base = body.date ? new Date(body.date) : new Date();
    if (body.recurring_period === 'weekly') base.setDate(base.getDate() + 7);
    else if (body.recurring_period === 'monthly') base.setMonth(base.getMonth() + 1);
    else if (body.recurring_period === 'yearly') base.setFullYear(base.getFullYear() + 1);
    nextDueDate = base.toISOString();
  }

  // Insert expense and splits in batch
  const statements = [
    c.env.DB.prepare(
      'INSERT INTO expenses (id, group_id, title, amount, paid_by, category, notes, date, is_recurring, recurring_period, next_due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      expenseId, groupId, body.title.trim(), body.amount, paidBy,
      body.category || 'general', body.notes || null,
      body.date || new Date().toISOString(),
      body.is_recurring ? 1 : 0,
      body.recurring_period || null,
      nextDueDate
    ),
    ...splits.map(split =>
      c.env.DB.prepare(
        'INSERT INTO expense_splits (id, expense_id, user_id, amount_owed) VALUES (?, ?, ?, ?)'
      ).bind(generateId(), expenseId, split.user_id, split.amount_owed)
    ),
  ];

  await c.env.DB.batch(statements);

  const expense = await c.env.DB.prepare(
    'SELECT * FROM expenses WHERE id = ?'
  ).bind(expenseId).first<Expense>();

  // Notify other group members about the new expense
  const payer = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(paidBy).first<{ name: string }>();
  const otherMembers = await c.env.DB.prepare(
    'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?'
  ).bind(groupId, paidBy).all<{ user_id: string }>();

  const amountStr = new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR'
  }).format(body.amount);

  for (const member of otherMembers.results) {
    // Only notify if they are in the split
    const isInSplit = splits.some(s => s.user_id === member.user_id);
    if (isInSplit) {
      await notifyUser(c.env, member.user_id, {
        title: `💸 Nuevo gasto añadido`,
        body: `${payer?.name || 'Alguien'} pagó ${amountStr} por "${body.title}"`,
        data: { type: 'new_expense', expense_id: expenseId, group_id: groupId },
      });
    }
  }

  return c.json({ expense }, 201);
});

// Delete an expense
expenses.delete('/groups/:groupId/expenses/:id', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { groupId, id } = c.req.param();
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const expense = await c.env.DB.prepare(
    'SELECT * FROM expenses WHERE id = ? AND group_id = ?'
  ).bind(id, groupId).first<Expense>();

  if (!expense) return c.json({ error: 'Expense not found' }, 404);
  if (expense.paid_by !== user.id) {
    const isAdmin = await checkMembership(c.env.DB, groupId, user.id);
    if (isAdmin?.role !== 'admin') return c.json({ error: 'Only the payer or admin can delete this expense' }, 403);
  }

  await c.env.DB.prepare('DELETE FROM expenses WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// Get balances for a group
expenses.get('/groups/:groupId/balances', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('groupId');
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Get all members
  const membersResult = await c.env.DB.prepare(`
    SELECT u.id, u.name, u.email, u.avatar_url
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `).bind(groupId).all<User>();

  const members = membersResult.results;

  // Get all unsettled expenses with splits
  const splitsResult = await c.env.DB.prepare(`
    SELECT e.paid_by, es.user_id, es.amount_owed
    FROM expense_splits es
    JOIN expenses e ON es.expense_id = e.id
    WHERE e.group_id = ? AND es.is_settled = 0
  `).bind(groupId).all<{ paid_by: string; user_id: string; amount_owed: number }>();

  // Get payments
  const paymentsResult = await c.env.DB.prepare(`
    SELECT from_user, to_user, amount FROM payments WHERE group_id = ?
  `).bind(groupId).all<{ from_user: string; to_user: string; amount: number }>();

  // Calculate net balances: positive = owed money, negative = owes money
  const balances: Record<string, number> = {};
  for (const member of members) {
    balances[member.id] = 0;
  }

  // From expenses: payer is owed money (positive), others owe (negative)
  for (const split of splitsResult.results) {
    if (split.paid_by !== split.user_id) {
      balances[split.paid_by] = (balances[split.paid_by] || 0) + split.amount_owed;
      balances[split.user_id] = (balances[split.user_id] || 0) - split.amount_owed;
    }
  }

  // From payments: adjust balances
  for (const payment of paymentsResult.results) {
    balances[payment.from_user] = (balances[payment.from_user] || 0) + payment.amount;
    balances[payment.to_user] = (balances[payment.to_user] || 0) - payment.amount;
  }

  // Simplify debts using the "greedy" algorithm
  const debts: { from: User; to: User; amount: number }[] = [];
  const creditors = members.filter(m => balances[m.id] > 0.01).map(m => ({ ...m, balance: balances[m.id] }));
  const debtors = members.filter(m => balances[m.id] < -0.01).map(m => ({ ...m, balance: -balances[m.id] }));

  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = Math.min(credit.balance, debt.balance);

    if (amount > 0.01) {
      debts.push({
        from: members.find(m => m.id === debt.id)!,
        to: members.find(m => m.id === credit.id)!,
        amount: Math.round(amount * 100) / 100,
      });
    }

    credit.balance -= amount;
    debt.balance -= amount;

    if (credit.balance < 0.01) ci++;
    if (debt.balance < 0.01) di++;
  }

  const memberBalances = members.map(m => ({
    user: m,
    balance: Math.round((balances[m.id] || 0) * 100) / 100,
  }));

  return c.json({ balances: memberBalances, debts });
});

// Register a payment
expenses.post('/groups/:groupId/payments', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('groupId');
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const body = await c.req.json<{
    to_user: string;
    amount: number;
    note?: string;
    date?: string;
  }>();

  if (!body.to_user) return c.json({ error: 'Recipient required' }, 400);
  if (!body.amount || body.amount <= 0) return c.json({ error: 'Valid amount required' }, 400);

  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO payments (id, group_id, from_user, to_user, amount, note, date) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, groupId, user.id, body.to_user, body.amount, body.note || null, body.date || new Date().toISOString()).run();

  return c.json({ success: true, payment_id: id }, 201);
});

// Get payment history
expenses.get('/groups/:groupId/payments', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('groupId');
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const result = await c.env.DB.prepare(`
    SELECT p.*, 
      uf.name as from_name, uf.avatar_url as from_avatar,
      ut.name as to_name, ut.avatar_url as to_avatar
    FROM payments p
    JOIN users uf ON p.from_user = uf.id
    JOIN users ut ON p.to_user = ut.id
    WHERE p.group_id = ?
    ORDER BY p.date DESC
  `).bind(groupId).all();

  return c.json({ payments: result.results });
});

export default expenses;
