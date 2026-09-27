import Link from 'next/link';
import {
  Zap,
  ArrowRight,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/20 text-slate-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-100 bg-white/80 px-6 backdrop-blur-md max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-100 group-hover:scale-105 transition-transform">
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-slate-900">MailAutomator</span>
            <span className="text-[10px] font-normal text-slate-400">Smart Email Platform</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Sign In
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium h-9 px-4 shadow-xs"
            >
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 pt-16 pb-20 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-semibold mb-6 shadow-2xs">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Zero manual spreadsheet cleaning required</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 max-w-4xl mx-auto leading-tight">
          Turn Messy Spreadsheets into{' '}
          <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            Clean, Controlled
          </span>{' '}
          Bulk Email Campaigns
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Upload any Google Forms export, Excel file, or CSV. MailAutomator automatically scans
          every cell, extracts verified emails, removes duplicates, and delivers individual messages
          via a controlled queue.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Link href="/signup" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold h-11 px-8 gap-2 shadow-md shadow-indigo-100"
            >
              <span>Start Free Import</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto text-slate-700 border-slate-200 text-sm font-semibold h-11 px-6 hover:bg-slate-50"
            >
              Explore Live Demo
            </Button>
          </Link>
        </div>

        {/* Highlights Pill */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Multi-sheet & cell scan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Smart deduplication</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Controlled rate queue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>No CC/BCC email leaking</span>
          </div>
        </div>
      </section>

      {/* Spreadsheet Irregularity Solver Interactive Graphic */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-2 text-xs">
              Intelligent Processing Demo
            </Badge>
            <h2 className="text-2xl font-bold text-slate-900">
              How MailAutomator Handles Real-World Messy Data
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              You don&apos;t have to rename columns or delete empty rows manually.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 items-center">
            {/* Left: Messy Input Table */}
            <div className="rounded-xl border border-red-200 bg-red-50/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                  Raw / Messy Input Spreadsheet
                </span>
                <Badge variant="destructive" className="text-[10px]">
                  Unorganized
                </Badge>
              </div>
              <div className="space-y-2 font-mono text-[11px] bg-white rounded-lg p-3 border border-red-100 shadow-2xs">
                <div className="text-slate-400 pb-1 border-b border-slate-100 flex justify-between font-bold">
                  <span>Name</span>
                  <span>Phone</span>
                  <span>Information / Notes</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Arun</span>
                  <span className="text-slate-400">9876543210</span>
                  <span className="text-indigo-600 font-semibold">arun@gmail.com</span>
                </div>
                <div className="flex justify-between py-1 text-slate-300">
                  <span>Priya</span>
                  <span>NULL</span>
                  <span>NULL</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Rahul</span>
                  <span className="text-slate-400">9123456780</span>
                  <span className="text-indigo-600 font-semibold">Contact: rahul@gmail.com</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Kiran</span>
                  <span className="text-slate-300">-</span>
                  <span className="text-indigo-600 font-semibold">
                    kiran@gmail.com / 9876543210
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Clean Extracted Recipients */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Clean Verified Output
                </span>
                <Badge variant="success" className="text-[10px]">
                  3 Clean Recipients Found
                </Badge>
              </div>
              <div className="space-y-2 bg-white rounded-lg p-3 border border-emerald-100 shadow-2xs">
                <div className="flex items-center justify-between p-2 rounded bg-emerald-50/50 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-900">arun@gmail.com</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Row 1, Col C</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-emerald-50/50 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-900">rahul@gmail.com</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Row 3, Col C</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-emerald-50/50 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-900">kiran@gmail.com</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Row 4, Col C</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Engineered for Event Organizers, Coordinators & Teams
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Everything you need to broadcast announcements, ticket confirmations, certificates, and
            reminders reliably.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Confidence Scoring</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Calculates email presence ratio for every column and flags email-heavy sections
                while still catching stray addresses.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Privacy-Preserving Delivery</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Treats every recipient as an independent delivery. Never expose your entire mailing
                list through bulk CC or BCC headers.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Live Delivery Diagnostics</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Track exact recipient outcomes: Queued, Sending, Delivered, Failed, and Bounced with
                full traceability back to the original spreadsheet row.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-600" />
            <span className="font-semibold text-slate-800">MailAutomator</span>
            <span>— Smart Bulk Email Automation</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-slate-900">
              Login
            </Link>
            <Link href="/signup" className="hover:text-slate-900">
              Sign Up
            </Link>
            <Link href="/dashboard" className="hover:text-slate-900">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
