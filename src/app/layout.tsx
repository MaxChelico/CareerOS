import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CareerOS",
  description: "Personal job-search dashboard",
};

// Every page reads live data from the local database.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-slate-200 bg-white">
          <div className="flex h-14 items-center gap-8 px-6">
            <Link href="/" className="text-base font-semibold tracking-tight">
              Career<span className="text-sky-600">OS</span>
            </Link>
            <nav className="flex gap-5 text-sm text-slate-600">
              <Link href="/" className="hover:text-slate-900">
                Board
              </Link>
              <Link href="/profile" className="hover:text-slate-900">
                Profile
              </Link>
              <Link href="/analytics" className="hover:text-slate-900">
                Analytics
              </Link>
            </nav>
            <Link href="/jobs/new" className="btn-primary ml-auto">
              + Add job
            </Link>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
