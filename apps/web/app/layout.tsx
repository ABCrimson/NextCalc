import { type ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Navigation } from '@/components/layout/navigation';
import { ApolloWrapper } from '@/components/providers/apollo-provider';
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
  metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000'),
  title: {
    template: '%s | NextCalc Pro',
    default: 'NextCalc Pro - Modern Scientific Calculator',
  },
  description: 'Advanced scientific calculator powered by React 19.3.0, Next.js 16.2.0, with symbolic math, WASM-powered precision, and real-time calculations',
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
    description: 'Advanced scientific calculator with symbolic math, plotting, and WASM-powered precision',
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
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/icon-192.png',
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
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NextCalc Pro" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Theme initialization — plain script with suppressHydrationWarning avoids
            browser-extension-induced mismatch (extensions can modify script tags) */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`
          }}
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`} suppressHydrationWarning>
        <ApolloWrapper>
          <Navigation />
          {children}
        </ApolloWrapper>
      </body>
    </html>
  );
}
