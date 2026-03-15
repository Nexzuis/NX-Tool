import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ShellClient } from '@/components/layout/shell-client';

export const metadata: Metadata = {
  title: {
    default: 'Ghosthome Monitor',
    template: '%s — Ghosthome Monitor',
  },
  description:
    'Real-time infrastructure health monitor for NX Witness VMS and IP camera networks.',
  robots: 'noindex, nofollow', // Internal tool — do not index
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A0A0F',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <ShellClient>{children}</ShellClient>
      </body>
    </html>
  );
}
