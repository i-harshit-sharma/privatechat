// Landing page demo. Purely local: it imitates a chat between two screens
// and never contacts the server.
(() => {
  'use strict';

  const a = document.getElementById('demo-a'); // Alice's screen (the visitor)
  const b = document.getElementById('demo-b'); // Bob's screen
  const form = document.getElementById('demo-form');
  const input = document.getElementById('demo-input');
  const closeBtn = document.getElementById('demo-close');
  const live = document.querySelectorAll('.live');

  const svg = (w, paths) =>
    `<svg viewBox="0 0 ${w} 16" width="${w}" height="16" fill="none" stroke="currentColor" stroke-width="1.600" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const TICKS = {
    awaiting: ['Awaiting delivery', svg(16, '<circle cx="8" cy="8" r="6"/><path d="M8 4.800V8l2.300 1.400"/>')],
    received: ['Received', svg(16, '<path d="M2.500 8.500l3.200 3.200 6.800-6.900"/>')],
    seen: ['Seen', svg(22, '<path d="M1.500 8.500l3.200 3.200 6.800-6.900"/><path d="M9.600 10.400l1.300 1.300 6.800-6.900"/>')],
  };
  const REPLIES = [
    'Got it 👍',
    'And none of this is saved anywhere?',
    'Nice. No account, no history.',
    'Try the "Close the tab" button up there.',
    'Still here 🙂',
  ];

  let open = true;
  let replies = 0;
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  function bubble(box, text, cls) {
    const el = document.createElement('span');
    el.className = `b ${cls}`;
    el.textContent = text;
    box.append(el);
    box.scrollTop = box.scrollHeight;
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

  function bobSays(text) {
    bubble(b, text, 'me');
    bubble(a, text, 'them');
  }

  function start() {
    open = true;
    replies = 0;
    a.replaceChildren();
    b.replaceChildren();
    input.disabled = false;
    closeBtn.textContent = 'Close the tab';
    live.forEach((el) => {
      el.textContent = 'Connected';
      el.classList.remove('off');
    });
    bubble(a, 'Connected', 'sys');
    bubble(b, 'Connected', 'sys');
    later(700, () => bobSays('Hey Alice, got your ID 👋'));
  }

  function end() {
    open = false;
    timers.forEach(clearTimeout);
    timers = [];
    a.replaceChildren();
    b.replaceChildren();
    input.disabled = true;
    closeBtn.textContent = 'Open it again';
    live.forEach((el) => {
      el.textContent = 'Offline';
      el.classList.add('off');
    });
    bubble(a, 'Tab closed. The conversation is gone, and there is no copy to bring back.', 'sys');
    bubble(b, 'Alice went offline. Chat ended.', 'sys');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!open || !text) return;
    input.value = '';
    const mine = bubble(a, text, 'me');
    setTick(mine, 'awaiting');
    later(600, () => {
      bubble(b, text, 'them');
      setTick(mine, 'received');
    });
    later(1300, () => setTick(mine, 'seen'));
    later(2200, () => bobSays(REPLIES[replies++ % REPLIES.length]));
  });

  closeBtn.addEventListener('click', () => (open ? end() : start()));

  start();
})();
