'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';
import api from '@/lib/api';
import { Boxes, Loader2 } from 'lucide-react';

interface MiniApp {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  version: string;
  permissions: string[];
}

export default function MiniAppsPage() {
  const [catalog, setCatalog] = useState<MiniApp[]>([]);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [c, i] = await Promise.all([
      api.get('/api/mini-apps'),
      api.get('/api/mini-apps/installed').catch(() => ({ data: { data: [] } })),
    ]);
    setCatalog(c.data.data || []);
    setInstalled(new Set((i.data.data || []).map((a: MiniApp) => a.id)));
    setLoading(false);
  }

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, []);

  async function toggle(app: MiniApp) {
    setBusyId(app.id);
    try {
      if (installed.has(app.id)) {
        await api.delete(`/api/mini-apps/${app.id}/install`);
      } else {
        await api.post(`/api/mini-apps/${app.id}/install`);
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 pb-20 md:pb-6">
        <header className="flex items-center gap-2 mb-6">
          <Boxes className="w-6 h-6 text-brand-500" />
          <h1 className="text-2xl font-bold">Mini Apps</h1>
        </header>
        <p className="text-gray-500 text-sm mb-6">
          Extend Ather with curated mini-apps. Install only what you need.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.map((app) => {
            const isInstalled = installed.has(app.id);
            return (
              <article
                key={app.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col"
              >
                <div className="text-3xl">{app.icon}</div>
                <h2 className="font-semibold mt-2">{app.name}</h2>
                <p className="text-xs uppercase tracking-wide text-brand-500 mt-1">
                  {app.category} · v{app.version}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex-1">
                  {app.description}
                </p>

                {app.permissions.length > 0 && (
                  <details className="mt-3 text-xs">
                    <summary className="text-gray-500 cursor-pointer select-none">
                      {app.permissions.length} permission(s)
                    </summary>
                    <ul className="mt-1 list-disc pl-5 text-gray-500">
                      {app.permissions.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </details>
                )}

                <button
                  onClick={() => toggle(app)}
                  disabled={busyId === app.id}
                  className={`mt-4 w-full py-2 rounded-xl text-sm font-medium ${
                    isInstalled
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      : 'bg-brand-500 text-white hover:bg-brand-600'
                  } disabled:opacity-50`}
                >
                  {busyId === app.id
                    ? '…'
                    : isInstalled
                    ? 'Installed · Remove'
                    : 'Install'}
                </button>
              </article>
            );
          })}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
