'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useStore } from '@/store/useStore';

export const ErrorBanner: React.FC = () => {
  const { error, clearError } = useStore();

  if (!error) return null;

  return (
    <div className="fixed top-4 left-1/2 z-[70] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-lg border border-red-200 bg-white px-4 py-3 shadow-lg" role="alert">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-red-900">Unable to save changes</div>
          <div className="mt-0.5 break-words text-sm text-red-700">{error}</div>
        </div>
        <button
          type="button"
          onClick={clearError}
          className="shrink-0 rounded-md p-1 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
          aria-label="Dismiss error"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
