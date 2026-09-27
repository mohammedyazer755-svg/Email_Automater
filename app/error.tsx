'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Global Error Boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
          <p className="text-xs text-slate-500 mt-2">
            {error.message || 'An unexpected error occurred while processing your request.'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => reset()}
            variant="outline"
            size="sm"
            className="text-xs h-9 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>
          <Link href="/dashboard">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 gap-1.5 shadow-xs"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
