import Link from 'next/link';
import Sprite, { Sticker } from '@/components/Sprite';
import Demo from '@/components/landing/Demo';
import Reveal from '@/components/landing/Reveal';
import Tour from '@/components/landing/Tour';

export default function Home() {
  return (
    <>
      {/* Sticker icons, reused in the headline and the closing section */}
      <Sprite />

      <header className="nav">
        <div className="nav-in">
          <Link className="logo" href="/" aria-label="PrivateChat home">
            <svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true">
              <use href="#s-chat" />
            </svg>
            PrivateChat
          </Link>
          <nav className="nav-links" aria-label="Sections">
            <a href="#demo">Try it</a>
            <a href="#tour">How it works</a>
          </nav>
          <Link className="btn btn-dark btn-small" href="/chat">
            Open chat
          </Link>
        </div>
      </header>

      <div className="page">
        <section className="hero">
          <h1>
            Share an <Sticker className="stk s1" id="tag" /> ID, chat <Sticker className="stk s2" id="chat" />{' '}
            one-to-one, close the <Sticker className="stk s3" id="check" /> tab and{' '}
            <Sticker className="stk s4" id="ghost" /> it&apos;s gone.
          </h1>
          <div className="hero-row">
            <p className="lead">
              PrivateChat has no accounts and no history. Messages pass through and are deleted the moment they are
              delivered.
            </p>
            <div className="hero-cta">
              <Link className="btn btn-dark" href="/chat">
                Start a chat
              </Link>
              <a className="btn btn-soft" href="#tour">
                See how it works
              </a>
            </div>
          </div>
        </section>

        <p className="strip">
          <span className="pill">TRY IT</span> Watch a chat happen, then type your own message. It all runs in your
          browser.
        </p>

        <Demo />
        <Tour />

        <Reveal as="section" className="final">
          <div className="final-stk" aria-hidden="true">
            <Sticker id="tag" />
            <Sticker id="chat" />
            <Sticker id="ghost" />
          </div>
          <h2>Start a chat. No sign-up, just an ID.</h2>
          <Link className="btn btn-dark" href="/chat">
            Open PrivateChat
          </Link>
          <p className="fine">Sent over HTTPS and deleted from the relay on delivery. Not end-to-end encrypted.</p>
        </Reveal>

        <footer className="foot">
          <span>PrivateChat</span>
          <Link href="/chat">Open chat</Link>
        </footer>
      </div>
    </>
  );
}
