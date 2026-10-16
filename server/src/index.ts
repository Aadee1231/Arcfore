import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './env.js';
import { requireAuth } from './auth.js';
import { coursesRouter } from './routes/courses.js';
import { aiRouter } from './routes/ai.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: env.corsOrigins === '*' ? '*' : env.corsOrigins.split(','),
    allowHeaders: ['Authorization', 'Content-Type', 'x-dev-user-id'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/v1/health', (c) =>
  c.json({
    ok: true,
    service: 'arcfore-api',
    providers: {
      gca: Boolean(env.gcaApiKey),
      gemini: Boolean(env.geminiApiKey),
      supabase: Boolean(env.supabaseUrl && env.supabaseServiceKey),
      clerk: Boolean(env.clerkSecretKey),
    },
  }),
);

app.use('/v1/courses/*', requireAuth);
app.use('/v1/courses', requireAuth);
app.route('/v1/courses', coursesRouter);

app.use('/v1/ai/*', requireAuth);
app.route('/v1/ai', aiRouter);

app.notFound((c) => c.json({ error: 'not_found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal', message: 'Something went wrong' }, 500);
});

const port = env.port;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`arcfore-api listening on :${info.port}`);
});

export default app;
