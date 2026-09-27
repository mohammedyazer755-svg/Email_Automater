'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, User, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>();

  React.useEffect(() => {
    async function checkUser() {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.email) {
          setUserEmail(data.user.email);
          setAvatarUrl(data.user.user_metadata?.avatar_url);
        }
      } catch {
        // Fallback for dev without live Supabase connection
      }
    }
    checkUser();
  }, [supabase]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Signed out successfully');
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Failed to sign out');
    }
  };

  const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : 'U';

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile hamburger & breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1 font-medium text-slate-900">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            MailAutomator Workspace
          </span>
          <span className="text-slate-300">/</span>
          <span>Controlled Rate Sending</span>
        </div>
      </div>

      {/* Right: Search, Notifications, User Menu */}
      <div className="flex items-center gap-3">
        {/* Quick action: New Campaign */}
        <Link href="/campaigns/new" className="hidden sm:inline-flex">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-slate-700 border-slate-200"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>New Campaign</span>
          </Button>
        </Link>

        {/* User profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full ring-2 ring-transparent transition hover:ring-indigo-100 focus:outline-none">
              <Avatar className="h-8 w-8 border border-slate-200">
                <AvatarImage src={avatarUrl} alt="Profile avatar" />
                <AvatarFallback className="bg-indigo-600 text-white font-medium text-xs">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-1">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-medium text-slate-900 leading-none truncate">Account</p>
                <p className="text-[11px] text-slate-500 leading-none truncate">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard" className="flex items-center gap-2 text-xs">
                <User className="h-3.5 w-3.5 text-slate-500" />
                <span>Dashboard</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 text-xs">
                <Settings className="h-3.5 w-3.5 text-slate-500" />
                <span>Settings & Senders</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-red-600 focus:bg-red-50 focus:text-red-700 text-xs cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
