import { Hono } from 'hono';
import { Env, User } from '../types';
import { createSession, generateId } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env }>();

// Google OAuth - Step 1: Redirect to Google
auth.get('/google', (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return c.json({ error: 'Google OAuth not configured' }, 500);
  }

  const redirectUri = `${new URL(c.req.url).origin}/auth/google/callback`;
  const scope = 'openid email profile';
  const state = crypto.randomUUID();

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', scope);
  googleAuthUrl.searchParams.set('state', state);
  googleAuthUrl.searchParams.set('access_type', 'offline');

  return c.redirect(googleAuthUrl.toString());
});

// Google OAuth - Step 2: Handle callback
auth.get('/google/callback', async (c) => {
  const { code, error } = c.req.query();
  const frontendUrl = c.env.FRONTEND_URL;

  if (error || !code) {
    return c.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }

  try {
    const redirectUri = `${new URL(c.req.url).origin}/auth/google/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID || '',
        client_secret: c.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json() as { access_token: string; error?: string };
    if (tokens.error || !tokens.access_token) {
      return c.redirect(`${frontendUrl}/login?error=token_failed`);
    }

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userResponse.json() as {
      sub: string; email: string; name: string; picture: string;
    };

    // Upsert user in DB by email
    const existingUser = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(googleUser.email).first<User>();

    let userId: string;
    if (existingUser) {
      // Update user info and provider if it was pending (or just update name/avatar)
      await c.env.DB.prepare(
        'UPDATE users SET name = ?, avatar_url = ?, provider = ?, provider_id = ? WHERE id = ?'
      ).bind(googleUser.name, googleUser.picture, 'google', googleUser.sub, existingUser.id).run();
      userId = existingUser.id;
    } else {
      // Create new user
      userId = generateId();
      await c.env.DB.prepare(
        'INSERT INTO users (id, email, name, avatar_url, provider, provider_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(userId, googleUser.email, googleUser.name, googleUser.picture, 'google', googleUser.sub).run();
    }

    // Create session
    const sessionId = await createSession(c.env.DB, userId);

    // Redirect to frontend with session
    const response = c.redirect(`${frontendUrl}/auth/callback?session=${sessionId}`);
    return response;
  } catch (err) {
    console.error('OAuth error:', err);
    return c.redirect(`${frontendUrl}/login?error=server_error`);
  }
});

// Get current user
auth.get('/me', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!sessionId) return c.json({ error: 'No session' }, 401);

  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first();

  if (!session) return c.json({ error: 'Invalid or expired session' }, 401);

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?'
  ).bind((session as { user_id: string }).user_id).first<User>();

  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json({ user });
});

// Logout
auth.post('/logout', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '');
  if (sessionId) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  }
  return c.json({ success: true });
});

export default auth;
