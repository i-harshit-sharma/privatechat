'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Sprite, { Sticker } from '../Sprite';
import Tick from '../Ticks';
import { ChatEngine, cleanName, fmt, fmtSize, norm, peerStatus, peerStatusClass, tint } from '@/lib/chat-engine';

const EMOJIS = [
  ...'😀😃😄😁😆😅😂🤣😊🙂😉😍😘😋😜🤪🤔🤨😐😏😴😎🥳🤗🤭🤫😇🥹😢😭😤😡🤯😱😳🥺😬🙄😷🤒🤢🥶🥵💀👻🤖💩',
  ...'👍👎👌🤞🤝👏🙌🙏💪👋🤙👀🫶🫡',
  '❤️',
  ...'🧡💛💚💙💜🖤💔💯🔥✨⭐🎉🎁🎂🍕🍔☕🍺⚽🎮🎵📷💡📌✅❌❓❗⏰🚀🌍🌙',
  '☀️',
  ...'🌧🐶🐱',
];

const initial = (p) => (p.name || '?').charAt(0).toUpperCase();

export default function Chat() {
  const [engine] = useState(() => new ChatEngine());
  useSyncExternalStore(engine.subscribe, engine.getSnapshot, () => 0);

  const [name, setName] = useState('');
  const [peerInput, setPeerInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [viewer, setViewer] = useState(null); // { src, name }

  const nameRef = useRef(null);
  const textRef = useRef(null);
  const fileRef = useRef(null);
  const boxRef = useRef(null);
  const viewerRef = useRef(null);

  const p = engine.current;
  const unread = engine.unread;

  // Session: register, poll, say goodbye on the way out.
  useEffect(() => engine.start(), [engine]);

  // Name: pre-fill from this browser, save as it is typed.
  useEffect(() => {
    try {
      setName(cleanName(localStorage.getItem('pc-name')));
    } catch {}
  }, []);
  const onName = (e) => {
    const v = e.target.value;
    setName(v);
    try {
      localStorage.setItem('pc-name', cleanName(v));
    } catch {}
  };

  useEffect(() => {
    document.title = unread ? `(${unread}) PrivateChat` : 'PrivateChat';
  }, [unread]);

  // Keep the newest message in view.
  const msgCount = p ? p.messages.length : 0;
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [msgCount, p?.id]);

  // Focus the composer when an active chat opens.
  const activeId = p && p.state === 'active' ? p.id : null;
  useEffect(() => {
    if (activeId) textRef.current?.focus();
  }, [activeId]);

  // Emoji picker closes on outside click or Escape.
  useEffect(() => {
    const click = (e) => {
      if (!e.target.closest('#emoji-panel, #emoji-btn')) setEmojiOpen(false);
    };
    const key = (e) => e.key === 'Escape' && setEmojiOpen(false);
    document.addEventListener('click', click);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('click', click);
      document.removeEventListener('keydown', key);
    };
  }, []);

  // My display name is required to start or accept a chat.
  function requireName() {
    const n = cleanName(name);
    if (!n) {
      engine.setNotice('Enter your name first.');
      nameRef.current?.focus();
    }
    return n;
  }

  async function onConnect(e) {
    e.preventDefault();
    const n = requireName();
    if (!n) return;
    const sent = await engine.connect(peerInput, n);
    if (sent === true) setPeerInput('');
  }

  // Type XXXX and the dash appears by itself.
  function onPeerInput(e) {
    const v = norm(e.target.value).slice(0, 8);
    const deleting = e.nativeEvent.inputType === 'deleteContentBackward';
    setPeerInput(v.length > 4 || (v.length === 4 && !deleting) ? fmt(v) : v);
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(fmt(engine.me.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  function openPeer(peer) {
    if (peer.state === 'active' || peer.state === 'ended') engine.select(peer.id);
  }

  async function submitText(e) {
    e?.preventDefault();
    const t = textRef.current;
    if (!t) return;
    const value = t.value;
    if (await engine.sendText(value)) {
      t.value = '';
      t.style.height = '';
    }
  }
  function onTextKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submitText();
    }
  }
  function growText() {
    const t = textRef.current;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight + 2}px`;
  }
  function addEmoji(emoji) {
    const t = textRef.current;
    if (!t || t.value.length + emoji.length > t.maxLength) return;
    t.setRangeText(emoji, t.selectionStart, t.selectionEnd, 'end');
    growText();
    t.focus();
  }

  function onFile(e) {
    engine.sendFile(e.target.files[0]);
    e.target.value = '';
  }

  function openViewer(src, alt) {
    setViewer({ src, name: alt });
    viewerRef.current?.showModal();
  }

  const active = p?.state === 'active';
  const peers = [...engine.peers.values()];
  const idText = engine.me.id ? fmt(engine.me.id) : '····-····';

  return (
    <div className={`app${p ? ' show-chat' : ''}`}>
      <Sprite />
      <aside className="side">
        <header className="brand">
          <h1>
            <Link href="/">
              <svg viewBox="0 0 48 48" width="24" height="24" aria-hidden="true">
                <use href="#s-chat" />
              </svg>
              PrivateChat
            </Link>
          </h1>
          <span id="status" className={`status ${engine.status.cls}`}>
            {engine.status.text}
          </span>
        </header>

        <section className="me">
          <span className="label">Your ID</span>
          <div className="id-row">
            <code id="my-id">{idText}</code>
            <button type="button" className="ghost" disabled={!engine.me.id} onClick={copyId}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="hint">Share this ID with someone. It changes every time you open or refresh this page.</p>
        </section>

        <section>
          <label className="label" htmlFor="name-input">
            Your name
          </label>
          <input
            id="name-input"
            ref={nameRef}
            value={name}
            onChange={onName}
            maxLength={24}
            placeholder="Required to start a chat"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="hint">Shown to people you chat with. Remembered in this browser only.</p>
        </section>

        <form className="connect" onSubmit={onConnect}>
          <label className="label" htmlFor="peer-input">
            Connect to an ID
          </label>
          <div className="id-row">
            <input
              id="peer-input"
              value={peerInput}
              onChange={onPeerInput}
              placeholder="XXXX-XXXX"
              maxLength={9}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button type="submit">Connect</button>
          </div>
          <p className="notice" role="status">
            {engine.notice}
          </p>
        </form>

        <ul className="peers">
          {peers.map((peer) => {
            const open = peer.state === 'active' || peer.state === 'ended';
            return (
              <li
                key={peer.id}
                className={`peer${open ? ' open' : ''}${peer.id === engine.selected ? ' selected' : ''}`}
                tabIndex={open ? 0 : undefined}
                onClick={() => openPeer(peer)}
                onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && openPeer(peer)}
              >
                <span className="avatar" style={{ background: tint(peer.id) }}>
                  {initial(peer)}
                </span>
                <div className="peer-main">
                  {peer.name && <strong>{peer.name}</strong>}
                  <code>{fmt(peer.id)}</code>
                  <span className={`status ${peerStatusClass(peer)}`}>{peerStatus(peer)}</span>
                </div>
                {peer.unread > 0 && <span className="badge">{peer.unread}</span>}
                {peer.state === 'incoming' && (
                  <>
                    <PeerButton
                      onClick={() => {
                        const n = requireName();
                        if (n) engine.accept(peer.id, n);
                      }}
                    >
                      Accept
                    </PeerButton>
                    <PeerButton ghost onClick={() => engine.reject(peer.id)}>
                      Reject
                    </PeerButton>
                  </>
                )}
                {peer.state === 'outgoing' && (
                  <PeerButton ghost onClick={() => engine.leave(peer.id)}>
                    Cancel
                  </PeerButton>
                )}
                {peer.state === 'ended' && (
                  <PeerButton ghost onClick={() => engine.drop(peer.id)}>
                    Remove
                  </PeerButton>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="chat">
        {!p && (
          <div id="empty" className="empty">
            <div className="stickers" aria-hidden="true">
              <Sticker id="tag" style={{ '--r': '-8deg' }} />
              <Sticker id="chat" style={{ '--r': '4deg' }} />
              <Sticker id="ghost" style={{ '--r': '9deg' }} />
            </div>
            <p>No chat open.</p>
            <p className="hint">
              Both people must have this page open. Nothing is saved: messages exist only in your two browsers and
              vanish when the tab closes.
            </p>
          </div>
        )}

        {p && (
          <section className="conv">
            <header className="conv-head">
              <button type="button" className="ghost back" aria-label="Back to chats" onClick={() => engine.back()}>
                ←
              </button>
              <span className="avatar" style={{ background: tint(p.id) }}>
                {initial(p)}
              </span>
              <div className="conv-title">
                <span>
                  <strong>{p.name}</strong> <code>{fmt(p.id)}</code>
                </span>
                <span className={`status ${peerStatusClass(p)}`}>{peerStatus(p)}</span>
              </div>
              {active && (
                <button type="button" className="ghost danger" onClick={() => engine.leave(p.id)}>
                  Leave
                </button>
              )}
            </header>

            <div className="messages" ref={boxRef} aria-live="polite">
              {p.messages.map((m) => (
                <Message key={m.key} m={m} onView={openViewer} />
              ))}
            </div>

            <form className="composer" onSubmit={submitText}>
              <input ref={fileRef} type="file" hidden onChange={onFile} />
              <button
                type="button"
                className="ghost"
                id="attach"
                disabled={!active}
                aria-label="Send a file (max 3 MB)"
                title="Send a file (max 3 MB)"
                onClick={() => fileRef.current?.click()}
              >
                +
              </button>
              <button
                type="button"
                className="ghost"
                id="emoji-btn"
                disabled={!active}
                aria-label="Add emoji"
                title="Add emoji"
                aria-expanded={emojiOpen}
                aria-controls="emoji-panel"
                onClick={() => setEmojiOpen((o) => !o)}
              >
                ☺
              </button>
              {emojiOpen && (
                <div id="emoji-panel" className="emoji-panel" role="group" aria-label="Emojis">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" aria-label={e} onClick={() => addEmoji(e)}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={textRef}
                rows={1}
                maxLength={4000}
                placeholder="Message"
                disabled={!active}
                onKeyDown={onTextKey}
                onInput={growText}
              />
              <button type="submit" disabled={!active}>
                Send
              </button>
            </form>
          </section>
        )}
      </main>

      <dialog
        ref={viewerRef}
        className="viewer"
        aria-label="Image preview"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      >
        {viewer && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewer.src} alt={viewer.name} />
            <div className="viewer-bar">
              <span>{viewer.name}</span>
              <a className="button" href={viewer.src} download={viewer.name}>
                Download
              </a>
              <button type="button" className="ghost" onClick={() => viewerRef.current?.close()}>
                Close
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}

function PeerButton({ ghost, onClick, children }) {
  return (
    <button
      type="button"
      className={`small${ghost ? ' ghost' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function Message({ m, onView }) {
  if (m.kind === 'sys') return <div className="msg sys">{m.text}</div>;

  let body;
  if (m.kind === 'text') {
    body = m.text;
  } else if (m.url) {
    body = (
      <>
        {m.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.url}
            alt={m.name}
            title="Click to view full size"
            tabIndex={0}
            onClick={() => onView(m.url, m.name)}
            onKeyDown={(e) => e.key === 'Enter' && onView(m.url, m.name)}
          />
        )}
        <a href={m.url} download={m.name}>
          {m.name} ({fmtSize(m.size)})
        </a>
      </>
    );
  } else {
    body = `${m.name} (${fmtSize(m.size)}) could not be received`;
  }

  return (
    <div className={`msg${m.mine ? ' mine' : ''}${m.status === 'failed' ? ' failed' : ''}`}>
      {body}
      <span className="meta">
        {m.time}
        {m.status === 'failed' && ' · Not delivered'}
        {m.mine && <Tick state={m.status} />}
      </span>
    </div>
  );
}
