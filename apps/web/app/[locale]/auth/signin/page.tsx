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

import { AlertCircle, Calculator, Chrome, Github, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn as nextAuthSignIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { type ComponentType, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

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
    icon: Github,
    colorClasses:
      'bg-[#24292e] text-white hover:bg-[#2f363d] dark:bg-[#f0f6ff]/10 dark:text-foreground dark:hover:bg-[#f0f6ff]/20 border border-transparent dark:border-border/50',
  },
  {
    id: 'google',
    label: 'continueWithGoogle',
    icon: Chrome,
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
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
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
