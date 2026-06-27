'use client';

/**
 * Sign-In Page
 *
 * Custom NextAuth v5 sign-in page at /auth/signin.
 *
 * NextAuth's `pages.signIn` config key is set to '/auth/signin' so
 * the framework redirects here instead of its built-in page.
 *
 * Accessibility:
 * - Main landmark with descriptive label
 * - Keyboard navigable buttons (Tab, Enter, Space)
 * - Descriptive aria-labels on all interactive elements
 * - Focus rings via focus-visible
 * - Error state announced via aria-live
 *
 * @see https://authjs.dev/guides/pages/signin
 */

import { AlertCircle, Calculator, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { signIn as nextAuthSignIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { type ComponentType, Suspense, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

// Brand marks. Lucide 1.x removed brand icons (Github, Chrome, …), so the
// OAuth provider logos are inlined here. Both accept the same minimal prop
// shape as a Lucide icon so they slot into ProviderConfig.icon unchanged.
type BrandIconProps = { className?: string; 'aria-hidden'?: 'true' };

function GithubIcon({ className }: BrandIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function GoogleIcon({ className }: BrandIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

type OAuthProvider = 'github' | 'google';

interface ProviderConfig {
  id: OAuthProvider;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;
  colorClasses: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'github',
    label: 'continueWithGithub',
    icon: GithubIcon,
    colorClasses:
      'bg-[#24292e] text-white hover:bg-[#2f363d] dark:bg-[#f0f6ff]/10 dark:text-foreground dark:hover:bg-[#f0f6ff]/20 border border-transparent dark:border-border/50',
  },
  {
    id: 'google',
    label: 'continueWithGoogle',
    icon: GoogleIcon,
    colorClasses:
      'bg-white text-[#3c4043] hover:bg-muted dark:bg-foreground/5 dark:text-foreground dark:hover:bg-foreground/10 border border-[#dadce0] dark:border-border/50',
  },
];

/** Known error codes from NextAuth. */
const AUTH_ERROR_KEYS: Record<string, string> = {
  OAuthSignin: 'error.OAuthSignin',
  OAuthCallback: 'error.OAuthCallback',
  OAuthCreateAccount: 'error.OAuthCreateAccount',
  EmailCreateAccount: 'error.EmailCreateAccount',
  Callback: 'error.Callback',
  OAuthAccountNotLinked: 'error.OAuthAccountNotLinked',
  EmailSignin: 'error.EmailSignin',
  CredentialsSignin: 'error.CredentialsSignin',
  SessionRequired: 'error.SessionRequired',
  Default: 'error.Default',
};

function resolveErrorKey(errorCode: string | null): string | null {
  if (!errorCode) return null;
  return AUTH_ERROR_KEYS[errorCode] ?? AUTH_ERROR_KEYS.Default ?? null;
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get('callbackUrl') ?? '/';
  const callbackUrl =
    rawCallback.startsWith('/') && !rawCallback.startsWith('//') ? rawCallback : '/';
  const errorCode = searchParams.get('error');
  const errorKey = resolveErrorKey(errorCode);
  const errorMessage = errorKey ? t(errorKey) : null;

  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  // Reset loading state if page re-renders after a failed redirect
  useEffect(() => {
    if (errorCode) {
      setLoadingProvider(null);
    }
  }, [errorCode]);

  // Timeout: reset loading state if redirect takes too long
  useEffect(() => {
    if (!loadingProvider) return;
    const timeout = setTimeout(() => {
      setLoadingProvider(null);
      setRedirectError(t('error.redirectTimeout'));
    }, 12000);
    return () => clearTimeout(timeout);
  }, [loadingProvider, t]);

  const handleProviderSignIn = async (providerId: OAuthProvider) => {
    setLoadingProvider(providerId);
    setRedirectError(null);
    try {
      // Use NextAuth's built-in signIn which handles CSRF, redirect URL
      // construction, and provider validation automatically.
      await nextAuthSignIn(providerId, { callbackUrl });
    } catch {
      setLoadingProvider(null);
      setRedirectError(t('error.redirectFailed'));
    }
  };

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12"
      aria-label={t('signInLabel')}
    >
      <div className="w-full max-w-sm space-y-8">
        {/* Logo + heading */}
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/"
            className="group flex items-center gap-2.5 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring rounded-md"
            aria-label={t('goHome')}
          >
            <div className="relative">
              <Calculator
                className="h-8 w-8 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
                aria-hidden="true"
              />
              <div className="absolute -inset-1.5 rounded-full bg-primary/20 blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
              NextCalc Pro
            </span>
          </Link>

          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t('welcomeBack')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('signInSubtitle')}</p>
          </div>
        </div>

        {/* Error message */}
        {(errorMessage || redirectError) && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{errorMessage || redirectError}</p>
          </div>
        )}

        {/* Provider buttons */}
        <fieldset className="space-y-3 border-0 p-0 m-0" aria-label={t('signInOptions')}>
          {PROVIDERS.map(({ id, label, icon: Icon, colorClasses }) => {
            const isLoading = loadingProvider === id;
            const isDisabled = loadingProvider !== null;

            return (
              <button
                key={id}
                type="button"
                onClick={() => handleProviderSignIn(id)}
                disabled={isDisabled}
                aria-label={t(label)}
                aria-busy={isLoading}
                className={cn(
                  'relative flex w-full items-center justify-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium',
                  'transition-all duration-200',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  colorClasses,
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isLoading ? t('redirecting') : t(label)}</span>
              </button>
            );
          })}
        </fieldset>

        {/* Divider */}
        <div className="relative" aria-hidden="true">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs text-muted-foreground">
              {t('noAccountRequired')}
            </span>
          </div>
        </div>

        {/* Guest option */}
        <div className="text-center">
          <Link
            href={callbackUrl}
            className={cn(
              'text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded',
              'transition-colors duration-200',
            )}
          >
            {t('continueWithout')}
          </Link>
        </div>

        {/* Legal */}
        <p className="text-center text-xs text-muted-foreground/70">
          {t('legalPrefix')} <span className="text-muted-foreground">{t('termsOfService')}</span>
          {' & '}
          <span className="text-muted-foreground">{t('privacyPolicy')}</span>.
        </p>
      </div>
    </main>
  );
}
