import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { Analytics } from '@vercel/analytics/next';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'MailAutomator',
    description: 'Clean contacts. Thoughtful campaigns. Reliable delivery.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'MailAutomator' },
  title: 'MailAutomator — Smart Email Automation Platform',
  description:
    'Automatically extract and clean recipient emails from messy CSV/Excel spreadsheets, compose campaigns, and deliver via controlled sending queues.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-slate-50/50 text-slate-900">
        {children}
        <Toaster position="top-right" richColors />
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}
