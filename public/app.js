(() => {
  'use strict';

  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0, 1
  const ID_RE = /^[A-HJKMNP-Z2-9]{8}$/;
  const POLL_MS = 1000;
  const AWAY_MS = 6000; // peer has missed several polls
  const MAX_FILE = 3 * 1024 * 1024;
  const PREVIEW = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const me = { id: '', secret: '' };
  // id -> { id, state: 'incoming' | 'outgoing' | 'active' | 'ended', messages, unread, away }
  const peers = new Map();
  let selected = null;

  // ---------- helpers ----------

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
  const fmt = (id) => `${id.slice(0, 4)}-${id.slice(4)}`;
  const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function api(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: me.id, secret: me.secret, ...body }),
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  }
  const send = (to, type, extra) => api('/api/send', { to, type, ...extra }).catch(() => ({ ok: false, status: 0 }));

  function setStatus(text, cls) {
    $('status').textContent = text;
    $('status').className = `status ${cls || ''}`;
  }
  function notice(text) {
    $('notice').textContent = text;
  }

  // ---------- rendering ----------

  const PEER_STATUS = {
    incoming: 'Wants to chat',
    outgoing: 'Waiting for them to accept…',
    ended: 'Chat ended',
  };
  const peerStatus = (p) => PEER_STATUS[p.state] || (p.away ? 'Reconnecting…' : 'Connected');
  const peerStatusClass = (p) => (p.state === 'active' ? (p.away ? 'warn' : 'ok') : '');

  function renderPeers() {
    const list = $('peer-list');
    list.replaceChildren();
    let unread = 0;
    for (const p of peers.values()) {
      unread += p.unread;
      const open = p.state === 'active' || p.state === 'ended';
      const li = el('li', `peer${open ? ' open' : ''}${p.id === selected ? ' selected' : ''}`);
      li.dataset.id = p.id;
      if (open) li.tabIndex = 0;

      const main = el('div', 'peer-main');
      main.append(el('code', '', fmt(p.id)), el('span', `status ${peerStatusClass(p)}`, peerStatus(p)));
      li.append(main);
      if (p.unread) li.append(el('span', 'badge', String(p.unread)));

      const button = (act, label, cls) => {
        const b = el('button', `small ${cls || ''}`, label);
        b.type = 'button';
        b.dataset.act = act;
        li.append(b);
      };
      if (p.state === 'incoming') {
        button('accept', 'Accept');
        button('reject', 'Reject', 'ghost');
      } else if (p.state === 'outgoing') {
        button('cancel', 'Cancel', 'ghost');
      } else if (p.state === 'ended') {
        button('remove', 'Remove', 'ghost');
      }
      list.append(li);
    }
    document.title = unread ? `(${unread}) PrivateChat` : 'PrivateChat';
  }

  function renderConv() {
    const p = peers.get(selected);
    $('empty').hidden = !!p;
    $('conv').hidden = !p;
    if (!p) {
      document.body.classList.remove('show-chat');
      return;
    }
    $('conv-id').textContent = fmt(p.id);
    $('conv-status').textContent = peerStatus(p);
    $('conv-status').className = `status ${peerStatusClass(p)}`;
    $('leave').hidden = p.state !== 'active';
    for (const n of $('composer').querySelectorAll('button, textarea')) n.disabled = p.state !== 'active';

    const box = $('messages');
    box.replaceChildren();
    for (const m of p.messages) {
      if (m.kind === 'sys') {
        box.append(el('div', 'msg sys', m.text));
        continue;
      }
      const div = el('div', `msg${m.mine ? ' mine' : ''}${m.status === 'failed' ? ' failed' : ''}`);
      if (m.kind === 'text') {
        div.append(m.text);
      } else if (m.url) {
        if (m.image) {
          const img = el('img');
          img.src = m.url;
          img.alt = m.name;
          div.append(img);
        }
        const a = el('a', '', `${m.name} (${fmtSize(m.size)})`);
        a.href = m.url;
        a.download = m.name;
        div.append(a);
      } else {
        div.append(`${m.name} (${fmtSize(m.size)}) could not be received`);
      }
      const state = m.status === 'sending' ? ' · Sending…' : m.status === 'failed' ? ' · Not delivered' : '';
      div.append(el('span', 'meta', m.time + state));
      box.append(div);
    }
    box.scrollTop = box.scrollHeight;
  }

  function render() {
    renderPeers();
    renderConv();
  }

  // ---------- chat state ----------

  function addMessage(p, m) {
    m.time = clock();
    p.messages.push(m);
    if (!m.mine && (selected !== p.id || document.hidden)) p.unread++;
    render();
  }
  const sys = (p, text) => addMessage(p, { kind: 'sys', mine: true, text });

  function select(id) {
    const p = peers.get(id);
    if (!p) return;
    selected = id;
    p.unread = 0;
    document.body.classList.add('show-chat');
    render();
    if (p.state === 'active') $('text').focus();
  }

  function drop(id) {
    peers.delete(id);
    if (selected === id) selected = null;
    render();
  }

  function end(p, text) {
    p.state = 'ended';
    p.away = false;
    sys(p, text);
  }

  async function connect(raw) {
    const id = norm(raw);
    notice('');
    if (!ID_RE.test(id)) return notice('Enter a valid 8-character ID.');
    if (id === me.id) return notice('That is your own ID.');
    const existing = peers.get(id);
    if (existing && existing.state === 'active') return select(id);
    if (existing && existing.state === 'incoming') return accept(id);
    if (existing && existing.state === 'outgoing') return notice('Already waiting for them to accept.');

    const r = await send(id, 'request');
    if (r.status === 404) return notice('That ID is not online right now.');
    if (!r.ok) return notice('Could not send the request. Try again.');
    peers.set(id, { id, state: 'outgoing', messages: [], unread: 0, away: false });
    $('peer-input').value = '';
    render();
  }

  async function accept(id) {
    const r = await send(id, 'accept');
    const p = peers.get(id);
    if (!p) return;
    if (!r.ok) {
      drop(id);
      return notice(`${fmt(id)} is no longer available.`);
    }
    p.state = 'active';
    sys(p, 'Connected');
    select(id);
  }

  function leave(id) {
    const p = peers.get(id);
    if (!p) return;
    send(id, 'leave');
    if (p.state === 'active') end(p, 'You left the chat');
    else drop(id);
  }

  async function sendText() {
    const p = peers.get(selected);
    const text = $('text').value.trim();
    if (!p || p.state !== 'active' || !text) return;
    $('text').value = '';
    $('text').style.height = '';
    const m = { kind: 'text', mine: true, text, status: 'sending' };
    addMessage(p, m);
    const r = await send(p.id, 'msg', { text });
    m.status = r.ok ? '' : 'failed';
    render();
  }

  async function sendFile(file) {
    const p = peers.get(selected);
    if (!p || p.state !== 'active' || !file) return;
    if (file.size > MAX_FILE) return sys(p, `${file.name} is larger than 3 MB and was not sent`);
    if (!file.size) return sys(p, `${file.name} is empty and was not sent`);
    const m = {
      kind: 'file',
      mine: true,
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
      image: PREVIEW.has(file.type),
      status: 'sending',
    };
    addMessage(p, m);
    try {
      const res = await fetch('/api/file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-id': me.id,
          'x-secret': me.secret,
          'x-to': p.id,
          'x-file-name': encodeURIComponent(file.name),
          'x-file-type': file.type,
        },
        body: file,
      });
      m.status = res.ok ? '' : 'failed';
    } catch {
      m.status = 'failed';
    }
    render();
  }

  // The server deletes the file as we read it, so fetch it straight away.
  async function receiveFile(p, ev) {
    const m = { kind: 'file', mine: false, name: ev.name, size: ev.size, url: '', image: PREVIEW.has(ev.mime) };
    try {
      const res = await fetch(`/api/file/${ev.fileId}`, { headers: { 'x-id': me.id, 'x-secret': me.secret } });
      if (res.ok) {
        const blob = new Blob([await res.arrayBuffer()], { type: m.image ? ev.mime : 'application/octet-stream' });
        m.url = URL.createObjectURL(blob);
      }
    } catch {}
    addMessage(p, m);
  }

  function handle(ev) {
    const p = peers.get(ev.from);
    switch (ev.type) {
      case 'request':
        if (p && p.state === 'active') break;
        peers.set(ev.from, { id: ev.from, state: 'incoming', messages: [], unread: 0, away: false });
        if (selected === ev.from) selected = null;
        render();
        break;
      case 'accept':
        if (p && p.state === 'outgoing') {
          p.state = 'active';
          sys(p, 'Connected');
          if (!selected) select(p.id);
        }
        break;
      case 'reject':
        if (p && p.state === 'outgoing') {
          drop(p.id);
          notice(`${fmt(ev.from)} declined your request.`);
        }
        break;
      case 'leave':
        if (p && p.state === 'active') end(p, 'They left the chat');
        else if (p && p.state !== 'ended') drop(p.id);
        break;
      case 'msg':
        if (p && p.state === 'active') addMessage(p, { kind: 'text', mine: false, text: String(ev.text) });
        break;
      case 'file':
        if (p && p.state === 'active') receiveFile(p, ev);
        break;
    }
  }

  // ---------- session + polling ----------

  async function register() {
    for (;;) {
      try {
        const r = await api('/api/register');
        if (r.ok) break;
        if (r.status === 409) me.id = randomId();
        else if (r.status === 503) setStatus('Server not configured', 'bad');
        else setStatus('Reconnecting…', 'warn');
        if (r.status !== 409) await sleep(2000);
      } catch {
        setStatus('Reconnecting…', 'warn');
        await sleep(2000);
      }
    }
    $('my-id').textContent = fmt(me.id);
    $('copy').disabled = false;
    setStatus('Online', 'ok');
  }

  // We were away longer than the grace period, so the server forgot us.
  async function sessionLost() {
    for (const p of [...peers.values()]) {
      if (p.state === 'active') end(p, 'Connection was lost for too long. Chat ended.');
      else if (p.state !== 'ended') drop(p.id);
    }
    await register();
  }

  async function poll() {
    for (;;) {
      try {
        const ids = [...peers.values()].filter((p) => p.state !== 'ended').map((p) => p.id);
        const r = await api('/api/poll', { peers: ids });
        if (r.status === 401) {
          await sessionLost();
        } else if (!r.ok) {
          setStatus('Reconnecting…', 'warn');
        } else {
          setStatus('Online', 'ok');
          r.data.events.forEach(handle);
          let changed = false;
          for (const [id, age] of Object.entries(r.data.peers)) {
            const p = peers.get(id);
            if (!p || p.state === 'ended') continue;
            if (age === null) {
              if (p.state === 'active') end(p, 'They went offline. Chat ended.');
              else drop(id);
            } else if (p.away !== age > AWAY_MS) {
              p.away = age > AWAY_MS;
              changed = true;
            }
          }
          if (changed) render();
        }
      } catch {
        setStatus('Reconnecting…', 'warn');
      }
      await sleep(POLL_MS);
    }
  }

  // ---------- events ----------

  $('connect-form').addEventListener('submit', (e) => {
    e.preventDefault();
    connect($('peer-input').value);
  });

  $('peer-list').addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const id = li.dataset.id;
    const act = e.target.dataset.act;
    if (act === 'accept') accept(id);
    else if (act === 'reject') {
      send(id, 'reject');
      drop(id);
    } else if (act === 'cancel') leave(id);
    else if (act === 'remove') drop(id);
    else if (li.classList.contains('open')) select(id);
  });
  $('peer-list').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('li.open')) select(e.target.dataset.id);
  });

  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(fmt(me.id));
      $('copy').textContent = 'Copied';
      setTimeout(() => ($('copy').textContent = 'Copy'), 1500);
    } catch {}
  });

  $('composer').addEventListener('submit', (e) => {
    e.preventDefault();
    sendText();
  });
  $('text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendText();
    }
  });
  $('text').addEventListener('input', () => {
    $('text').style.height = 'auto';
    $('text').style.height = `${$('text').scrollHeight + 2}px`;
  });
  $('attach').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', () => {
    sendFile($('file-input').files[0]);
    $('file-input').value = '';
  });

  $('leave').addEventListener('click', () => leave(selected));
  $('back').addEventListener('click', () => {
    selected = null;
    render();
  });

  document.addEventListener('visibilitychange', () => {
    const p = peers.get(selected);
    if (!document.hidden && p && p.unread) {
      p.unread = 0;
      renderPeers();
    }
  });

  // Closing or refreshing ends the session immediately for everyone we talk to.
  window.addEventListener('pagehide', () => {
    if (!me.id) return;
    navigator.sendBeacon('/api/bye', new Blob([JSON.stringify(me)], { type: 'application/json' }));
  });

  // ---------- start ----------

  me.id = randomId();
  me.secret = randomSecret();
  register().then(poll);
})();
