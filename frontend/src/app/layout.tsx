import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Caveat } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-bricolage',
  display: 'swap',
});

// ponytail: ručně psané písmo jen pro poznámky průvodců a data na razítkách
const caveat = Caveat({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-caveat',
  display: 'swap',
});

const appName = 'Západ GO';

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: 'Turistický pas Karlovarského kraje: sbírej razítka z hradů, rozhleden a pramenů a z každého ti vyroste tvor do souboje.',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f4ec' },
    { media: '(prefers-color-scheme: dark)', color: '#13201a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs" className={`${bricolage.variable} ${caveat.variable}`} suppressHydrationWarning>
      <body
        className="min-h-dvh bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        {/* ponytail: cookie lišta vyjmuta, používáme jen nezbytné cookies (JWT, CSRF); vrátit z components/cookies, až přibude analytika */}
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
