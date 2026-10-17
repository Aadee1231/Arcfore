import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { identifyClient } from './auth.js';
import { env } from './env.js';
import { aiBudgetMode } from './ratelimit.js';
import { aiRouter } from './routes/ai.js';
import { coursesRouter } from './routes/courses.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: env.corsOrigins === '*' ? '*' : env.corsOrigins.split(','),
    allowHeaders: ['Authorization', 'Content-Type', 'x-device-id', 'x-arcfore-key'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/v1/health', (c) =>
  c.json({
    ok: true,
    service: 'arcfore-api',
    providers: {
      gca: Boolean(env.gcaApiKey),
      openai: Boolean(env.openaiApiKey),
      clerk: Boolean(env.clerkSecretKey),
    },
    aiProtection: aiBudgetMode(),
  }),
);

app.use('/v1/courses/*', identifyClient);
app.use('/v1/courses', identifyClient);
app.route('/v1/courses', coursesRouter);

app.use('/v1/ai/*', identifyClient);
app.route('/v1/ai', aiRouter);

app.notFound((c) => c.json({ error: 'not_found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal', message: 'Something went wrong' }, 500);
});

// Vercel imports the default export and serves it as a function — never bind a
// port there (or under tests). Locally (`npm run dev`/`npm start`) this still
// starts the Node server on PORT.
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
  const port = env.port;
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`arcfore-api listening on :${info.port}`);
  });
}

export default app;
