'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageCircle, Users, User, Radio } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { href: '/feed', label: 'Home', icon: Home },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/communities', label: 'Communities', icon: Users },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/profile', label: 'Me', icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-around px-2 py-2 safe-area-bottom">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/feed' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors',
              isActive
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-gray-500 dark:text-gray-400',
            )}
          >
            <Icon className={clsx('w-6 h-6', isActive && 'stroke-[2.5]')} />
            <span className="text-xs font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
