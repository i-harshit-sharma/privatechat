import store from '@/lib/store';
import { FILE_ID_RE, userKey, fileKey, owns, validCreds, fail, badRequest, route } from '@/lib/relay';

export const dynamic = 'force-dynamic';

// Fetch a file once; it is deleted as it is read.
export const GET = route(async (request, { params }) => {
  const { fileId } = await params;
  const id = request.headers.get('x-id');
  const secret = request.headers.get('x-secret');
  if (!validCreds(id, secret) || !FILE_ID_RE.test(fileId)) return badRequest();
  if (!owns(await store.get(userKey(id)), secret)) return fail(401, 'expired');
  const data = await store.getdel(fileKey(id, fileId));
  if (!data) return fail(404, 'gone');
  return new Response(Buffer.from(data, 'base64'), {
    headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' },
  });
});
