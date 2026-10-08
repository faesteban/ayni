import { Hono } from 'hono';
import { Env } from '../types';
import { getAuthUser, generateId } from '../middleware/auth';

const notifications = new Hono<{ Bindings: Env }>();

// ── Helpers ──────────────────────────────────────────────────

/**
 * Sends a Web Push notification using the VAPID protocol.
 * Cloudflare Workers supports the SubtleCrypto API needed for VAPID signing.
 */
async function sendPushNotification(
  env: Env,
  endpoint: string,
  p256dh: string,
  authKey: string,
  payload: { title: string; body: string; icon?: string; badge?: string; data?: unknown }
) {
  // Build VAPID JWT
  const vapidPublic = env.VAPID_PUBLIC_KEY;
  const vapidPrivate = env.VAPID_PRIVATE_KEY;
  const vapidSubject = env.VAPID_SUBJECT || 'mailto:admin@ayni.app';

  if (!vapidPublic || !vapidPrivate) {
    console.warn('VAPID keys not configured, skipping push');
    return false;
  }

  try {
    const origin = new URL(endpoint).origin;
    const now = Math.floor(Date.now() / 1000);

    // VAPID JWT header + payload
    const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const claims = btoa(JSON.stringify({
      aud: origin,
      exp: now + 12 * 3600,
      sub: vapidSubject,
    })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const signingInput = `${header}.${claims}`;

    // Import VAPID private key for signing
    const privateKeyBytes = base64UrlDecode(vapidPrivate);
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBytes,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(signingInput)
    );

    const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const jwt = `${signingInput}.${sig}`;

    // Encrypt payload using ECDH + AES-GCM (Web Push encryption)
    const encryptedBody = await encryptPayload(JSON.stringify(payload), p256dh, authKey);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${vapidPublic}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
      },
      body: encryptedBody,
    });

    return response.status >= 200 && response.status < 300;
  } catch (err) {
    console.error('Push send error:', err);
    return false;
  }
}

function base64UrlDecode(str: string): ArrayBuffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function encryptPayload(payload: string, p256dh: string, authKey: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  ) as CryptoKeyPair;

  const clientKey = await crypto.subtle.importKey(
    'raw', base64UrlDecode(p256dh),
    { name: 'ECDH', namedCurve: 'P-256' }, true, []
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey }, serverKeys.privateKey, 256
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authBytes = base64UrlDecode(authKey);
  const serverPublicRaw = await crypto.subtle.exportKey('raw', serverKeys.publicKey);

  // HKDF to derive content encryption key and nonce
  const prk = await hkdf(sharedSecret, authBytes, encoder.encode('Content-Encoding: auth\0'), 32);
  const clientPublicRaw = base64UrlDecode(p256dh);
  const keyInfo = buildInfo('aesgcm', clientPublicRaw, serverPublicRaw);
  const nonceInfo = buildInfo('nonce', clientPublicRaw, serverPublicRaw);

  const contentKey = await hkdf(prk, salt, keyInfo, 16);
  const nonce = await hkdf(prk, salt, nonceInfo, 12);

  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aesKey,
    encoder.encode('\0'.repeat(2) + payload)
  );

  // Build aes128gcm content-encoding header
  const header = new Uint8Array(21 + serverPublicRaw.byteLength);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = serverPublicRaw.byteLength;
  header.set(new Uint8Array(serverPublicRaw), 21);

  const result = new Uint8Array(header.byteLength + encrypted.byteLength);
  result.set(header, 0);
  result.set(new Uint8Array(encrypted), header.byteLength);
  return result.buffer;
}

async function hkdf(ikm: ArrayBuffer, salt: ArrayBuffer, info: ArrayBuffer, length: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
}

function buildInfo(type: string, clientKey: ArrayBuffer, serverKey: ArrayBuffer): ArrayBuffer {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(`Content-Encoding: ${type}\0P-256\0`);
  const result = new Uint8Array(typeBytes.byteLength + 2 + clientKey.byteLength + 2 + serverKey.byteLength);
  let offset = 0;
  result.set(typeBytes, offset); offset += typeBytes.byteLength;
  new DataView(result.buffer).setUint16(offset, clientKey.byteLength, false); offset += 2;
  result.set(new Uint8Array(clientKey), offset); offset += clientKey.byteLength;
  new DataView(result.buffer).setUint16(offset, serverKey.byteLength, false); offset += 2;
  result.set(new Uint8Array(serverKey), offset);
  return result.buffer;
}

// ── Routes ────────────────────────────────────────────────────

// Subscribe to push notifications
notifications.post('/subscribe', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }>();

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ error: 'Invalid subscription data' }, 400);
  }

  const id = generateId();
  await c.env.DB.prepare(`
    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth_key, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, endpoint) DO UPDATE SET
      p256dh = excluded.p256dh,
      auth_key = excluded.auth_key
  `).bind(
    id, user.id, body.endpoint, body.keys.p256dh, body.keys.auth,
    c.req.header('User-Agent') || null
  ).run();

  return c.json({ success: true });
});

