'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  MessageCircle,
  Users,
  User,
  Radio,
  Bell,
  Search,
  PlusCircle,
  LogOut,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

const navItems = [
  { href: '/feed', label: 'Home', icon: Home },
  { href: '/feed?type=reel', label: 'Reels', icon: TrendingUp },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/communities', label: 'Communities', icon: Users },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push('/');
  }

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 px-4 py-6 gap-2">
      {/* Logo */}
      <Link href="/feed" className="flex items-center gap-2 px-4 mb-6">
        <Sparkles className="w-6 h-6 text-brand-500" />
        <span className="text-xl font-extrabold text-brand-600">Ather</span>
      </Link>

      {/* Search */}
      <Link href="/search" className="flex items-center gap-3 px-4 py-3 mb-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
        <Search className="w-4 h-4" />
        <span>Search Ather…</span>
      </Link>

      {/* Nav items */}
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/feed' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={clsx(isActive ? 'nav-link-active' : 'nav-link')}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        );
      })}

      {/* Create post */}
      <Link href="/feed/create" className="btn-primary flex items-center justify-center gap-2 mt-4">
        <PlusCircle className="w-4 h-4" />
        Create Post
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User */}
      {user && (
        <div className="border-t border-gray-200 dark:border-gray-800 pt-4 mt-4">
          <Link href="/profile" className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-gray-500 truncate">@{user.username}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 mt-1 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-500 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
