import type { Metadata } from 'next';
import { Google_Sans } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

const googleSans = Google_Sans({
  subsets: ['latin'],
  fallback: ['system-ui', 'Arial', 'Helvetica', 'sans-serif'],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: 'Algorithmic ETF Trading',
  description: 'Full-stack algorithmic trading application for ETFs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={googleSans.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
