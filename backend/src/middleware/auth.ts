import { Context } from 'hono';
import { Env, Session, User } from '../types';

// Simple session-based auth using D1
export async function getAuthUser(c: Context<{ Bindings: Env }>): Promise<User | null> {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '') ||
    getCookie(c.req.raw, 'session');

  if (!sessionId) return null;

  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<Session>();

  if (!session) return null;

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(session.user_id).first<User>();

  return user || null;
}

export function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, value] = cookie.split('=');
    if (key.trim() === name) return value?.trim() || null;
  }
  return null;
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const sessionId = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  await db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionId, userId, expiresAt).run();

  return sessionId;
}

export function requireAuth(handler: (c: Context<{ Bindings: Env }>, user: User) => Promise<Response>) {
  return async (c: Context<{ Bindings: Env }>) => {
    const user = await getAuthUser(c);
    if (!user) {
      return c.json({ error: 'Unauthorized', message: 'Please login first' }, 401);
    }
    return handler(c, user);
  };
}

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
