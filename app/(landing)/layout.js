import './landing.css';

export const metadata = {
  title: 'PrivateChat - one-to-one chat with no accounts and no history',
  description:
    "PrivateChat is a one-to-one chat with no accounts and no history. Share an ID, chat, close the tab and it's gone.",
};

export const viewport = {
  colorScheme: 'light dark',
};

export default function LandingLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/geist.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
