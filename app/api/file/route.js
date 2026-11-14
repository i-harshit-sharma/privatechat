import crypto from 'node:crypto';
import store from '@/lib/store';
import { ID_RE, MID_RE, MAX_FILE, FILE_TTL, userKey, pairKey, fileKey, push, owns, validCreds, json, fail, badRequest, route } from '@/lib/relay';

export const dynamic = 'force-dynamic';

// Upload a file for a connected peer. Held until they fetch it, at most FILE_TTL.
export const POST = route(async (request) => {
  const h = (name) => request.headers.get(name);
  const id = h('x-id');
  const secret = h('x-secret');
  const to = h('x-to');
  if (!validCreds(id, secret) || !ID_RE.test(to || '')) return badRequest();
  if (Number(h('content-length') || 0) > MAX_FILE) return fail(413, 'too large');

  const data = Buffer.from(await request.arrayBuffer());
  if (data.length > MAX_FILE) return fail(413, 'too large');
  if (!data.length) return badRequest();

  let name = 'file';
  try {
    name = decodeURIComponent(h('x-file-name') || '').slice(0, 200) || 'file';
  } catch {}
  const mime = (h('x-file-type') || '').slice(0, 100);

  const [me, them, paired] = await Promise.all([
    store.get(userKey(id)),
    store.get(userKey(to)),
    store.exists(pairKey(id, to)),
  ]);
  if (!owns(me, secret)) return fail(401, 'expired');
  if (!them) return fail(404, 'offline');
  if (!paired) return fail(403, 'not connected');

  const fileId = crypto.randomUUID();
  await store.set(fileKey(to, fileId), data.toString('base64'), { ex: FILE_TTL });
  const event = { type: 'file', from: id, fileId, name, mime, size: data.length };
  if (MID_RE.test(h('x-mid') || '')) event.mid = h('x-mid');
  await push(to, event);
  return json({ ok: true });
});
