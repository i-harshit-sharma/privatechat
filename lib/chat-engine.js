// Client-side chat logic: session, polling, peers, messages, receipts, files.
// UI-agnostic. React subscribes to it with useSyncExternalStore: every change
// calls emit(), which bumps `version`. Peers and messages are mutated in place
// and the version is what tells React to render again.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0, 1
const ID_RE = /^[A-HJKMNP-Z2-9]{8}$/;
const POLL_MS = 1000;
const AWAY_MS = 6000; // peer has missed several polls
export const MAX_FILE = 3 * 1024 * 1024;
const PREVIEW = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export const MAX_NAME = 24;
export const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME);
export const fmt = (id) => `${id.slice(0, 4)}-${id.slice(4)}`;
export const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const tint = (id) => `var(--p${(id.charCodeAt(0) + id.charCodeAt(3)) % 4})`;
export const fmtSize = (n) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

const PEER_STATUS = {
  incoming: 'Wants to chat',
  outgoing: 'Waiting for them to accept…',
  ended: 'Chat ended',
};
export const peerStatus = (p) => PEER_STATUS[p.state] || (p.away ? 'Reconnecting…' : 'Connected');
export const peerStatusClass = (p) => (p.state === 'active' ? (p.away ? 'warn' : 'ok') : '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function randomId() {
  let out = '';
  while (out.length < 8) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < 248 && out.length < 8) out += ALPHABET[b % 31];
    }
  }
  return out;
}
const randomSecret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
const newMid = () => randomSecret().slice(0, 12);

export class ChatEngine {
  constructor() {
    this.version = 0;
    this.listeners = new Set();
    this.me = { id: '', secret: '' };
    this.peers = new Map(); // id -> { id, name, state: incoming|outgoing|active|ended, messages, unread, away }
    this.selected = null;
    this.status = { text: 'Connecting…', cls: '' };
    this.notice = '';
    this.run = 0;
    this.msgSeq = 0;
  }

  // ---------- store plumbing ----------

  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.version;
  emit() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  setStatus(text, cls = '') {
    this.status = { text, cls };
    this.emit();
  }
  setNotice(text) {
    this.notice = text;
    this.emit();
  }
  get unread() {
    let n = 0;
    for (const p of this.peers.values()) n += p.unread;
    return n;
  }
  get current() {
    return this.peers.get(this.selected) || null;
  }

  // ---------- network ----------

