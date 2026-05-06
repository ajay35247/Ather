import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ather — आपका सोशल OS · Bharat-First Social Platform',
  description:
    'One identity for posts, chats, communities, payments and creator earnings. Built for India first — UPI-native, multilingual, DPDP-compliant.'
};

export const viewport: Viewport = {
  themeColor: '#ff9933'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
