import store from '@/lib/store';
import {
  ID_RE, MID_RE, MAX_NAME, MAX_TEXT, REQUEST_TTL, PAIR_TTL,
  userKey, requestKey, pairKey, push, owns, validCreds, json, fail, badRequest, route, readJson,
} from '@/lib/relay';

export const dynamic = 'force-dynamic';

// request / accept / reject / msg / leave / ack / seen
export const POST = route(async (request) => {
  const { body, res } = await readJson(request);
  if (res) return res;
  const { id, secret, to, type, text, mid, mids } = body;
  if (!validCreds(id, secret) || !ID_RE.test(to || '') || to === id) return badRequest();

  // Display name, required when asking for or accepting a chat.
  const rawName = body.name;
  const name =
    typeof rawName === 'string' ? rawName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME) : '';
  if ((type === 'request' || type === 'accept') && !name) return fail(400, 'name required');

  const [me, them] = await store.mget([userKey(id), userKey(to)]);
  if (!owns(me, secret)) return fail(401, 'expired');
  if (!them) return fail(404, 'offline');

  if (type === 'request') {
    await store.set(requestKey(id, to), '1', { ex: REQUEST_TTL });
  } else if (type === 'accept') {
    // Only valid in answer to a request the other user actually made.
    if (!(await store.getdel(requestKey(to, id)))) return fail(403, 'no request');
    await store.set(pairKey(id, to), '1', { ex: PAIR_TTL });
  } else if (type === 'reject') {
    await store.del(requestKey(to, id));
  } else if (type === 'leave') {
    await store.del(pairKey(id, to), requestKey(id, to), requestKey(to, id));
  } else if (type === 'msg') {
    if (typeof text !== 'string' || !text || text.length > MAX_TEXT) return badRequest();
    if (!(await store.exists(pairKey(id, to)))) return fail(403, 'not connected');
  } else if (type === 'ack' || type === 'seen') {
    // Delivery receipts: the browser got (ack) or showed (seen) these messages.
    if (!Array.isArray(mids) || !mids.length || mids.length > 500 || !mids.every((m) => MID_RE.test(m))) {
      return badRequest();
    }
    if (!(await store.exists(pairKey(id, to)))) return fail(403, 'not connected');
  } else {
    return badRequest();
  }

  const event = { type, from: id };
  if (type === 'msg') event.text = text;
  if (type === 'msg' && MID_RE.test(mid)) event.mid = mid;
  if (type === 'ack' || type === 'seen') event.mids = mids;
  if (type === 'request' || type === 'accept') event.name = name;
  await push(to, event);
  return json({ ok: true });
});
