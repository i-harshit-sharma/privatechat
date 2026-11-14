// Transient key/value store for in-flight data. Everything written here has
// a short TTL and is deleted on delivery.
//
// With PR_REDIS_URL set (the Upstash Redis connection string, rediss://...,
// injected by the Vercel integration under the "PR" prefix) it uses Redis.
// That is required on Vercel, where function instances share no memory.
// Without it, it falls back to process memory, which is only correct for a
// single local process.

const url = process.env.PR_REDIS_URL;

function redisStore() {
  const Redis = require('ioredis');
  // One connection per function instance, reused across requests. Concurrent
  // calls are auto-pipelined into one round trip.
  const r = new Redis(url, { enableAutoPipelining: true, maxRetriesPerRequest: 2 });
  r.on('error', (err) => console.error('redis:', err.message));
  return {
    kind: 'redis',
    get: (k) => r.get(k),
    set: (k, v, { ex, nx } = {}) => r.set(k, v, ...(ex ? ['EX', ex] : []), ...(nx ? ['NX'] : [])),
    del: (...keys) => r.del(...keys),
    getdel: (k) => r.getdel(k),
    mget: (keys) => r.mget(...keys),
    exists: (k) => r.exists(k),
    rpush: (k, v) => r.rpush(k, v),
    lpop: (k, count) => r.lpop(k, count),
    expire: (k, sec) => r.expire(k, sec),
  };
}

function memoryStore() {
  const data = new Map(); // key -> { v, exp }
  const live = (k) => {
    const e = data.get(k);
    if (e && e.exp <= Date.now()) {
      data.delete(k);
      return undefined;
    }
    return e;
  };
  setInterval(() => {
    for (const k of data.keys()) live(k);
  }, 10000).unref();

  return {
    kind: 'memory',
    async get(k) {
      const e = live(k);
      return e ? e.v : null;
    },
    async set(k, v, { ex, nx } = {}) {
      if (nx && live(k)) return null;
      data.set(k, { v, exp: ex ? Date.now() + ex * 1000 : Infinity });
      return 'OK';
    },
    async del(...keys) {
      keys.forEach((k) => data.delete(k));
    },
    async getdel(k) {
      const e = live(k);
      data.delete(k);
      return e ? e.v : null;
    },
    async mget(keys) {
      return keys.map((k) => {
        const e = live(k);
        return e ? e.v : null;
      });
    },
    async exists(k) {
      return live(k) ? 1 : 0;
    },
    async rpush(k, v) {
      const e = live(k);
      if (e) e.v.push(v);
      else data.set(k, { v: [v], exp: Infinity });
    },
    async lpop(k, count) {
      const e = live(k);
      if (!e) return null;
      const out = e.v.splice(0, count);
      if (!e.v.length) data.delete(k);
      return out;
    },
    async expire(k, sec) {
      const e = live(k);
      if (e) e.exp = Date.now() + sec * 1000;
    },
  };
}

module.exports = url ? redisStore() : memoryStore();
