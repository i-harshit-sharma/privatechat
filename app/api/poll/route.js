import store from '@/lib/store';
import { ID_RE, MAX_PEERS, PRESENCE_TTL, userKey, inboxKey, presence, owns, validCreds, json, fail, badRequest, route, readJson } from '@/lib/relay';

export const dynamic = 'force-dynamic';

// Heartbeat + collect pending events + report whether each peer is still around.
export const POST = route(async (request) => {
  const { body, res } = await readJson(request);
  if (res) return res;
  const { id, secret } = body;
  if (!validCreds(id, secret)) return badRequest();
  const peers = (Array.isArray(body.peers) ? body.peers : []).filter((p) => ID_RE.test(p)).slice(0, MAX_PEERS);

  if (!owns(await store.get(userKey(id)), secret)) return fail(401, 'expired');

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
  return json({ events: (raw || []).map((e) => JSON.parse(e)), peers: status });
});
