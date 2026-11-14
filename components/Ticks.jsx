// Delivery status of a sent message: awaiting -> received -> seen.
const TICKS = {
  awaiting: {
    label: 'Awaiting delivery',
    w: 16,
    paths: (
      <>
        <circle cx="8" cy="8" r="6" />
        <path d="M8 4.8V8l2.3 1.4" />
      </>
    ),
  },
  received: { label: 'Received', w: 16, paths: <path d="M2.5 8.5l3.2 3.2 6.8-6.9" /> },
  seen: {
    label: 'Seen',
    w: 22,
    paths: (
      <>
        <path d="M1.5 8.5l3.2 3.2 6.8-6.9" />
        <path d="M9.6 10.4l1.3 1.3 6.8-6.9" />
      </>
    ),
  },
};

export default function Tick({ state, className = 'tick' }) {
  const t = TICKS[state];
  if (!t) return null;
  return (
    <span className={`${className} ${state}`} title={t.label} role="img" aria-label={t.label}>
      <svg
        viewBox={`0 0 ${t.w} 16`}
        width={t.w}
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {t.paths}
      </svg>
    </span>
  );
}
