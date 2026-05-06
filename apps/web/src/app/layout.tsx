import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/layout/Providers';

export const metadata: Metadata = {
  title: 'Ather — आपका सोशल OS · Bharat-First Social Platform',
  description:
    'One identity for posts, chats, communities, payments and creator earnings. Built for India first — UPI-native, multilingual, DPDP-compliant.',
  openGraph: {
    title: 'Ather — Bharat-First Social Platform',
    description:
      'Chat, create, stream, discover, and earn — all inside Ather. Built for the next billion users.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#f97316',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body className="font-sans bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
