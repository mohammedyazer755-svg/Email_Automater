import Link from 'next/link';
import { Search, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Search className="h-7 w-7" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">
            404 Error
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Page Not Found</h2>
          <p className="text-xs text-slate-500 mt-2">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/dashboard">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 gap-1.5 shadow-xs"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Go to Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
