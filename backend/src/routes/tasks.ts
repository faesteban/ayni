import { Hono } from 'hono';
import { Env, Task } from '../types';
import { getAuthUser, generateId } from '../middleware/auth';

const tasks = new Hono<{ Bindings: Env }>();

async function checkMembership(db: D1Database, groupId: string, userId: string) {
  return db.prepare(
    'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(groupId, userId).first<{ role: string }>();
}

// Get all tasks for a group
tasks.get('/groups/:groupId/tasks', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('groupId');
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const { status, assigned_to, priority } = c.req.query();

  let query = `
    SELECT t.*,
      ua.name as assignee_name, ua.avatar_url as assignee_avatar,
      uc.name as creator_name, uc.avatar_url as creator_avatar
    FROM tasks t
    LEFT JOIN users ua ON t.assigned_to = ua.id
    JOIN users uc ON t.created_by = uc.id
    WHERE t.group_id = ?
  `;
  const params: unknown[] = [groupId];

  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (assigned_to) { query += ' AND t.assigned_to = ?'; params.push(assigned_to); }
  if (priority) { query += ' AND t.priority = ?'; params.push(priority); }

  query += ' ORDER BY t.priority DESC, t.due_date ASC, t.created_at DESC';

  const result = await c.env.DB.prepare(query).bind(...params).all<Task & {
    assignee_name: string; assignee_avatar: string;
    creator_name: string; creator_avatar: string;
  }>();

  return c.json({ tasks: result.results });
});

// Create a task
tasks.post('/groups/:groupId/tasks', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('groupId');
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const body = await c.req.json<{
    title: string;
    description?: string;
    status?: 'pending' | 'in_progress' | 'done';
    priority?: 'low' | 'medium' | 'high';
    assigned_to?: string;
    due_date?: string;
  }>();

  if (!body.title?.trim()) return c.json({ error: 'Task title required' }, 400);

  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO tasks (id, group_id, title, description, status, priority, assigned_to, created_by, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, groupId, body.title.trim(),
    body.description || null,
    body.status || 'pending',
    body.priority || 'medium',
    body.assigned_to || null,
    user.id,
    body.due_date || null
  ).run();

  const task = await c.env.DB.prepare(`
    SELECT t.*, ua.name as assignee_name, ua.avatar_url as assignee_avatar,
      uc.name as creator_name, uc.avatar_url as creator_avatar
    FROM tasks t
    LEFT JOIN users ua ON t.assigned_to = ua.id
    JOIN users uc ON t.created_by = uc.id
    WHERE t.id = ?
  `).bind(id).first<Task>();

  return c.json({ task }, 201);
});

// Update a task
tasks.put('/groups/:groupId/tasks/:id', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { groupId, id } = c.req.param();
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const task = await c.env.DB.prepare(
    'SELECT * FROM tasks WHERE id = ? AND group_id = ?'
  ).bind(id, groupId).first<Task>();
  if (!task) return c.json({ error: 'Task not found' }, 404);

  const body = await c.req.json<{
    title?: string;
    description?: string;
    status?: 'pending' | 'in_progress' | 'done';
    priority?: 'low' | 'medium' | 'high';
    assigned_to?: string | null;
    due_date?: string | null;
  }>();

  const updates: string[] = ['updated_at = datetime("now")'];
  const values: unknown[] = [];

  if (body.title) { updates.push('title = ?'); values.push(body.title); }
  if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description || null); }
  if (body.status) {
    updates.push('status = ?');
    values.push(body.status);
    if (body.status === 'done') {
      updates.push('completed_at = datetime("now")');
    } else {
      updates.push('completed_at = NULL');
    }
  }
  if (body.priority) { updates.push('priority = ?'); values.push(body.priority); }
  if (body.assigned_to !== undefined) { updates.push('assigned_to = ?'); values.push(body.assigned_to || null); }
  if (body.due_date !== undefined) { updates.push('due_date = ?'); values.push(body.due_date || null); }

  values.push(id, groupId);
  await c.env.DB.prepare(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND group_id = ?`
  ).bind(...values).run();

  const updatedTask = await c.env.DB.prepare(`
    SELECT t.*, ua.name as assignee_name, ua.avatar_url as assignee_avatar,
      uc.name as creator_name, uc.avatar_url as creator_avatar
    FROM tasks t
    LEFT JOIN users ua ON t.assigned_to = ua.id
    JOIN users uc ON t.created_by = uc.id
    WHERE t.id = ?
  `).bind(id).first<Task>();

  return c.json({ task: updatedTask });
});

// Delete a task
tasks.delete('/groups/:groupId/tasks/:id', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { groupId, id } = c.req.param();
  const member = await checkMembership(c.env.DB, groupId, user.id);
  if (!member) return c.json({ error: 'Access denied' }, 403);

  const task = await c.env.DB.prepare(
    'SELECT * FROM tasks WHERE id = ? AND group_id = ?'
  ).bind(id, groupId).first<Task>();
  if (!task) return c.json({ error: 'Task not found' }, 404);

  if (task.created_by !== user.id && member.role !== 'admin') {
    return c.json({ error: 'Not authorized to delete this task' }, 403);
  }

  await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// Quick status change
tasks.post('/groups/:groupId/tasks/:id/status', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { groupId, id } = c.req.param();
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const body = await c.req.json<{ status: 'pending' | 'in_progress' | 'done' }>();
  if (!['pending', 'in_progress', 'done'].includes(body.status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }

  const completedAt = body.status === 'done' ? 'datetime("now")' : 'NULL';
  await c.env.DB.prepare(
    `UPDATE tasks SET status = ?, completed_at = ${completedAt}, updated_at = datetime("now") WHERE id = ? AND group_id = ?`
  ).bind(body.status, id, groupId).run();

  return c.json({ success: true, status: body.status });
});

export default tasks;
