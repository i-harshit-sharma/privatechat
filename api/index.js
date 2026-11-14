// PrivateChat relay. Clients poll; the server only passes events along.
// Nothing is logged or kept: every key has a short TTL and inbox events and
// files are deleted the moment the recipient picks them up.

const crypto = require('crypto');
const express = require('express');
const store = require('../lib/store');

const PRESENCE_TTL = 30; // seconds without a poll before a user is gone (grace period)
const INBOX_TTL = 60; // undelivered events expire
const REQUEST_TTL = 120; // unanswered chat requests expire
const PAIR_TTL = 86400;
const FILE_TTL = 60; // undelivered files expire
const MAX_FILE = 3 * 1024 * 1024;
const MAX_TEXT = 4000;
const MAX_NAME = 24;
const MAX_PEERS = 20;

const ID_RE = /^[A-HJKMNP-Z2-9]{8}$/;
const SECRET_RE = /^[a-f0-9]{32}$/;
const FILE_ID_RE = /^[a-f0-9-]{36}$/;
const MID_RE = /^[a-f0-9]{12}$/; // client-generated message id, used for receipts

const userKey = (id) => `u:${id}`;
const inboxKey = (id) => `in:${id}`;
const requestKey = (from, to) => `r:${from}:${to}`;
const pairKey = (a, b) => `p:${[a, b].sort().join(':')}`;
const fileKey = (to, fileId) => `f:${to}:${fileId}`;

const hash = (secret) => crypto.createHash('sha256').update(secret).digest('hex');
const presence = (secret) => `${hash(secret)}|${Date.now()}`;
const validCreds = (id, secret) => ID_RE.test(id || '') && SECRET_RE.test(secret || '');
// A presence value is "<secret hash>|<last poll ms>".
const owns = (value, secret) => !!value && value.split('|')[0] === hash(secret);

const push = (to, event) =>
  Promise.all([store.rpush(inboxKey(to), JSON.stringify(event)), store.expire(inboxKey(to), INBOX_TTL)]);

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

const app = express();
app.disable('x-powered-by');

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (process.env.VERCEL && store.kind !== 'redis') {
    return res.status(503).json({ error: 'PR_REDIS_URL is not set for this deployment.' });
  }
  next();
});
app.use('/api', express.json({ limit: '16kb' }));

// Claim an ID. The secret proves ownership on every later call.
app.post('/api/register', wrap(async (req, res) => {
  const { id, secret } = req.body || {};
  if (!validCreds(id, secret)) return res.status(400).json({ error: 'bad request' });
  const ok = await store.set(userKey(id), presence(secret), { nx: true, ex: PRESENCE_TTL });
  if (!ok && !owns(await store.get(userKey(id)), secret)) return res.status(409).json({ error: 'taken' });
  res.json({ ok: true });
}));

// Heartbeat + collect pending events + report whether each peer is still around.
app.post('/api/poll', wrap(async (req, res) => {
  const { id, secret } = req.body || {};
  if (!validCreds(id, secret)) return res.status(400).json({ error: 'bad request' });
  const peers = (Array.isArray(req.body.peers) ? req.body.peers : [])
    .filter((p) => ID_RE.test(p))
    .slice(0, MAX_PEERS);

  if (!owns(await store.get(userKey(id)), secret)) return res.status(401).json({ error: 'expired' });

  const [, raw, seen] = await Promise.all([
    store.set(userKey(id), presence(secret), { ex: PRESENCE_TTL }),
    store.lpop(inboxKey(id), 50),
    peers.length ? store.mget(peers.map(userKey)) : [],
  ]);

  const now = Date.now();
  const status = {};
  // Milliseconds since the peer last polled, or null if they are gone.
  peers.forEach((p, i) => {
    status[p] = seen[i] ? Math.max(0, now - Number(seen[i].split('|')[1])) : null;
  });
  res.json({ events: (raw || []).map((e) => JSON.parse(e)), peers: status });
}));

