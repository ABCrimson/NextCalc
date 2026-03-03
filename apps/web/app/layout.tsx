import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

// Next.js 16.2.0: Enhanced Metadata API with comprehensive SEO + PWA
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'),
  title: {
    template: '%s | NextCalc Pro',
    default: 'NextCalc Pro - Modern Scientific Calculator',
  },
  description:
    'Advanced scientific calculator powered by React 19.3.0, Next.js 16.2.0, with symbolic math, WASM-powered precision, and real-time calculations',
  keywords: [
    'calculator',
    'scientific calculator',
    'math calculator',
    'online calculator',
    'WASM calculator',
    'symbolic math',
    'LaTeX',
    'graphing calculator',
    'React 19.3.0',
    'Next.js 16.2.0',
    'PWA',
    'offline calculator',
  ],
  authors: [{ name: 'NextCalc Team' }],
  creator: 'NextCalc Pro',
  publisher: 'NextCalc Pro',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'NextCalc Pro - Modern Scientific Calculator',
    description:
      'Advanced scientific calculator with symbolic math, plotting, and WASM-powered precision',
    type: 'website',
    locale: 'en_US',
    siteName: 'NextCalc Pro',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NextCalc Pro - Modern Scientific Calculator',
    description: 'Advanced scientific calculator powered by React 19.3.0 and Next.js 16.2.0',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NextCalc Pro',
  },
  applicationName: 'NextCalc Pro',
};

// Next.js 16.2.0: Viewport configuration
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F1F5F9' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1629' },
  ],
};

/**
 * Root layout — thin shell for <html>, <head>, and <body>.
 *
 * All providers (Apollo, next-intl, etc.) and the Navigation component
 * live in the [locale] layout so they have access to the current locale.
 *
 * Reads the `theme` cookie server-side to set the initial data-theme attribute
 * on <html>, preventing a flash of wrong theme on first load. The inline script
 * still runs as a fallback for first-time visitors who don't have a cookie yet.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('theme')?.value;
  // Only use known valid values; fall back to inline script detection otherwise
  const serverTheme = themeCookie === 'light' || themeCookie === 'dark' ? themeCookie : undefined;

  return (
    <html suppressHydrationWarning {...(serverTheme ? { 'data-theme': serverTheme } : {})}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NextCalc Pro" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Theme initialization — inline script as fallback for first-time visitors
            without a theme cookie. Also syncs localStorage → cookie for persistence.
            suppressHydrationWarning avoids browser-extension-induced mismatch. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);document.cookie='theme='+t+';path=/;max-age=31536000;SameSite=Lax'}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
