import store from '@/lib/store';
import { userKey, inboxKey, owns, validCreds, json, route, readJson } from '@/lib/relay';

export const dynamic = 'force-dynamic';

// Tab closed: drop presence and anything still queued right away.
export const POST = route(async (request) => {
  const { body } = await readJson(request);
  const { id, secret } = body || {};
  if (validCreds(id, secret) && owns(await store.get(userKey(id)), secret)) {
    await store.del(userKey(id), inboxKey(id));
  }
  return json({ ok: true });
});
