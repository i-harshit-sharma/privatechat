import store from '@/lib/store';
import { PRESENCE_TTL, userKey, presence, owns, validCreds, json, fail, badRequest, route, readJson } from '@/lib/relay';

export const dynamic = 'force-dynamic';

// Claim an ID. The secret proves ownership on every later call.
export const POST = route(async (request) => {
  const { body, res } = await readJson(request);
  if (res) return res;
  const { id, secret } = body;
  if (!validCreds(id, secret)) return badRequest();
  const ok = await store.set(userKey(id), presence(secret), { nx: true, ex: PRESENCE_TTL });
  if (!ok && !owns(await store.get(userKey(id)), secret)) return fail(409, 'taken');
  return json({ ok: true });
});
