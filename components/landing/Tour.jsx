'use client';

// "How it works": four tabs that advance by themselves, each with a small
// looping scene. The scenes are pure CSS animation; remounting one (by changing
// its key) is what restarts it.

import { useEffect, useRef, useState } from 'react';
import Reveal from './Reveal';
import { REPLAY_ICON } from './Demo';
import { Sticker } from '../Sprite';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const FINAL_ID = 'K7QF-2MXD';

const TABS = [
  { key: 'ID', title: 'Get an ID and share it', text: 'Opening the page gives you a fresh ID. Send it any way you like.' },
  { key: '✓', title: 'You approve every chat', text: 'Knowing your ID is not enough. Nobody can message you until you accept.' },
  { key: '✓✓', title: 'See when it lands', text: 'Each message shows whether it is awaiting delivery, received or seen.' },
  { key: '×', title: "Close the tab, it's gone", text: 'Nothing is saved on the server or in your browser. There is no history to find.' },
];

const Cursor = () => (
  <svg className="cursor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 3l14 8.5-6.2 1.3L10 19z" fill="#1b1b1b" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export default function Tour() {
  const [current, setCurrent] = useState(-1);
  const [epoch, setEpoch] = useState(0);
  const [visible, setVisible] = useState(true);
  const [tId, setTId] = useState(FINAL_ID);
  const currentRef = useRef(-1);
  const stageRef = useRef(null);

  function show(i) {
    currentRef.current = i;
    setCurrent(i);
    setEpoch((e) => e + 1);
  }

  // Scene 1: the ID shuffles before settling.
  useEffect(() => {
    if (current !== 0) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return void setTId(FINAL_ID);
    let n = 0;
    const timer = setInterval(() => {
      n++;
      const settled = Math.floor(n / 2);
      setTId(
        [...FINAL_ID]
          .map((ch, i) => (ch === '-' || i < settled ? ch : ALPHABET[Math.floor(Math.random() * ALPHABET.length)]))
          .join('')
      );
      if (settled >= FINAL_ID.length) clearInterval(timer);
    }, 55);
    return () => clearInterval(timer);
  }, [current, epoch]);

  // Only run while the section is on screen.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((e) => e.isIntersecting);
        setVisible(isVisible);
        if (isVisible && currentRef.current === -1) show(0);
      },
      { threshold: 0.3 }
    );
    io.observe(stageRef.current);
    return () => io.disconnect();
  }, []);

  // Each scene gets a fresh key when it is (re)started so its animations begin again.
  const scene = (i, cls, children) => {
    const on = current === i;
    return (
      <div key={on ? `${i}-${epoch}` : i} className={`scene ${cls}${on ? ' on play' : ''}`} aria-hidden="true">
        {children}
      </div>
    );
  };

  return (
    <section id="tour" className={`tour${visible ? '' : ' paused'}`}>
      <Reveal className="tour-head">
        <p className="eyebrow">HOW IT WORKS</p>
        <h2>Four things, and that is all of it</h2>
        <p className="sub">No sign-up, nothing to install. Both of you just need the page open.</p>
      </Reveal>
      <div className="tour-body">
        <div className="tabs" role="tablist" aria-label="How it works">
          {TABS.map((t, i) => {
            const active = current === i;
            return (
              <button
                key={active ? `${i}-${epoch}` : i}
                className={`tab${active ? ' active' : ''}`}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => show(i)}
              >
                <span className="key">{t.key}</span>
                <span className="tab-text">
                  <b>{t.title}</b>
                  <span>{t.text}</span>
                </span>
                {/* When the progress bar fills, move on to the next tab. */}
                <i className="bar" onAnimationEnd={() => show((i + 1) % TABS.length)} />
              </button>
            );
          })}
        </div>

        <div className="stage" id="stage" ref={stageRef} data-i={Math.max(current, 0)}>
          <button type="button" className="replay" onClick={() => show(Math.max(current, 0))}>
            {REPLAY_ICON} Replay
          </button>

          {scene(
            0,
            'sc-id',
            <>
              <div className="card">
                <span className="lbl">Your ID</span>
                <div className="w-row">
                  <code className="big-id">{tId}</code>
                  <span className="chip copy">
                    <span className="c1">Copy</span>
                    <span className="c2">Copied ✓</span>
                  </span>
                </div>
              </div>
              <div className="fly">{FINAL_ID}</div>
              <p className="cap">Send it by text, email, or say it out loud.</p>
            </>
          )}

          {scene(
            1,
            'sc-accept',
            <>
              <div className="card req">
                <div className="w-row">
                  <span className="avatar">B</span>
                  <div>
                    <b>Bob</b>
                    <br />
                    <span className="muted">P3WN-8HTA wants to chat</span>
                  </div>
                </div>
                <div className="w-row acts">
                  <span className="chip chip-dark acc">Accept</span>
                  <span className="chip">Reject</span>
                </div>
                <div className="done">
                  <Sticker id="check" className="mini-stk" /> Connected to Bob
                </div>
              </div>
              <Cursor />
            </>
          )}

          {scene(
            2,
            'sc-ticks',
            <>
              <div className="bub them">Are you close?</div>
              <div className="bub me">
                Two minutes away
                <span className="tk">
                  <svg className="k1" viewBox="0 0 16 16">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 4.8V8l2.3 1.4" />
                  </svg>
                  <svg className="k2" viewBox="0 0 16 16">
                    <path d="M2.5 8.5l3.2 3.2 6.8-6.9" />
                  </svg>
                  <svg className="k3" viewBox="0 0 22 16">
                    <path d="M1.5 8.5l3.2 3.2 6.8-6.9" />
                    <path d="M9.6 10.4l1.3 1.3 6.8-6.9" />
                  </svg>
                </span>
              </div>
              <div className="states">
                <span className="st st1">Awaiting delivery</span>
                <span className="st st2">Received</span>
                <span className="st st3">Seen</span>
              </div>
            </>
          )}

          {scene(
            3,
            'sc-gone',
            <>
              <div className="tabbar">
                <span className="tabchip">
                  PrivateChat <b className="x">×</b>
                </span>
              </div>
              <div className="bub them g1">Did you get the file?</div>
              <div className="bub me g2">Yes, opening it now</div>
              <div className="bub them g3">Great, talk later 👋</div>
              <p className="cap gone-cap">
                <Sticker id="ghost" className="mini-stk" /> Gone. There is no copy anywhere.
              </p>
              <Cursor />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
