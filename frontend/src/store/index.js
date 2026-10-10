import { create } from 'zustand';
import { api } from '../api/client';

// ---- Auth Store ----
export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,

  init: async () => {
    const session = localStorage.getItem('flatmate_session');
    if (!session) {
      set({ loading: false });
      return;
    }
    try {
      const { user } = await api.auth.me();
      set({ user, loading: false });
    } catch {
      localStorage.removeItem('flatmate_session');
      set({ loading: false });
    }
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    try { await api.auth.logout(); } catch {}
    localStorage.removeItem('flatmate_session');
    set({ user: null });
  },
}));

// ---- Groups Store ----
export const useGroupStore = create((set, get) => ({
  groups: [],
  currentGroup: null,
  members: [],
  myRole: null,
  loading: false,

  fetchGroups: async () => {
    set({ loading: true });
    try {
      const { groups } = await api.groups.list();
      set({ groups, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  fetchGroup: async (id) => {
    set({ loading: true });
    try {
      const { group, members, myRole } = await api.groups.get(id);
      set({ currentGroup: group, members, myRole, loading: false });
      return { group, members, myRole };
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  createGroup: async (data) => {
    const { group } = await api.groups.create(data);
    set(state => ({ groups: [group, ...state.groups] }));
    return group;
  },

  updateGroup: async (id, data) => {
    const { group } = await api.groups.update(id, data);
    set(state => ({
      groups: state.groups.map(g => g.id === id ? group : g),
      currentGroup: state.currentGroup?.id === id ? group : state.currentGroup,
    }));
    return group;
  },

  deleteGroup: async (id) => {
    await api.groups.delete(id);
    set(state => ({
      groups: state.groups.filter(g => g.id !== id),
      currentGroup: state.currentGroup?.id === id ? null : state.currentGroup,
    }));
  },

  joinGroup: async (code) => {
    const { group } = await api.groups.join(code);
    set(state => ({
      groups: state.groups.some(g => g.id === group.id)
        ? state.groups
        : [group, ...state.groups],
    }));
    return group;
  },

  inviteByEmail: async (groupId, email) => {
    const { user } = await api.groups.inviteByEmail(groupId, email);
    // Optionally fetch members again to update the store
    const { members } = await api.groups.get(groupId);
    set({ members });
    return user;
  },
}));

// ---- Expenses Store ----
export const useExpenseStore = create((set, get) => ({
  expenses: [],
  balances: [],
  debts: [],
  payments: [],
  loading: false,

  fetchExpenses: async (groupId) => {
    set({ loading: true });
    try {
      const [expensesData, balancesData, paymentsData] = await Promise.all([
        api.expenses.list(groupId),
        api.expenses.balances(groupId),
        api.expenses.payments(groupId),
      ]);
      set({
        expenses: expensesData.expenses,
        balances: balancesData.balances,
        debts: balancesData.debts,
        payments: paymentsData.payments,
        loading: false,
      });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  addExpense: async (groupId, data) => {
    const { expense } = await api.expenses.create(groupId, data);
    set(state => ({ expenses: [expense, ...state.expenses] }));
    // Refetch balances
    const balancesData = await api.expenses.balances(groupId);
    set({ balances: balancesData.balances, debts: balancesData.debts });
    return expense;
  },

  deleteExpense: async (groupId, id) => {
    await api.expenses.delete(groupId, id);
    set(state => ({ expenses: state.expenses.filter(e => e.id !== id) }));
    const balancesData = await api.expenses.balances(groupId);
    set({ balances: balancesData.balances, debts: balancesData.debts });
  },

  registerPayment: async (groupId, data) => {
    await api.expenses.pay(groupId, data);
    // Refetch everything
    const [balancesData, paymentsData] = await Promise.all([
      api.expenses.balances(groupId),
      api.expenses.payments(groupId),
    ]);
    set({
      balances: balancesData.balances,
      debts: balancesData.debts,
      payments: paymentsData.payments,
    });
  },
}));

// ---- Notes Store ----
export const useNoteStore = create((set, get) => ({
  notes: [],
  loading: false,

  fetchNotes: async (groupId) => {
    set({ loading: true });
    try {
      const { notes } = await api.notes.list(groupId);
      set({ notes, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  createNote: async (groupId, data) => {
    const { note } = await api.notes.create(groupId, data);
    set(state => ({ notes: [note, ...state.notes] }));
    return note;
  },

  updateNote: async (groupId, id, data) => {
    const { note } = await api.notes.update(groupId, id, data);
    set(state => ({
      notes: state.notes.map(n => n.id === id ? note : n)
        .sort((a, b) => b.pinned - a.pinned),
    }));
    return note;
  },

  deleteNote: async (groupId, id) => {
    await api.notes.delete(groupId, id);
    set(state => ({ notes: state.notes.filter(n => n.id !== id) }));
  },

  togglePin: async (groupId, id) => {
    const { pinned } = await api.notes.pin(groupId, id);
    set(state => ({
      notes: state.notes
        .map(n => n.id === id ? { ...n, pinned } : n)
        .sort((a, b) => b.pinned - a.pinned),
    }));
  },
}));

// ---- Tasks Store ----
export const useTaskStore = create((set, get) => ({
  tasks: [],
  loading: false,
  filters: {},

  fetchTasks: async (groupId, filters = {}) => {
    set({ loading: true, filters });
    try {
      const { tasks } = await api.tasks.list(groupId, filters);
      set({ tasks, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  createTask: async (groupId, data) => {
    const { task } = await api.tasks.create(groupId, data);
    set(state => ({ tasks: [task, ...state.tasks] }));
    return task;
  },

  updateTask: async (groupId, id, data) => {
    const { task } = await api.tasks.update(groupId, id, data);
    set(state => ({ tasks: state.tasks.map(t => t.id === id ? task : t) }));
    return task;
  },

  deleteTask: async (groupId, id) => {
    await api.tasks.delete(groupId, id);
    set(state => ({ tasks: state.tasks.filter(t => t.id !== id) }));
  },

  setStatus: async (groupId, id, status) => {
    await api.tasks.setStatus(groupId, id, status);
    set(state => ({
      tasks: state.tasks.map(t =>
        t.id === id ? { ...t, status, completed_at: status === 'done' ? new Date().toISOString() : null } : t
      ),
    }));
  },
}));

// ---- Toast Store ----
export const useToastStore = create((set, get) => ({
  toasts: [],

  show: (message, type = 'default') => {
    const id = Date.now();
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 3000);
  },

  success: (msg) => get().show(msg, 'success'),
  error: (msg) => get().show(msg, 'error'),
}));
