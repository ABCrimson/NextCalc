import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline — NextCalc Pro',
  description: 'You are currently offline.',
};

const cachedPages = [
  { name: 'Calculator', href: '/' },
  { name: 'Plot', href: '/plot' },
  { name: 'Matrix', href: '/matrix' },
  { name: 'Solver', href: '/solver' },
  { name: 'Units', href: '/units' },
  { name: 'Stats', href: '/stats' },
  { name: 'Symbolic', href: '/symbolic' },
];

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 text-6xl" role="img" aria-label="No connection">
          &#x1F4F4;
        </div>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">
          You&apos;re offline
        </h1>
        <p className="mb-8 text-muted-foreground">
          Check your internet connection and try again. Some pages may still be
          available from cache:
        </p>
        <nav aria-label="Cached pages">
          <ul className="space-y-2">
            {cachedPages.map((page) => (
              <li key={page.href}>
                <a
                  href={page.href}
                  className="inline-block rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {page.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
