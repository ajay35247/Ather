import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ather — Omni-Social OS',
  description:
    'A unified social, communication, and creator platform. Phase 0 scaffold.'
};

export const viewport: Viewport = {
  themeColor: '#0b0b10'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
