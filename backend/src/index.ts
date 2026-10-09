import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import authRoutes from './routes/auth';
import groupRoutes from './routes/groups';
import expenseRoutes from './routes/expenses';
import noteRoutes from './routes/notes';
import taskRoutes from './routes/tasks';
import notificationRoutes, { handleCron } from './routes/notifications';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', cors({
  origin: (origin, c) => {
    const allowed = [
      c.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:4173',
    ];
    return allowed.includes(origin) ? origin : allowed[0];
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({
  name: 'Ayni API',
  version: '1.0.0',
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

// Routes
app.route('/auth', authRoutes);
app.route('/api/groups', groupRoutes);
app.route('/api', expenseRoutes);
app.route('/api', noteRoutes);
app.route('/api', taskRoutes);
app.route('/api/notifications', notificationRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error', message: err.message }, 500);
});

// ── Cloudflare Workers exports ─────────────────────────────────
export default {
  // HTTP handler
  fetch: app.fetch,

  // Cron scheduled handler (runs at 8:00 and 20:00 every day)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleCron(env));
  },
};