// Unsubscribe
notifications.delete('/subscribe', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json<{ endpoint: string }>();
  await c.env.DB.prepare(
    'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
  ).bind(user.id, body.endpoint).run();

  return c.json({ success: true });
});

// VAPID public key (needed by frontend to subscribe)
notifications.get('/vapid-key', (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY || '' });
});

// ── Cron Job Handler (called by Cloudflare scheduled trigger) ─

export async function handleCron(env: Env) {
  console.log('Running notification cron at', new Date().toISOString());

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

  // 1. Overdue tasks (due_date < today and status != 'done')
  const overdueTasks = await env.DB.prepare(`
    SELECT t.id, t.title, t.due_date, t.group_id, t.assigned_to,
      g.name as group_name
    FROM tasks t
    JOIN groups g ON t.group_id = g.id
    WHERE t.status != 'done'
      AND t.due_date IS NOT NULL
      AND date(t.due_date) < date('now')
      AND t.assigned_to IS NOT NULL
  `).all<{ id: string; title: string; due_date: string; assigned_to: string; group_name: string }>();

  for (const task of overdueTasks.results) {
    const daysOverdue = Math.floor((now.getTime() - new Date(task.due_date).getTime()) / 86400000);
    await notifyUser(env, task.assigned_to, {
      title: `⚠️ Tarea vencida hace ${daysOverdue} día${daysOverdue > 1 ? 's' : ''} — ${task.group_name}`,
      body: `"${task.title}" estaba pendiente para ${new Date(task.due_date).toLocaleDateString('es-ES')}`,
      data: { type: 'overdue_task', task_id: task.id, group_id: task.group_id },
    });
  }

  // 2. Tasks due today
  const dueTodayTasks = await env.DB.prepare(`
    SELECT t.id, t.title, t.assigned_to, t.group_id,
      g.name as group_name
    FROM tasks t
    JOIN groups g ON t.group_id = g.id
    WHERE t.status != 'done'
      AND date(t.due_date) = date('now')
      AND t.assigned_to IS NOT NULL
  `).all<{ id: string; title: string; assigned_to: string; group_id: string; group_name: string }>();

  for (const task of dueTodayTasks.results) {
    await notifyUser(env, task.assigned_to, {
      title: `📋 Tarea para hoy — ${task.group_name}`,
      body: `"${task.title}" vence hoy. ¡No te olvides!`,
      data: { type: 'task_due_today', task_id: task.id, group_id: task.group_id },
    });
  }

  // 3. Recurring expenses due soon (within next 3 days)
  const recurringExpenses = await env.DB.prepare(`
    SELECT e.id, e.title, e.amount, e.currency, e.group_id, e.recurring_period, e.next_due_date,
      g.name as group_name
    FROM expenses e
    JOIN groups g ON e.group_id = g.id
    WHERE e.is_recurring = 1
      AND e.next_due_date IS NOT NULL
      AND date(e.next_due_date) <= date('now', '+3 days')
      AND date(e.next_due_date) >= date('now')
  `).all<{
    id: string; title: string; amount: number; currency: string;
    group_id: string; recurring_period: string; next_due_date: string; group_name: string;
  }>();

  for (const expense of recurringExpenses.results) {
    // Get all members of the group
    const members = await env.DB.prepare(
      'SELECT user_id FROM group_members WHERE group_id = ?'
    ).bind(expense.group_id).all<{ user_id: string }>();

    const dueDate = new Date(expense.next_due_date);
    const daysUntil = Math.floor((dueDate.getTime() - now.getTime()) / 86400000);
    const amountStr = new Intl.NumberFormat('es-ES', { style: 'currency', currency: expense.currency }).format(expense.amount);

    for (const member of members.results) {
      await notifyUser(env, member.user_id, {
        title: `💰 Pago recurrente próximo — ${expense.group_name}`,
        body: `"${expense.title}" (${amountStr}) vence ${daysUntil === 0 ? 'hoy' : `en ${daysUntil} día${daysUntil > 1 ? 's' : ''}`}`,
        data: { type: 'recurring_expense', expense_id: expense.id, group_id: expense.group_id },
      });
    }
  }

  console.log(`Cron done: ${overdueTasks.results.length} overdue, ${dueTodayTasks.results.length} due today, ${recurringExpenses.results.length} recurring`);
}

/**
 * Send push notifications to all subscriptions of a user
 */
async function notifyUser(
  env: Env,
  userId: string,
  payload: { title: string; body: string; data?: unknown }
) {
  const subs = await env.DB.prepare(
    'SELECT endpoint, p256dh, auth_key FROM push_subscriptions WHERE user_id = ?'
  ).bind(userId).all<{ endpoint: string; p256dh: string; auth_key: string }>();

  const fullPayload = {
    ...payload,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  };

  for (const sub of subs.results) {
    const success = await sendPushNotification(env, sub.endpoint, sub.p256dh, sub.auth_key, fullPayload);
    if (!success) {
      // Remove dead subscriptions (expired/unsubscribed)
      await env.DB.prepare(
        'DELETE FROM push_subscriptions WHERE endpoint = ?'
      ).bind(sub.endpoint).run();
    }
  }
}

export { notifyUser };
export default notifications;
