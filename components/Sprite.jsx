// Sticker icons, referenced elsewhere with <use href="#s-...">. Rendered once
// at the top of each page that uses them.
export default function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="s-tag" viewBox="0 0 48 48">
          <path d="M20 8h18a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H20L6 24z" fill="#fff" stroke="#fff" strokeWidth="8" strokeLinejoin="round" />
          <path d="M20 8h18a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H20L6 24z" fill="#ffb454" stroke="#1b1b1b" strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="16.5" cy="24" r="3" fill="#fff" stroke="#1b1b1b" strokeWidth="2.2" />
          <path d="M25 18.5h11M25 24h11M25 29.5h7" stroke="#1b1b1b" strokeWidth="2.4" strokeLinecap="round" />
        </symbol>
        <symbol id="s-chat" viewBox="0 0 48 48">
          <g fill="#fff" stroke="#fff" strokeWidth="8" strokeLinejoin="round">
            <path d="M19 5h19a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6h-1v6l-7-6H19a6 6 0 0 1-6-6V11a6 6 0 0 1 6-6z" />
            <path d="M10 20h16a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5H17l-7 5v-5a5 5 0 0 1-5-5v-9a5 5 0 0 1 5-5z" />
          </g>
          <path d="M19 5h19a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6h-1v6l-7-6H19a6 6 0 0 1-6-6V11a6 6 0 0 1 6-6z" fill="#b7a6ff" stroke="#1b1b1b" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M10 20h16a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5H17l-7 5v-5a5 5 0 0 1-5-5v-9a5 5 0 0 1 5-5z" fill="#fff" stroke="#1b1b1b" strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="12" cy="29.5" r="1.9" fill="#1b1b1b" />
          <circle cx="18" cy="29.5" r="1.9" fill="#1b1b1b" />
          <circle cx="24" cy="29.5" r="1.9" fill="#1b1b1b" />
        </symbol>
        <symbol id="s-check" viewBox="0 0 48 48">
          <rect x="6" y="6" width="36" height="36" rx="11" fill="#fff" stroke="#fff" strokeWidth="8" />
          <rect x="6" y="6" width="36" height="36" rx="11" fill="#6fdc9b" stroke="#1b1b1b" strokeWidth="2.4" />
          <path d="M15.5 24.5l6 6 11.5-13" fill="none" stroke="#1b1b1b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="s-ghost" viewBox="0 0 48 48">
          <path d="M24 5C15 5 9 11.5 9 20.5V42l5-4 5 4 5-4 5 4 5-4 5 4V20.5C39 11.5 33 5 24 5z" fill="#fff" stroke="#fff" strokeWidth="8" strokeLinejoin="round" />
          <path d="M24 5C15 5 9 11.5 9 20.5V42l5-4 5 4 5-4 5 4 5-4 5 4V20.5C39 11.5 33 5 24 5z" fill="#ffb8d2" stroke="#1b1b1b" strokeWidth="2.4" strokeLinejoin="round" />
          <ellipse cx="19" cy="20" rx="2.3" ry="3.2" fill="#1b1b1b" />
          <ellipse cx="29" cy="20" rx="2.3" ry="3.2" fill="#1b1b1b" />
          <path d="M20.5 28q3.5 3 7 0" fill="none" stroke="#1b1b1b" strokeWidth="2.2" strokeLinecap="round" />
        </symbol>
      </defs>
    </svg>
  );
}

export function Sticker({ id, className = 'stk', style }) {
  return (
    <svg className={className} style={style} aria-hidden="true">
      <use href={`#s-${id}`} />
    </svg>
  );
}
