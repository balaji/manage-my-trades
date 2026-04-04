import type { Metadata } from 'next';
import { Google_Sans } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { AuthProvider } from '@/lib/auth-context';

const googleSans = Google_Sans({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Algorithmic ETF Trading',
  description: 'Full-stack algorithmic trading application for ETFs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={googleSans.className}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