// request / accept / reject / msg / leave
app.post('/api/send', wrap(async (req, res) => {
  const { id, secret, to, type, text, mid, mids } = req.body || {};
  if (!validCreds(id, secret) || !ID_RE.test(to || '') || to === id) {
    return res.status(400).json({ error: 'bad request' });
  }
  // Display name, required when asking for or accepting a chat.
  const rawName = req.body.name;
  const name =
    typeof rawName === 'string' ? rawName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME) : '';
  if ((type === 'request' || type === 'accept') && !name) return res.status(400).json({ error: 'name required' });
  const [me, them] = await store.mget([userKey(id), userKey(to)]);
  if (!owns(me, secret)) return res.status(401).json({ error: 'expired' });
  if (!them) return res.status(404).json({ error: 'offline' });

  if (type === 'request') {
    await store.set(requestKey(id, to), '1', { ex: REQUEST_TTL });
  } else if (type === 'accept') {
    // Only valid in answer to a request the other user actually made.
    if (!(await store.getdel(requestKey(to, id)))) return res.status(403).json({ error: 'no request' });
    await store.set(pairKey(id, to), '1', { ex: PAIR_TTL });
  } else if (type === 'reject') {
    await store.del(requestKey(to, id));
  } else if (type === 'leave') {
    await store.del(pairKey(id, to), requestKey(id, to), requestKey(to, id));
  } else if (type === 'msg') {
    if (typeof text !== 'string' || !text || text.length > MAX_TEXT) {
      return res.status(400).json({ error: 'bad request' });
    }
    if (!(await store.exists(pairKey(id, to)))) return res.status(403).json({ error: 'not connected' });
  } else if (type === 'ack' || type === 'seen') {
    // Delivery receipts: the recipient's browser got (ack) or showed (seen) these messages.
    if (!Array.isArray(mids) || !mids.length || mids.length > 500 || !mids.every((m) => MID_RE.test(m))) {
      return res.status(400).json({ error: 'bad request' });
    }
    if (!(await store.exists(pairKey(id, to)))) return res.status(403).json({ error: 'not connected' });
  } else {
    return res.status(400).json({ error: 'bad request' });
  }

  const event = { type, from: id };
  if (type === 'msg') event.text = text;
  if (type === 'msg' && MID_RE.test(mid)) event.mid = mid;
  if (type === 'ack' || type === 'seen') event.mids = mids;
  if (type === 'request' || type === 'accept') event.name = name;
  await push(to, event);
  res.json({ ok: true });
}));

// Upload a file for a connected peer. Held until they fetch it, at most FILE_TTL.
app.post(
  '/api/file',
  express.raw({ type: 'application/octet-stream', limit: MAX_FILE }),
  wrap(async (req, res) => {
    const id = req.get('x-id');
    const secret = req.get('x-secret');
    const to = req.get('x-to');
    if (!validCreds(id, secret) || !ID_RE.test(to || '') || !Buffer.isBuffer(req.body) || !req.body.length) {
      return res.status(400).json({ error: 'bad request' });
    }
    let name = 'file';
    try {
      name = decodeURIComponent(req.get('x-file-name') || '').slice(0, 200) || 'file';
    } catch {}
    const mime = (req.get('x-file-type') || '').slice(0, 100);

    const [me, them, paired] = await Promise.all([
      store.get(userKey(id)),
      store.get(userKey(to)),
      store.exists(pairKey(id, to)),
    ]);
    if (!owns(me, secret)) return res.status(401).json({ error: 'expired' });
    if (!them) return res.status(404).json({ error: 'offline' });
    if (!paired) return res.status(403).json({ error: 'not connected' });

    const fileId = crypto.randomUUID();
    await store.set(fileKey(to, fileId), req.body.toString('base64'), { ex: FILE_TTL });
    const event = { type: 'file', from: id, fileId, name, mime, size: req.body.length };
    if (MID_RE.test(req.get('x-mid') || '')) event.mid = req.get('x-mid');
    await push(to, event);
    res.json({ ok: true });
  })
);

// Fetch a file once; it is deleted as it is read.
app.get('/api/file/:fileId', wrap(async (req, res) => {
  const id = req.get('x-id');
  const secret = req.get('x-secret');
  if (!validCreds(id, secret) || !FILE_ID_RE.test(req.params.fileId)) {
    return res.status(400).json({ error: 'bad request' });
  }
  if (!owns(await store.get(userKey(id)), secret)) return res.status(401).json({ error: 'expired' });
  const data = await store.getdel(fileKey(id, req.params.fileId));
  if (!data) return res.status(404).json({ error: 'gone' });
  res.type('application/octet-stream').send(Buffer.from(data, 'base64'));
}));

// Tab closed: drop presence and anything still queued right away.
app.post('/api/bye', wrap(async (req, res) => {
  const { id, secret } = req.body || {};
  if (validCreds(id, secret) && owns(await store.get(userKey(id)), secret)) {
    await store.del(userKey(id), inboxKey(id));
  }
  res.json({ ok: true });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad request' });
  console.error(err.message);
  res.status(500).json({ error: 'server error' });
});

module.exports = app;
