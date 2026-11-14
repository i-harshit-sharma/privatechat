import './chat/chat.css';

export const metadata = {
  title: 'PrivateChat',
  referrer: 'no-referrer',
};

export const viewport = {
  colorScheme: 'light dark',
};

// The chat has its own root layout (and stylesheet), separate from the landing page.
export default function ChatLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/geist.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
