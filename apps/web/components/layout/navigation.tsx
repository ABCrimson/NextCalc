'use client';

import {
  Activity,
  BarChart2,
  BookOpen,
  Box,
  Brain,
  Calculator,
  Check,
  Flame,
  Globe,
  Grid3x3,
  Infinity,
  Library,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Network,
  Ruler,
  Settings,
  Sparkles,
  Square,
  TrendingUp,
  Trophy,
  User,
  Variable,
  Wind,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { signIn, signOut, useSession } from '@/lib/auth/hooks';
import { cn } from '@/lib/utils';
import { CommandPalette } from './command-palette';
import { ThemeToggle } from './theme-toggle';

interface NavLink {
  href: string;
  labelKey: string;
  descKey: string;
  icon: ComponentType<{ className?: string }>;
}

type LocaleCode = 'en' | 'ru' | 'es' | 'uk' | 'de';

const LOCALE_NAMES: Record<LocaleCode, string> = {
  en: 'English',
  ru: 'Русский',
  es: 'Español',
  uk: 'Українська',
  de: 'Deutsch',
} as const;

/** Direct link before dropdowns */
const preDropdownLinks: NavLink[] = [
  {
    href: '/',
    labelKey: 'nav.calculator',
    descKey: 'nav.calculatorDescription',
    icon: Calculator,
  },
];

/** Direct links after dropdowns */
const postDropdownLinks: NavLink[] = [
  {
    href: '/worksheet',
    labelKey: 'nav.worksheet',
    descKey: 'nav.worksheetDescription',
    icon: BookOpen,
  },
  {
    href: '/forum',
    labelKey: 'nav.forum',
    descKey: 'nav.forumDescription',
    icon: MessageSquare,
  },
];

/** All direct links (used for mobile menu) */
const directLinks: NavLink[] = [...preDropdownLinks, ...postDropdownLinks];

/** Tools dropdown links (mathematical tools & utilities) */
const toolLinks: NavLink[] = [
  {
    href: '/plot',
    labelKey: 'nav.plot',
    descKey: 'nav.plotDescription',
    icon: TrendingUp,
  },
  {
    href: '/symbolic',
    labelKey: 'nav.symbolic',
    descKey: 'nav.symbolicDescription',
    icon: Variable,
  },
  {
    href: '/matrix',
    labelKey: 'nav.matrix',
    descKey: 'nav.matrixDescription',
    icon: Grid3x3,
  },
  {
    href: '/solver',
    labelKey: 'nav.solver',
    descKey: 'nav.solverDescription',
    icon: Square,
  },
  {
    href: '/units',
    labelKey: 'nav.units',
    descKey: 'nav.unitsDescription',
    icon: Ruler,
  },
  {
    href: '/stats',
    labelKey: 'nav.stats',
    descKey: 'nav.statsDescription',
    icon: BarChart2,
  },
  {
    href: '/complex',
    labelKey: 'nav.complex',
    descKey: 'nav.complexDescription',
    icon: Infinity,
  },
  {
    href: '/formulas',
    labelKey: 'nav.formulas',
    descKey: 'nav.formulasDescription',
    icon: Library,
  },
  {
    href: '/templates',
    labelKey: 'nav.templates',
    descKey: 'nav.templatesDescription',
    icon: Box,
  },
];

const toolPaths = toolLinks.map((l) => l.href);

/** All links for mobile menu */
const allCoreLinks: NavLink[] = [...directLinks, ...toolLinks];

const algorithmLinks: NavLink[] = [
  {
    href: '/algorithms',
    labelKey: 'nav.algorithms',
    descKey: 'nav.algorithmsDescription',
    icon: Sparkles,
  },
  {
    href: '/fourier',
    labelKey: 'nav.fourier',
    descKey: 'nav.fourierDescription',
    icon: Activity,
  },
  {
    href: '/game-theory',
    labelKey: 'nav.gameTheory',
    descKey: 'nav.gameTheoryDescription',
    icon: Trophy,
  },
  {
    href: '/chaos',
    labelKey: 'nav.chaos',
    descKey: 'nav.chaosDescription',
    icon: Wind,
  },
  {
    href: '/pde',
    labelKey: 'nav.pde',
    descKey: 'nav.pdeDescription',
    icon: Flame,
  },
  {
    href: '/pde/3d',
    labelKey: 'nav.pde3d',
    descKey: 'nav.pde3dDescription',
    icon: Box,
  },
  {
    href: '/solver/ode',
    labelKey: 'nav.ode',
    descKey: 'nav.odeDescription',
    icon: Activity,
  },
  {
    href: '/graphs-full',
    labelKey: 'nav.graphs',
    descKey: 'nav.graphsDescription',
    icon: Network,
  },
  {
    href: '/ml-algorithms',
    labelKey: 'nav.ml',
    descKey: 'nav.mlDescription',
    icon: Brain,
  },
];

const algorithmPaths = [
  '/algorithms',
  '/fourier',
  '/game-theory',
  '/chaos',
  '/pde',
  '/pde/3d',
  '/solver/ode',
  '/graphs-full',
  '/ml-algorithms',
];

function UserAvatar({ name, image }: { name?: string; image?: string }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name || 'User avatar'}
        className="h-7 w-7 rounded-full ring-2 ring-border/50"
        referrerPolicy="no-referrer"
      />
    );
  }

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground ring-2 ring-border/50">
      {initials}
    </div>
  );
}

