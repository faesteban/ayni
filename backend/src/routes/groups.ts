import { Hono } from 'hono';
import { Env, Group, GroupMember, User } from '../types';
import { getAuthUser, generateId, generateInviteCode } from '../middleware/auth';

const groups = new Hono<{ Bindings: Env }>();

// Get all groups for current user
groups.get('/', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const result = await c.env.DB.prepare(`
    SELECT g.*, gm.role, gm.joined_at,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
    ORDER BY gm.joined_at DESC
  `).bind(user.id).all<Group & { role: string; member_count: number }>();

  return c.json({ groups: result.results });
});

// Create a group
groups.post('/', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json<{ name: string; description?: string; emoji?: string; currency?: string }>();
  if (!body.name?.trim()) return c.json({ error: 'Group name is required' }, 400);

  const id = generateId();
  const inviteCode = generateInviteCode();

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO groups (id, name, description, emoji, currency, invite_code, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, body.name.trim(), body.description || null, body.emoji || '🏠', body.currency || 'EUR', inviteCode, user.id),
    c.env.DB.prepare(
      'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)'
    ).bind(id, user.id, 'admin'),
  ]);

  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first<Group>();
  return c.json({ group }, 201);
});

// Get a single group
groups.get('/:id', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('id');

  // Check membership
  const member = await c.env.DB.prepare(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(groupId, user.id).first<GroupMember>();
  if (!member) return c.json({ error: 'Group not found or access denied' }, 404);

  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(groupId).first<Group>();
  if (!group) return c.json({ error: 'Group not found' }, 404);

  // Get members with user info
  const membersResult = await c.env.DB.prepare(`
    SELECT gm.*, u.name, u.email, u.avatar_url
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
    ORDER BY gm.role DESC, gm.joined_at ASC
  `).bind(groupId).all();

  return c.json({ group, members: membersResult.results, myRole: member.role });
});

// Update group
groups.put('/:id', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('id');
  const member = await c.env.DB.prepare(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?'
  ).bind(groupId, user.id, 'admin').first<GroupMember>();
  if (!member) return c.json({ error: 'Not authorized to edit this group' }, 403);

  const body = await c.req.json<{ name?: string; description?: string; emoji?: string; currency?: string }>();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.name) { updates.push('name = ?'); values.push(body.name); }
  if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
  if (body.emoji) { updates.push('emoji = ?'); values.push(body.emoji); }
  if (body.currency) { updates.push('currency = ?'); values.push(body.currency); }

  if (updates.length === 0) return c.json({ error: 'Nothing to update' }, 400);

  values.push(groupId);
  await c.env.DB.prepare(`UPDATE groups SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(groupId).first<Group>();
  return c.json({ group });
});

// Delete group (admin only)
groups.delete('/:id', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('id');
  const isAdmin = await c.env.DB.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?'
  ).bind(groupId, user.id, 'admin').first();
  if (!isAdmin) return c.json({ error: 'Only admins can delete groups' }, 403);

  await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(groupId).run();
  return c.json({ success: true });
});

// Join group by invite code
groups.post('/join', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json<{ invite_code: string }>();
  if (!body.invite_code) return c.json({ error: 'Invite code required' }, 400);

  const group = await c.env.DB.prepare(
    'SELECT * FROM groups WHERE invite_code = ?'
  ).bind(body.invite_code.toUpperCase()).first<Group>();
  if (!group) return c.json({ error: 'Invalid invite code' }, 404);

  const existingMember = await c.env.DB.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(group.id, user.id).first();
  if (existingMember) return c.json({ error: 'Already a member', group }, 200);

  await c.env.DB.prepare(
    'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)'
  ).bind(group.id, user.id, 'member').run();

  return c.json({ success: true, group }, 201);
});

// Leave group
groups.post('/:id/leave', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('id');
  await c.env.DB.prepare(
    'DELETE FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(groupId, user.id).run();

  return c.json({ success: true });
});

// Regenerate invite code (admin only)
groups.post('/:id/invite/regenerate', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const groupId = c.req.param('id');
  const isAdmin = await c.env.DB.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND role = ?'
  ).bind(groupId, user.id, 'admin').first();
  if (!isAdmin) return c.json({ error: 'Only admins can regenerate invite codes' }, 403);

  const newCode = generateInviteCode();
  await c.env.DB.prepare('UPDATE groups SET invite_code = ? WHERE id = ?').bind(newCode, groupId).run();
  return c.json({ invite_code: newCode });
});

export default groups;
