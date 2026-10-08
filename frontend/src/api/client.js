const API_BASE = import.meta.env.VITE_API_URL || '';

function getSession() {
  return localStorage.getItem('flatmate_session');
}

async function request(path, options = {}) {
  const session = getSession();
  const headers = {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem('flatmate_session');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
}

export const api = {
  // Auth
  auth: {
    me: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
    googleUrl: () => `${API_BASE}/auth/google`,
  },

  // Groups
  groups: {
    list: () => request('/api/groups'),
    get: (id) => request(`/api/groups/${id}`),
    create: (data) => request('/api/groups', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/groups/${id}`, { method: 'DELETE' }),
    join: (invite_code) => request('/api/groups/join', { method: 'POST', body: JSON.stringify({ invite_code }) }),
    leave: (id) => request(`/api/groups/${id}/leave`, { method: 'POST' }),
    regenerateInvite: (id) => request(`/api/groups/${id}/invite/regenerate`, { method: 'POST' }),
  },

  // Expenses
  expenses: {
    list: (groupId) => request(`/api/groups/${groupId}/expenses`),
    create: (groupId, data) => request(`/api/groups/${groupId}/expenses`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (groupId, id) => request(`/api/groups/${groupId}/expenses/${id}`, { method: 'DELETE' }),
    balances: (groupId) => request(`/api/groups/${groupId}/balances`),
    payments: (groupId) => request(`/api/groups/${groupId}/payments`),
    pay: (groupId, data) => request(`/api/groups/${groupId}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  },

  // Notes
  notes: {
    list: (groupId) => request(`/api/groups/${groupId}/notes`),
    create: (groupId, data) => request(`/api/groups/${groupId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
    update: (groupId, id, data) => request(`/api/groups/${groupId}/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (groupId, id) => request(`/api/groups/${groupId}/notes/${id}`, { method: 'DELETE' }),
    pin: (groupId, id) => request(`/api/groups/${groupId}/notes/${id}/pin`, { method: 'POST' }),
  },

  // Tasks
  tasks: {
    list: (groupId, filters = {}) => {
      const params = new URLSearchParams(filters).toString();
      return request(`/api/groups/${groupId}/tasks${params ? `?${params}` : ''}`);
    },
    create: (groupId, data) => request(`/api/groups/${groupId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
    update: (groupId, id, data) => request(`/api/groups/${groupId}/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (groupId, id) => request(`/api/groups/${groupId}/tasks/${id}`, { method: 'DELETE' }),
    setStatus: (groupId, id, status) => request(`/api/groups/${groupId}/tasks/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  },
};
