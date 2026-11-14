// Landing page animation. Everything here is local: the "chat" is scripted
// and never contacts the server.
(() => {
  'use strict';

  document.documentElement.classList.add('js');
  const $ = (id) => document.getElementById(id);
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- scroll reveal ----------

  const revealer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          revealer.unobserve(e.target);
        }
      }
    },
    { threshold: 0.2 }
  );
  document.querySelectorAll('.reveal').forEach((n) => revealer.observe(n));

  // ---------- product demo ----------

  const svg = (w, paths) =>
    `<svg viewBox="0 0 ${w} 16" width="${w}" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const TICKS = {
    awaiting: ['Awaiting delivery', svg(16, '<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.3 1.4"/>')],
    received: ['Received', svg(16, '<path d="M2.5 8.5l3.2 3.2 6.8-6.9"/>')],
    seen: ['Seen', svg(22, '<path d="M1.5 8.5l3.2 3.2 6.8-6.9"/><path d="M9.6 10.4l1.3 1.3 6.8-6.9"/>')],
  };
  const PHOTO =
    '<svg viewBox="0 0 220 132" role="img" aria-label="A photo of a sunset"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb37a"/><stop offset="0.55" stop-color="#ff7e8a"/><stop offset="1" stop-color="#7a5cff"/></linearGradient></defs><rect width="220" height="132" fill="url(#sky)"/><circle cx="150" cy="70" r="24" fill="#fff3c4"/><path d="M0 98l42-30 36 24 40-36 46 34 56-28v70H0z" fill="#3b2a6b"/><path d="M0 112l52-22 48 18 58-24 62 26v22H0z" fill="#241848"/></svg>';
  const REPLIES = ['Got it 👍', 'Ha, nice.', 'Still here 🙂', 'Hit Replay to watch it again.'];

  const msgs = $('d-msgs');
  const input = $('d-input');
  const CANCEL = Symbol('cancel');
  let run = 0;
  let replies = 0;

  // Resolves after ms, or rejects if the demo was restarted in the meantime.
  const waiter = (id) => (ms) =>
    new Promise((res, rej) => setTimeout(() => (id === run ? res() : rej(CANCEL)), REDUCED ? 0 : ms));

  function bubble(cls, text) {
    const el = document.createElement('div');
    el.className = `bub ${cls}`;
    if (text != null) el.textContent = text;
    msgs.append(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function setTick(el, state) {
    let tick = el.querySelector('.tick');
    if (!tick) {
      tick = document.createElement('span');
      tick.className = 'tick';
      tick.setAttribute('role', 'img');
      el.append(tick);
    }
    tick.setAttribute('aria-label', TICKS[state][0]);
    tick.title = TICKS[state][0];
    tick.innerHTML = TICKS[state][1]; // fixed markup from TICKS, never visitor input
  }

  async function bobSays(wait, build) {
    const dots = bubble('typing');
    dots.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    await wait(1100);
    dots.remove();
    return build();
  }

  async function aliceSays(wait, text) {
    const mine = bubble('me', text);
    setTick(mine, 'awaiting');
    await wait(650);
    setTick(mine, 'received');
    await wait(750);
    setTick(mine, 'seen');
  }

  async function typeInto(wait, set, text, speed) {
    let out = '';
    for (const ch of text) {
      out += ch;
      set(out);
      await wait(speed);
    }
  }

  function peer(html, active) {
    const el = document.createElement('div');
    el.className = `peer${active ? ' active' : ''}`;
    el.innerHTML = html; // fixed markup below, never visitor input
    $('d-peers').replaceChildren(el);
  }

  function reset() {
    msgs.replaceChildren();
    $('d-peers').replaceChildren();
    $('d-connect').textContent = '';
    $('d-caret').classList.remove('on');
    $('d-conv').hidden = true;
    $('d-empty').hidden = false;
    input.value = '';
    input.readOnly = true;
    input.placeholder = 'Message';
    replies = 0;
  }

  async function play() {
    const id = ++run;
    const wait = waiter(id);
    reset();
    try {
      // Alice enters Bob's ID.
      await wait(700);
      $('d-caret').classList.add('on');
      await typeInto(wait, (v) => ($('d-connect').textContent = v), 'P3WN-8HTA', 85);
      await wait(350);
      $('d-connect-btn').classList.add('press');
      await wait(160);
      $('d-connect-btn').classList.remove('press');
      $('d-caret').classList.remove('on');
      $('d-connect').textContent = '';
      peer('<span class="avatar">?</span><div><code>P3WN-8HTA</code><small>Waiting for them to accept…</small></div>');

      // Bob accepts.
      await wait(1500);
      peer('<span class="avatar">B</span><div><b>Bob</b> <code>P3WN-8HTA</code><small class="ok">Connected</small></div>', true);
      $('d-empty').hidden = true;
      $('d-conv').hidden = false;
      bubble('sys', 'Connected');

      // The conversation.
      await wait(600);
      await bobSays(wait, () => bubble('them', 'Hey Alice 👋 is any of this saved?'));
      await wait(700);
      await typeInto(wait, (v) => (input.value = v), 'Nope. Close the tab and it’s gone.', 38);
      await wait(300);
      input.value = '';
      await aliceSays(wait, 'Nope. Close the tab and it’s gone.');
      await wait(400);
      await bobSays(wait, () => {
        const el = bubble('them photo');
        el.innerHTML = `${PHOTO}<span>sunset.png · 1.2 MB</span>`; // fixed markup
        msgs.scrollTop = msgs.scrollHeight;
      });
      await wait(900);
      await typeInto(wait, (v) => (input.value = v), '😍', 60);
      await wait(350);
      input.value = '';
      await aliceSays(wait, '😍');

      // Hand over to the visitor.
      input.readOnly = false;
      input.placeholder = 'Your turn. Say something to Bob';
    } catch (e) {
      if (e !== CANCEL) throw e;
    }
  }

  $('d-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (input.readOnly || !text) return;
    input.value = '';
    const wait = waiter(run);
    try {
      await aliceSays(wait, text);
      await wait(300);
      await bobSays(wait, () => bubble('them', REPLIES[replies++ % REPLIES.length]));
    } catch (err) {
      if (err !== CANCEL) throw err;
    }
  });

  $('d-replay').addEventListener('click', play);

  // Start the first time the window scrolls into view.
  const starter = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        starter.disconnect();
        play();
      }
    },
    { threshold: 0.25 }
  );
  starter.observe($('demo'));

  // ---------- "how it works" scenes ----------

  const tour = document.querySelector('.tour');
  const stage = $('stage');
  const tabs = [...document.querySelectorAll('.tab')];
  const scenes = [...document.querySelectorAll('.scene')];
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let current = -1;
  let scramble = 0;

  // Scene 1: the ID shuffles before settling.
  function scrambleId() {
    clearInterval(scramble);
    const final = 'K7QF-2MXD';
    if (REDUCED) return void ($('t-id').textContent = final);
    let n = 0;
    scramble = setInterval(() => {
      n++;
      const settled = Math.floor(n / 2);
      $('t-id').textContent = [...final]
        .map((ch, i) => (ch === '-' || i < settled ? ch : ALPHABET[Math.floor(Math.random() * ALPHABET.length)]))
        .join('');
      if (settled >= final.length) clearInterval(scramble);
    }, 55);
  }

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // force a reflow so the animation starts over
    el.classList.add(cls);
  }

  function show(i) {
    current = i;
    stage.dataset.i = i;
    tabs.forEach((t, n) => {
      t.setAttribute('aria-selected', String(n === i));
      if (n === i) restart(t, 'active');
      else t.classList.remove('active');
    });
    scenes.forEach((s, n) => {
      s.classList.toggle('on', n === i);
      if (n === i) restart(s, 'play');
      else s.classList.remove('play');
    });
    if (i === 0) scrambleId();
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(i));
    // When a tab's progress bar fills, move on to the next one.
    t.querySelector('.bar').addEventListener('animationend', () => show((i + 1) % tabs.length));
  });
  $('t-replay').addEventListener('click', () => show(current));

  // Only run while the section is on screen.
  new IntersectionObserver(
    (entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      tour.classList.toggle('paused', !visible);
      if (visible && current === -1) show(0);
    },
    { threshold: 0.3 }
  ).observe(stage);
})();