  async api(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: this.me.id, secret: this.me.secret, ...body }),
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  }
  send(to, type, extra) {
    return this.api('/api/send', { to, type, ...extra }).catch(() => ({ ok: false, status: 0 }));
  }

  // ---------- chat state ----------

  addMessage(p, m) {
    m.key = ++this.msgSeq;
    m.time = clock();
    p.messages.push(m);
    if (!m.mine && (this.selected !== p.id || document.hidden)) p.unread++;
    this.emit();
  }
  sys(p, text) {
    this.addMessage(p, { kind: 'sys', mine: true, text });
  }

  select(id) {
    const p = this.peers.get(id);
    if (!p) return;
    this.selected = id;
    p.unread = 0;
    this.emit();
    this.receipts(p);
  }
  back() {
    this.selected = null;
    this.emit();
  }

  drop(id) {
    this.peers.delete(id);
    if (this.selected === id) this.selected = null;
    this.emit();
  }

  end(p, text) {
    p.state = 'ended';
    p.away = false;
    this.sys(p, text);
  }

  async connect(raw, name) {
    const id = norm(raw);
    this.notice = '';
    if (!ID_RE.test(id)) return this.setNotice('Enter a valid 8-character ID.');
    if (id === this.me.id) return this.setNotice('That is your own ID.');
    const existing = this.peers.get(id);
    if (existing && existing.state === 'active') return this.select(id);
    if (existing && existing.state === 'incoming') return this.accept(id, name);
    if (existing && existing.state === 'outgoing') return this.setNotice('Already waiting for them to accept.');

    const r = await this.send(id, 'request', { name });
    if (r.status === 404) return this.setNotice('That ID is not online right now.');
    if (!r.ok) return this.setNotice('Could not send the request. Try again.');
    this.peers.set(id, { id, name: '', state: 'outgoing', messages: [], unread: 0, away: false });
    this.emit();
    return true; // request sent
  }

  async accept(id, name) {
    this.notice = '';
    const r = await this.send(id, 'accept', { name });
    const p = this.peers.get(id);
    if (!p) return;
    if (!r.ok) {
      this.drop(id);
      return this.setNotice(`${fmt(id)} is no longer available.`);
    }
    p.state = 'active';
    this.sys(p, 'Connected');
    this.select(id);
  }

  reject(id) {
    this.send(id, 'reject');
    this.drop(id);
  }

  leave(id) {
    const p = this.peers.get(id);
    if (!p) return;
    this.send(id, 'leave');
    if (p.state === 'active') this.end(p, 'You left the chat');
    else this.drop(id);
  }

  async sendText(raw) {
    const p = this.current;
    const text = raw.trim();
    if (!p || p.state !== 'active' || !text) return false;
    const m = { kind: 'text', mine: true, text, mid: newMid(), status: 'awaiting' };
    this.addMessage(p, m);
    const r = await this.send(p.id, 'msg', { text, mid: m.mid });
    // On success the status stays as it is: a receipt may already have arrived.
    if (!r.ok) {
      m.status = 'failed';
      this.emit();
    }
    return true;
  }

  async sendFile(file) {
    const p = this.current;
    if (!p || p.state !== 'active' || !file) return;
    if (file.size > MAX_FILE) return this.sys(p, `${file.name} is larger than 3 MB and was not sent`);
    if (!file.size) return this.sys(p, `${file.name} is empty and was not sent`);
    const m = {
      kind: 'file',
      mine: true,
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
      image: PREVIEW.has(file.type),
      mid: newMid(),
      status: 'awaiting',
    };
    this.addMessage(p, m);
    try {
      const res = await fetch('/api/file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-id': this.me.id,
          'x-secret': this.me.secret,
          'x-to': p.id,
          'x-file-name': encodeURIComponent(file.name),
          'x-file-type': file.type,
          'x-mid': m.mid,
        },
        body: file,
      });
      if (!res.ok) m.status = 'failed';
    } catch {
      m.status = 'failed';
    }
    this.emit();
  }

  // Tell the sender which of their messages reached this browser (ack) and
  // which were actually on screen (seen: this chat open and the tab visible).
  receipts(p) {
    if (p.state !== 'active') return;
    const viewing = this.selected === p.id && !document.hidden;
    const seen = [];
    const ack = [];
    for (const m of p.messages) {
      if (m.mine || !m.mid || m.receipt === 'seen') continue;
      if (viewing) {
        seen.push(m.mid);
        m.receipt = 'seen';
      } else if (!m.receipt) {
        ack.push(m.mid);
        m.receipt = 'ack';
      }
    }
    if (seen.length) this.send(p.id, 'seen', { mids: seen.slice(-500) });
    if (ack.length) this.send(p.id, 'ack', { mids: ack.slice(-500) });
  }

  // The server deletes the file as we read it, so fetch it straight away.
  async receiveFile(p, ev) {
    const m = { kind: 'file', mine: false, name: ev.name, size: ev.size, url: '', image: PREVIEW.has(ev.mime) };
    try {
      const res = await fetch(`/api/file/${ev.fileId}`, { headers: { 'x-id': this.me.id, 'x-secret': this.me.secret } });
      if (res.ok) {
        const blob = new Blob([await res.arrayBuffer()], { type: m.image ? ev.mime : 'application/octet-stream' });
        m.url = URL.createObjectURL(blob);
        m.mid = ev.mid; // only acknowledge files that actually arrived
      }
    } catch {}
    this.addMessage(p, m);
    this.receipts(p);
  }

  handle(ev) {
    const p = this.peers.get(ev.from);
    switch (ev.type) {
      case 'request':
        if (p && p.state === 'active') break;
        this.peers.set(ev.from, {
          id: ev.from,
          name: cleanName(ev.name),
          state: 'incoming',
          messages: [],
          unread: 0,
          away: false,
        });
        if (this.selected === ev.from) this.selected = null;
        this.emit();
        break;
      case 'accept':
        if (p && p.state === 'outgoing') {
          p.state = 'active';
          p.name = cleanName(ev.name);
          this.sys(p, 'Connected');
          if (!this.selected) this.select(p.id);
        }
        break;
      case 'reject':
        if (p && p.state === 'outgoing') {
          this.drop(p.id);
          this.setNotice(`${fmt(ev.from)} declined your request.`);
        }
        break;
      case 'leave':
        if (p && p.state === 'active') this.end(p, 'They left the chat');
        else if (p && p.state !== 'ended') this.drop(p.id);
        break;
      case 'msg':
        if (p && p.state === 'active') {
          this.addMessage(p, { kind: 'text', mine: false, text: String(ev.text), mid: ev.mid });
          this.receipts(p);
        }
        break;
      case 'ack':
      case 'seen':
        if (p && Array.isArray(ev.mids)) {
          const next = ev.type === 'seen' ? 'seen' : 'received';
          for (const m of p.messages) {
            if (m.mine && ev.mids.includes(m.mid) && m.status !== 'seen' && m.status !== 'failed') m.status = next;
          }
          this.emit();
        }
        break;
      case 'file':
        if (p && p.state === 'active') this.receiveFile(p, ev);
        break;
    }
  }

  // ---------- session + polling ----------

  async register(run) {
    while (this.run === run) {
      try {
        const r = await this.api('/api/register');
        if (r.ok) break;
        if (r.status === 409) this.me.id = randomId();
        else if (r.status === 503) this.setStatus('Server not configured', 'bad');
        else this.setStatus('Reconnecting…', 'warn');
        if (r.status !== 409) await sleep(2000);
      } catch {
        this.setStatus('Reconnecting…', 'warn');
        await sleep(2000);
      }
    }
    if (this.run === run) this.setStatus('Online', 'ok');
  }

  // We were away longer than the grace period, so the server forgot us.
  async sessionLost(run) {
    for (const p of [...this.peers.values()]) {
      if (p.state === 'active') this.end(p, 'Connection was lost for too long. Chat ended.');
      else if (p.state !== 'ended') this.drop(p.id);
    }
    await this.register(run);
  }

  async poll(run) {
    while (this.run === run) {
      try {
        const ids = [...this.peers.values()].filter((p) => p.state !== 'ended').map((p) => p.id);
        const r = await this.api('/api/poll', { peers: ids });
        if (this.run !== run) return;
        if (r.status === 401) {
          await this.sessionLost(run);
        } else if (!r.ok) {
          this.setStatus('Reconnecting…', 'warn');
        } else {
          this.setStatus('Online', 'ok');
          r.data.events.forEach((ev) => this.handle(ev));
          let changed = false;
          for (const [id, age] of Object.entries(r.data.peers)) {
            const p = this.peers.get(id);
            if (!p || p.state === 'ended') continue;
            if (age === null) {
              if (p.state === 'active') this.end(p, 'They went offline. Chat ended.');
              else this.drop(id);
            } else if (p.away !== age > AWAY_MS) {
              p.away = age > AWAY_MS;
              changed = true;
            }
          }
          if (changed) this.emit();
        }
      } catch {
        if (this.run === run) this.setStatus('Reconnecting…', 'warn');
      }
      await sleep(POLL_MS);
    }
  }

  onVisibility = () => {
    const p = this.current;
    if (document.hidden || !p) return;
    if (p.unread) {
      p.unread = 0;
      this.emit();
    }
    this.receipts(p);
  };

  // Closing or refreshing ends the session immediately for everyone we talk to.
  bye = () => {
    if (!this.me.id) return;
    navigator.sendBeacon('/api/bye', new Blob([JSON.stringify(this.me)], { type: 'application/json' }));
  };

  /** Start a fresh session. Returns a function that stops it. */
  start() {
    const run = ++this.run;
    this.me = { id: randomId(), secret: randomSecret() };
    this.peers.clear();
    this.selected = null;
    this.notice = '';
    this.setStatus('Connecting…');
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.bye);
    this.register(run).then(() => this.poll(run));
    return () => {
      this.run++; // stops the loops
      document.removeEventListener('visibilitychange', this.onVisibility);
      window.removeEventListener('pagehide', this.bye);
      this.bye();
    };
  }
}
