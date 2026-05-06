'use client';

import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          className: '!bg-white dark:!bg-gray-900 !text-gray-900 dark:!text-gray-100 !shadow-lg !rounded-xl !border !border-gray-200 dark:!border-gray-800',
          duration: 3000,
        }}
      />
    </>
  );
}