function LanguageSwitcher() {
  const locale = useLocale() as LocaleCode;
  const router = useRouter();
  const pathname = usePathname();

  const locales = Object.keys(LOCALE_NAMES) as LocaleCode[];

  const handleLocaleChange = (newLocale: LocaleCode) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label={`Language: ${LOCALE_NAMES[locale]}`}
        >
          <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline font-medium">{LOCALE_NAMES[locale]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 glass-heavy border-border/50">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onSelect={() => handleLocaleChange(loc)}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className={cn('font-medium', loc === locale && 'text-primary')}>
              {LOCALE_NAMES[loc]}
            </span>
            {loc === locale && (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Navigation() {
  const t = useTranslations();
  const pathname = usePathname();
  const { session, status } = useSession();

  const isLinkActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const isAlgorithmActive = algorithmPaths.some((p) => pathname.startsWith(p));

  const isToolActive = toolPaths.some((p) => pathname.startsWith(p));

  return (
    <nav
      className="sticky top-0 z-50 w-full glass-heavy shadow-sm"
      aria-label={t('accessibility.mainNavigation' as Parameters<typeof t>[0])}
    >
      {/* Subtle gradient border at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="container flex h-14 items-center min-w-0">
        {/* Logo */}
        <div className="mr-4 flex shrink-0">
          <Link
            href="/"
            className="mr-6 flex items-center gap-2.5 transition-all duration-300 hover:opacity-80 group"
            aria-label={t('nav.home' as Parameters<typeof t>[0])}
          >
            <div className="relative">
              <Calculator
                className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
                aria-hidden="true"
              />
              <div className="absolute -inset-1 bg-primary/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="hidden font-bold sm:inline-block bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent bg-[length:200%_auto] transition-all duration-500 group-hover:bg-[position:100%_50%]">
              NextCalc Pro
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:flex-1 md:items-center md:gap-1 md:text-sm md:font-medium min-w-0">
          {/* Calculator link */}
          {preDropdownLinks.map((link) => {
            const Icon = link.icon;
            const isActive = isLinkActive(link.href);
            const label = t(link.labelKey as Parameters<typeof t>[0]);
            const description = t(link.descKey as Parameters<typeof t>[0]);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all duration-200 relative group whitespace-nowrap text-[13px]',
                  isActive
                    ? 'text-primary-foreground bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
                aria-label={`${label} - ${description}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-200',
                    !isActive && 'group-hover:scale-110',
                  )}
                  aria-hidden="true"
                />
                {label}
              </Link>
            );
          })}

          {/* Tools dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 relative group whitespace-nowrap text-[13px]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  isToolActive
                    ? 'text-primary-foreground bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
                aria-label={t('nav.toolsMenu' as Parameters<typeof t>[0])}
              >
                <Grid3x3
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-200',
                    !isToolActive && 'group-hover:scale-110',
                  )}
                  aria-hidden="true"
                />
                {t('nav.tools' as Parameters<typeof t>[0])}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 glass-heavy border-border/50">
              {toolLinks.map((link) => {
                const Icon = link.icon;
                const isActive = isLinkActive(link.href);
                const label = t(link.labelKey as Parameters<typeof t>[0]);
                const description = t(link.descKey as Parameters<typeof t>[0]);

                return (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link
                      href={link.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg',
                        isActive && 'bg-primary/10 text-primary',
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <div className="flex flex-col">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">{description}</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Algorithms dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 relative group whitespace-nowrap text-[13px]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  isAlgorithmActive
                    ? 'text-primary-foreground bg-gradient-to-r from-calculator-special to-primary shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
                aria-label={t('nav.algorithmsMenu' as Parameters<typeof t>[0])}
              >
                <Sparkles
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-200',
                    !isAlgorithmActive && 'group-hover:scale-110 group-hover:rotate-12',
                  )}
                  aria-hidden="true"
                />
                {t('nav.algorithms' as Parameters<typeof t>[0])}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 glass-heavy border-border/50">
              <DropdownMenuItem asChild>
                <Link
                  href="/algorithms"
                  className={cn(
                    'flex items-center gap-3 rounded-lg',
                    pathname === '/algorithms' && 'bg-primary/10 text-primary',
                  )}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {t('nav.algorithmsAll' as Parameters<typeof t>[0])}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('nav.algorithmsBrowse' as Parameters<typeof t>[0])}
                    </span>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {algorithmLinks
                .filter((l) => l.href !== '/algorithms')
                .map((link) => {
                  const Icon = link.icon;
                  const isActive = isLinkActive(link.href);
                  const label = t(link.labelKey as Parameters<typeof t>[0]);
                  const description = t(link.descKey as Parameters<typeof t>[0]);

                  return (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link
                        href={link.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg',
                          isActive && 'bg-primary/10 text-primary',
                        )}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <div className="flex flex-col">
                          <span className="font-medium">{label}</span>
                          <span className="text-xs text-muted-foreground">{description}</span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Worksheet & Forum links */}
          {postDropdownLinks.map((link) => {
            const Icon = link.icon;
            const isActive = isLinkActive(link.href);
            const label = t(link.labelKey as Parameters<typeof t>[0]);
            const description = t(link.descKey as Parameters<typeof t>[0]);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all duration-200 relative group whitespace-nowrap text-[13px]',
                  isActive
                    ? 'text-primary-foreground bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
                aria-label={`${label} - ${description}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-200',
                    !isActive && 'group-hover:scale-110',
                  )}
                  aria-hidden="true"
                />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Mobile Navigation */}
        <div className="flex flex-1 items-center justify-end md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('nav.openMenu' as Parameters<typeof t>[0])}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 max-h-[80vh] overflow-y-auto glass-heavy border-border/50"
            >
              {allCoreLinks.map((link) => {
                const Icon = link.icon;
                const isActive = isLinkActive(link.href);
                const label = t(link.labelKey as Parameters<typeof t>[0]);
                const description = t(link.descKey as Parameters<typeof t>[0]);

                return (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link
                      href={link.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg',
                        isActive && 'bg-primary/10 text-primary',
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <div className="flex flex-col">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">{description}</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                );
              })}

              {/* Algorithms section */}
              <div className="my-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                {t('nav.algorithms' as Parameters<typeof t>[0])}
              </div>

              {algorithmLinks.map((link) => {
                const Icon = link.icon;
                const isActive = isLinkActive(link.href);
                const label = t(link.labelKey as Parameters<typeof t>[0]);
                const description = t(link.descKey as Parameters<typeof t>[0]);

                return (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link
                      href={link.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg',
                        isActive && 'bg-primary/10 text-primary',
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <div className="flex flex-col">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">{description}</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                );
              })}

              {/* Settings link in mobile menu */}
              <div className="my-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              <DropdownMenuItem asChild>
                <Link
                  href="/settings"
                  className={cn(
                    'flex items-center gap-3 rounded-lg',
                    pathname === '/settings' && 'bg-primary/10 text-primary',
                  )}
                  aria-current={pathname === '/settings' ? 'page' : undefined}
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {t('nav.settings' as Parameters<typeof t>[0])}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('nav.settingsDescription' as Parameters<typeof t>[0])}
                    </span>
                  </div>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Command palette — trigger button (desktop) + global Ctrl+K dialog */}
        <CommandPalette className="mx-3 shrink-0" />

        {/* Right side: Language switcher + Theme toggle + Auth */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <LanguageSwitcher />
          <ThemeToggle />

          {/* Auth state */}
          {status === 'loading' ? (
            <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
          ) : status === 'authenticated' && session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-label={t('nav.userMenu' as Parameters<typeof t>[0])}
                >
                  <UserAvatar
                    {...(session.user.name ? { name: session.user.name } : {})}
                    {...(session.user.image ? { image: session.user.image } : {})}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass-heavy border-border/50">
                <div className="px-2 py-1.5 min-w-0 overflow-hidden">
                  <p className="text-sm font-medium truncate">{session.user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" aria-hidden="true" />
                    {t('nav.profile' as Parameters<typeof t>[0])}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    {t('nav.settings' as Parameters<typeof t>[0])}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 text-destructive"
                    onClick={() => signOut('/')}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    {t('nav.signOut' as Parameters<typeof t>[0])}
                  </button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                asChild
                aria-label={t('nav.settings' as Parameters<typeof t>[0])}
                className="text-muted-foreground hover:text-foreground"
              >
                <Link href="/settings">
                  <Settings className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => signIn()}
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {t('nav.signIn' as Parameters<typeof t>[0])}
                </span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
