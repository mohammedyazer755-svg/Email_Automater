import * as React from 'react';
import Link from 'next/link';
import { Zap, ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-50 via-white to-indigo-50/20">
      {/* Top mini header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-slate-100/80 bg-white/60 backdrop-blur-xs">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-100 group-hover:scale-105 transition-transform">
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-slate-900">MailAutomator</span>
            <span className="text-[10px] font-normal text-slate-400">Smart Bulk Communication</span>
          </div>
        </Link>
        <Link
          href="/"
          className="text-xs font-medium text-slate-600 hover:text-indigo-600 transition"
        >
          ← Back to home
        </Link>
      </header>

      {/* Main Form Center Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">{children}</div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-100">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
          <span>Secure authentication with individual recipient delivery</span>
        </div>
        © {new Date().getFullYear()} MailAutomator. All rights reserved.
      </footer>
    </div>
  );
}
