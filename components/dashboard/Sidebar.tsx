'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Mail,
  FileText,
  BarChart3,
  Settings,
  Sparkles,
  Zap,
  X,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useResource } from '@/components/platform/shared';

export const navigationItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'Overview & quick actions',
  },
  {
    name: 'Contacts',
    href: '/contacts',
    icon: Users,
    description: 'Manage recipient list',
  },
  {
    name: 'Imports',
    href: '/imports',
    icon: FileSpreadsheet,
    description: 'Smart spreadsheet parser',
  },
  {
    name: 'Campaigns',
    href: '/campaigns',
    icon: Mail,
    description: 'Compose & send emails',
  },
  {
    name: 'Templates',
    href: '/templates',
    icon: FileText,
    description: 'Reusable email formats',
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Delivery stats & insights',
  },
  { name: 'Automations', href: '/automations', icon: Zap, description: 'Email sequences' },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Senders & preferences',
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();
  const contacts = useResource<{ count: number }>('contacts?size=1');
  const reloadContacts = contacts.reload;
  React.useEffect(() => {
    const update = () => reloadContacts();
    window.addEventListener('contacts-changed', update);
    return () => window.removeEventListener('contacts-changed', update);
  }, [reloadContacts]);

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200">
      {/* Brand Header */}
      <div>
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 font-bold text-slate-900 group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-100 group-hover:scale-105 transition-transform">
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                MailAutomator
                <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 border border-indigo-100">
                  v1.0
                </span>
              </span>
              <span className="text-[11px] font-normal text-slate-400">Smart Email Platform</span>
            </div>
          </Link>
          {setMobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Quick Action Button */}
        <div className="px-4 pt-4 pb-2">
          <Link href="/imports/new">
            <Button className="w-full justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-medium text-xs h-9">
              <Plus className="h-4 w-4" />
              <span>Import Spreadsheet</span>
            </Button>
          </Link>
        </div>

        {/* Navigation List */}
        <div className="px-3 py-2 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Platform
          </div>
          {navigationItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen && setMobileOpen(false)}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600',
                    )}
                  />
                  <span>
                    {item.name}
                    {item.name === 'Contacts' && contacts.data && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                        {contacts.data.count.toLocaleString()}
                      </span>
                    )}
                  </span>
                </div>
                {isActive && <div className="h-1.5 w-1.5 rounded-full bg-indigo-600" />}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Pro / Help Box */}
      <div className="p-4 border-t border-slate-100">
        <div className="rounded-xl bg-gradient-to-br from-indigo-50 via-blue-50/50 to-slate-50 p-3.5 border border-indigo-100/60 shadow-2xs">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold text-xs mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Smart Cleaning Active</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Auto-detects emails in any row or column with zero manual formatting needed.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30 shadow-xs">
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen && setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl z-50">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
