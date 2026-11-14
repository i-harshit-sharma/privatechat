'use client';

// Landing page product demo. The "chat" is scripted and never contacts the server.

import { useCallback, useEffect, useRef, useState } from 'react';
import Tick from '../Ticks';

const CANCEL = Symbol('cancel');
const REPLIES = ['Got it 👍', 'Ha, nice.', 'Still here 🙂', 'Hit Replay to watch it again.'];

const REPLAY_ICON = (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <path
      d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5V5H5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export { REPLAY_ICON };

function Photo() {
  return (
    <>
      <svg viewBox="0 0 220 132" role="img" aria-label="A photo of a sunset">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffb37a" />
            <stop offset="0.55" stopColor="#ff7e8a" />
            <stop offset="1" stopColor="#7a5cff" />
          </linearGradient>
        </defs>
        <rect width="220" height="132" fill="url(#sky)" />
        <circle cx="150" cy="70" r="24" fill="#fff3c4" />
        <path d="M0 98l42-30 36 24 40-36 46 34 56-28v70H0z" fill="#3b2a6b" />
        <path d="M0 112l52-22 48 18 58-24 62 26v22H0z" fill="#241848" />
      </svg>
      <span>sunset.png · 1.2 MB</span>
    </>
  );
}

function Bubble({ m }) {
  if (m.kind === 'typing') {
    return (
      <div className="bub typing">
        <i />
        <i />
        <i />
      </div>
    );
  }
  if (m.kind === 'photo') {
    return (
      <div className="bub them photo">
        <Photo />
      </div>
    );
  }
  return (
    <div className={`bub ${m.kind}`}>
      {m.text}
      {m.tick && <Tick state={m.tick} />}
    </div>
  );
}

export default function Demo() {
  const [msgs, setMsgs] = useState([]);
  const [peer, setPeer] = useState(null); // { avatar, name, status, ok, active }
  const [connect, setConnect] = useState('');
  const [caret, setCaret] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [conv, setConv] = useState(false);
  const [input, setInput] = useState('');
  const [readOnly, setReadOnly] = useState(true);
  const [placeholder, setPlaceholder] = useState('Message');

  const run = useRef(0);
  const replies = useRef(0);
  const seq = useRef(0);
  const sectionRef = useRef(null);
  const msgsRef = useRef(null);

  useEffect(() => {
    const box = msgsRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [msgs]);

  // Resolves after ms, or rejects if the demo was restarted in the meantime.
  const waiter = (id) => (ms) => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    return new Promise((res, rej) => setTimeout(() => (id === run.current ? res() : rej(CANCEL)), reduced ? 0 : ms));
  };

  const add = (m) => {
    const id = ++seq.current;
    setMsgs((a) => [...a, { ...m, id }]);
    return id;
  };
  const patch = (id, p) => setMsgs((a) => a.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const remove = (id) => setMsgs((a) => a.filter((m) => m.id !== id));

  async function bobSays(wait, m) {
    const dots = add({ kind: 'typing' });
    await wait(1100);
    remove(dots);
    add(m);
  }

  async function aliceSays(wait, text) {
    const id = add({ kind: 'me', text, tick: 'awaiting' });
    await wait(650);
    patch(id, { tick: 'received' });
    await wait(750);
    patch(id, { tick: 'seen' });
  }

  async function typeInto(wait, set, text, speed) {
    let out = '';
    for (const ch of text) {
      out += ch;
      set(out);
      await wait(speed);
    }
  }

  function reset() {
    setMsgs([]);
    setPeer(null);
    setConnect('');
    setCaret(false);
    setPressed(false);
    setConv(false);
    setInput('');
    setReadOnly(true);
    setPlaceholder('Message');
    replies.current = 0;
  }

  const play = useCallback(async () => {
    const id = ++run.current;
    const wait = waiter(id);
    reset();
    try {
      // Alice enters Bob's ID.
      await wait(700);
      setCaret(true);
      await typeInto(wait, setConnect, 'P3WN-8HTA', 85);
      await wait(350);
      setPressed(true);
      await wait(160);
      setPressed(false);
      setCaret(false);
      setConnect('');
      setPeer({ avatar: '?', status: 'Waiting for them to accept…' });

      // Bob accepts.
      await wait(1500);
      setPeer({ avatar: 'B', name: 'Bob', status: 'Connected', ok: true, active: true });
      setConv(true);
      add({ kind: 'sys', text: 'Connected' });

      // The conversation.
      await wait(600);
      await bobSays(wait, { kind: 'them', text: 'Hey Alice 👋 is any of this saved?' });
      await wait(700);
      await typeInto(wait, setInput, 'Nope. Close the tab and it’s gone.', 38);
      await wait(300);
      setInput('');
      await aliceSays(wait, 'Nope. Close the tab and it’s gone.');
      await wait(400);
      await bobSays(wait, { kind: 'photo' });
      await wait(900);
      await typeInto(wait, setInput, '😍', 60);
      await wait(350);
      setInput('');
      await aliceSays(wait, '😍');

      // Hand over to the visitor.
      setReadOnly(false);
      setPlaceholder('Your turn. Say something to Bob');
    } catch (e) {
      if (e !== CANCEL) throw e;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (readOnly || !text) return;
    setInput('');
    const wait = waiter(run.current);
    try {
      await aliceSays(wait, text);
      await wait(300);
      await bobSays(wait, { kind: 'them', text: REPLIES[replies.current++ % REPLIES.length] });
    } catch (err) {
      if (err !== CANCEL) throw err;
    }
  }

  // Start the first time the window scrolls into view; stop if it unmounts.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(sectionRef.current);
    return () => {
      io.disconnect();
      run.current++;
    };
  }, [play]);

  return (
    <section id="demo" className="win" aria-label="Product demo" ref={sectionRef}>
      <div className="win-bar">
        <span className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="win-title">PrivateChat</span>
        <button type="button" className="replay" onClick={play}>
          {REPLAY_ICON} Replay
        </button>
      </div>
      <div className="win-body">
        <aside className="w-side">
          <div className="w-brand">
            <b>PrivateChat</b>
            <span className="ok">Online</span>
          </div>
          <div className="w-block">
            <span className="lbl">Your ID</span>
            <div className="w-row">
              <code className="w-id">K7QF-2MXD</code>
              <span className="chip">Copy</span>
            </div>
          </div>
          <div className="w-block">
            <span className="lbl">Your name</span>
            <div className="w-field">Alice</div>
          </div>
          <div className="w-block">
            <span className="lbl">Connect to an ID</span>
            <div className="w-row">
              <div className="w-field mono">
                <span>{connect}</span>
                <i className={`caret${caret ? ' on' : ''}`} />
              </div>
              <span className={`chip chip-dark${pressed ? ' press' : ''}`} id="d-connect-btn">
                Connect
              </span>
            </div>
          </div>
          <div className="w-peers">
            {peer && (
              <div className={`peer${peer.active ? ' active' : ''}`}>
                <span className="avatar">{peer.avatar}</span>
                <div>
                  {peer.name && (
                    <>
                      <b>{peer.name}</b>{' '}
                    </>
                  )}
                  <code>P3WN-8HTA</code>
                  <small className={peer.ok ? 'ok' : undefined}>{peer.status}</small>
                </div>
              </div>
            )}
          </div>
        </aside>
        <div className="w-main">
          {!conv && (
            <div className="w-empty">
              <b>No chat open.</b>
              <span>Enter an ID to start one.</span>
            </div>
          )}
          {conv && (
            <div className="w-conv">
              <div className="w-head">
                <span className="avatar">B</span>
                <div className="w-who">
                  <span>
                    <b>Bob</b> <code>P3WN-8HTA</code>
                  </span>
                  <span className="ok">Connected</span>
                </div>
                <span className="chip">Leave</span>
              </div>
              <div className="w-msgs" ref={msgsRef} aria-live="polite">
                {msgs.map((m) => (
                  <Bubble key={m.id} m={m} />
                ))}
              </div>
              <form className="w-compose" onSubmit={onSubmit}>
                <span className="chip sq" aria-hidden="true">
                  +
                </span>
                <span className="chip sq" aria-hidden="true">
                  ☺
                </span>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={120}
                  placeholder={placeholder}
                  autoComplete="off"
                  aria-label="Demo message"
                  readOnly={readOnly}
                />
                <button className="chip chip-dark" type="submit">
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
