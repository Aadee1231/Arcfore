import { createClerkClient, verifyToken } from '@clerk/backend';
import { createMiddleware } from 'hono/factory';
import { env } from './env.js';

export interface AuthContext {
  userId: string;
}

const clerk = env.clerkSecretKey
  ? createClerkClient({ secretKey: env.clerkSecretKey })
  : null;

/**
 * Verifies the Clerk session JWT carried as `Authorization: Bearer <token>`.
 * Dev escape hatch: `x-dev-user-id` when ALLOW_DEV_AUTH=true (local testing only).
 */
export const requireAuth = createMiddleware<{ Variables: { auth: AuthContext } }>(
  async (c, next) => {
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token && env.allowDevAuth) {
      const devId = c.req.header('x-dev-user-id');
      if (devId) {
        c.set('auth', { userId: devId });
        return next();
      }
    }
    if (!token) {
      return c.json({ error: 'unauthorized', message: 'Missing session token' }, 401);
    }
    if (!clerk) {
      return c.json({ error: 'server_misconfigured', message: 'Auth not configured' }, 500);
    }
    try {
      const payload = await verifyToken(token, {
        secretKey: env.clerkSecretKey,
        // Supabase third-party tokens carry no audience; iss check is enforced by the secretKey.
      });
      const userId = payload.sub;
      if (!userId) throw new Error('no sub');
      c.set('auth', { userId });
      return next();
    } catch {
      return c.json({ error: 'unauthorized', message: 'Invalid or expired session token' }, 401);
    }
  },
);
