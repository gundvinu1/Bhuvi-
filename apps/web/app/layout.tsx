import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APP_FULL_NAME, APP_NAME } from '@bhuvi/shared';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} – ${APP_FULL_NAME}`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    'BHUVI is a modular, local-first Personal AI Operating System that acts as your intelligent digital brain.',
  keywords: ['AI', 'personal assistant', 'local AI', 'Ollama', 'productivity'],
  authors: [{ name: 'BHUVI Team' }],
  robots: 'noindex, nofollow', // Private local application
};

export const viewport: Viewport = {
  themeColor: '#1e1f4b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 font-sans">
        {children}
      </body>
    </html>
  );
}

