// Shared pieces of the PrivateChat relay. Clients poll; the server only passes
// events along. Nothing is logged or kept: every key has a short TTL and inbox
// events and files are deleted the moment the recipient picks them up.

import crypto from 'node:crypto';
import store from './store';

export const PRESENCE_TTL = 30; // seconds without a poll before a user is gone (grace period)
export const INBOX_TTL = 60; // undelivered events expire
export const REQUEST_TTL = 120; // unanswered chat requests expire
export const PAIR_TTL = 86400;
export const FILE_TTL = 60; // undelivered files expire
export const MAX_FILE = 3 * 1024 * 1024;
export const MAX_TEXT = 4000;
export const MAX_NAME = 24;
export const MAX_PEERS = 20;
export const MAX_JSON = 16 * 1024;

export const ID_RE = /^[A-HJKMNP-Z2-9]{8}$/;
export const SECRET_RE = /^[a-f0-9]{32}$/;
export const FILE_ID_RE = /^[a-f0-9-]{36}$/;
export const MID_RE = /^[a-f0-9]{12}$/; // client-generated message id, used for receipts

export const userKey = (id) => `u:${id}`;
export const inboxKey = (id) => `in:${id}`;
export const requestKey = (from, to) => `r:${from}:${to}`;
export const pairKey = (a, b) => `p:${[a, b].sort().join(':')}`;
export const fileKey = (to, fileId) => `f:${to}:${fileId}`;

const hash = (secret) => crypto.createHash('sha256').update(secret).digest('hex');
export const presence = (secret) => `${hash(secret)}|${Date.now()}`;
export const validCreds = (id, secret) => ID_RE.test(id || '') && SECRET_RE.test(secret || '');
// A presence value is "<secret hash>|<last poll ms>".
export const owns = (value, secret) => !!value && value.split('|')[0] === hash(secret);

export const push = (to, event) =>
  Promise.all([store.rpush(inboxKey(to), JSON.stringify(event)), store.expire(inboxKey(to), INBOX_TTL)]);

const NO_STORE = { 'Cache-Control': 'no-store' };

export const json = (body, status = 200) => Response.json(body, { status, headers: NO_STORE });
export const fail = (status, error) => json({ error }, status);
export const badRequest = () => fail(400, 'bad request');

/**
 * Wrap a route handler: refuse to run on Vercel without Redis (instances share
 * no memory there), and turn thrown errors into a generic 500.
 */
export const route = (handler) => async (request, ctx) => {
  if (process.env.VERCEL && store.kind !== 'redis') {
    return fail(503, 'PR_REDIS_URL is not set for this deployment.');
  }
  try {
    return await handler(request, ctx);
  } catch (err) {
    console.error(err.message);
    return fail(500, 'server error');
  }
};

/** Read a small JSON body. Returns { body } or { res } with the error response. */
export async function readJson(request) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_JSON) return { res: fail(413, 'too large') };
  let text;
  try {
    text = await request.text();
  } catch {
    return { res: badRequest() };
  }
  if (text.length > MAX_JSON) return { res: fail(413, 'too large') };
  try {
    const body = JSON.parse(text);
    return { body: body && typeof body === 'object' ? body : {} };
  } catch {
    return { res: badRequest() };
  }
}
