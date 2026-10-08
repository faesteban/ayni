import { Hono } from 'hono';
import { Env, Note } from '../types';
import { getAuthUser, generateId } from '../middleware/auth';

const notes = new Hono<{ Bindings: Env }>();

async function checkMembership(db: D1Database, groupId: string, userId: string) {
  return db.prepare(
    'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(groupId, userId).first<{ role: string }>();
}

// Get all notes for a group
notes.get('/groups/:groupId/notes', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('groupId');
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const result = await c.env.DB.prepare(`
    SELECT n.*, u.name as creator_name, u.avatar_url as creator_avatar
    FROM notes n
    JOIN users u ON n.created_by = u.id
    WHERE n.group_id = ?
    ORDER BY n.pinned DESC, n.updated_at DESC
  `).bind(groupId).all<Note & { creator_name: string; creator_avatar: string }>();

  return c.json({ notes: result.results });
});

// Create a note
notes.post('/groups/:groupId/notes', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('groupId');
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const body = await c.req.json<{
    title?: string;
    content?: string;
    color?: string;
    pinned?: boolean;
  }>();

  if (!body.content && !body.title) return c.json({ error: 'Note must have title or content' }, 400);

  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO notes (id, group_id, title, content, color, pinned, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, groupId, body.title || null, body.content || '',
    body.color || '#1e1e2e', body.pinned ? 1 : 0, user.id, user.id
  ).run();

  const note = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first<Note>();
  return c.json({ note }, 201);
});

// Update a note
notes.put('/groups/:groupId/notes/:id', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { groupId, id } = c.req.param();
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const note = await c.env.DB.prepare(
    'SELECT * FROM notes WHERE id = ? AND group_id = ?'
  ).bind(id, groupId).first<Note>();
  if (!note) return c.json({ error: 'Note not found' }, 404);

  const body = await c.req.json<{
    title?: string;
    content?: string;
    color?: string;
    pinned?: boolean;
  }>();

  const updates: string[] = ['updated_by = ?', 'updated_at = datetime("now")'];
  const values: unknown[] = [user.id];

  if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title || null); }
  if (body.content !== undefined) { updates.push('content = ?'); values.push(body.content); }
  if (body.color !== undefined) { updates.push('color = ?'); values.push(body.color); }
  if (body.pinned !== undefined) { updates.push('pinned = ?'); values.push(body.pinned ? 1 : 0); }

  values.push(id, groupId);
  await c.env.DB.prepare(
    `UPDATE notes SET ${updates.join(', ')} WHERE id = ? AND group_id = ?`
  ).bind(...values).run();

  const updatedNote = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first<Note>();
  return c.json({ note: updatedNote });
});

// Delete a note
notes.delete('/groups/:groupId/notes/:id', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { groupId, id } = c.req.param();
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const note = await c.env.DB.prepare(
    'SELECT * FROM notes WHERE id = ? AND group_id = ?'
  ).bind(id, groupId).first<Note>();

  if (!note) return c.json({ error: 'Note not found' }, 404);

  // Only creator or admin can delete
  if (note.created_by !== user.id) {
    const member = await checkMembership(c.env.DB, groupId, user.id);
    if (member?.role !== 'admin') return c.json({ error: 'Not authorized to delete this note' }, 403);
  }

  await c.env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// Toggle pin on a note
notes.post('/groups/:groupId/notes/:id/pin', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { groupId, id } = c.req.param();
  if (!await checkMembership(c.env.DB, groupId, user.id)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const note = await c.env.DB.prepare(
    'SELECT pinned FROM notes WHERE id = ? AND group_id = ?'
  ).bind(id, groupId).first<{ pinned: number }>();
  if (!note) return c.json({ error: 'Note not found' }, 404);

  await c.env.DB.prepare(
    'UPDATE notes SET pinned = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(note.pinned ? 0 : 1, id).run();

  return c.json({ pinned: !note.pinned });
});

export default notes;
