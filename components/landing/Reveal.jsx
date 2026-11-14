'use client';

import { useEffect, useRef } from 'react';

// Fades its content in the first time it scrolls into view. Without JavaScript
// the content is simply visible: the hidden state only applies under `.js`.
export default function Reveal({ as: Tag = 'div', className = '', children }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    document.documentElement.classList.add('js');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          node.classList.add('in');
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`${className} reveal`.trim()}>
      {children}
    </Tag>
  );
}
