'use client';

/**
 * My Worksheets page — lists user's saved worksheets with search, filter,
 * and management actions (open, delete, create new).
 */

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  FileText,
  Trash2,
  Clock,
  Eye,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorksheetSummary {
  id: string;
  title: string;
  description: string | null;
  visibility: 'PRIVATE' | 'PUBLIC' | 'UNLISTED';
  views: number;
  version: number;
  cellCount: number;
  createdAt: string;
  updatedAt: string;
}

type SortField = 'updatedAt' | 'createdAt' | 'title';
type SortDir = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

// ---------------------------------------------------------------------------
// Server action to list worksheets
// ---------------------------------------------------------------------------

async function fetchWorksheets(): Promise<WorksheetSummary[]> {
  const res = await fetch('/api/worksheets', { cache: 'no-store' });
  if (!res.ok) return [];
  const data = (await res.json()) as { worksheets: WorksheetSummary[] };
  return data.worksheets;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorksheetsPage() {
  const t = useTranslations('worksheets');
  const pathname = usePathname();
  const locale = pathname.split('/')[1] ?? 'en';

  const [worksheets, setWorksheets] = useState<WorksheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [_isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load worksheets
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWorksheets().then((ws) => {
      if (!cancelled) {
        setWorksheets(ws);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Delete handler
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/worksheets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        startTransition(() => {
          setWorksheets((prev) => prev.filter((w) => w.id !== id));
        });
      }
    } finally {
      setDeletingId(null);
    }
  }, [t]);

  // Filter and sort
  const filtered = worksheets
    .filter((w) =>
      w.title.toLowerCase().includes(search.toLowerCase()) ||
      (w.description ?? '').toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      let cmp: number;
      if (sortField === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else {
        cmp = new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  // Relative time formatter
  const relativeTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return t('justNow');
    if (minutes < 60) return t('minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t('daysAgo', { count: days });
    return new Date(date).toLocaleDateString();
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {t('subtitle')}
          </p>
        </div>
        <Link
          href={`/${locale}/worksheet`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Plus className="h-4 w-4" />
          {t('newWorksheet')}
        </Link>
      </div>

      {/* Search & Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </div>

        <div className="flex gap-2">
          {/* Sort toggle */}
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm hover:bg-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            title={t('sortDirection')}
          >
            {sortDir === 'desc' ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
          </button>

          {/* Sort field */}
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="px-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <option value="updatedAt">{t('sortUpdated')}</option>
            <option value="createdAt">{t('sortCreated')}</option>
            <option value="title">{t('sortTitle')}</option>
          </select>

          {/* View mode */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent'
              }`}
              aria-label={t('gridView')}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent'
              }`}
              aria-label={t('listView')}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && worksheets.length === 0 && (
        <div className="text-center py-20">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-medium text-foreground mb-2">{t('emptyTitle')}</h2>
          <p className="text-muted-foreground text-sm mb-6">{t('emptyDescription')}</p>
          <Link
            href={`/${locale}/worksheet`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Plus className="h-4 w-4" />
            {t('createFirst')}
          </Link>
        </div>
      )}

      {/* No results */}
      {!loading && worksheets.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">{t('noResults')}</p>
        </div>
      )}

      {/* Grid view */}
      {!loading && filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((ws) => (
              <motion.div
                key={ws.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <div className="group relative rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5 hover:border-primary/30 hover:shadow-lg transition-all">
                  <Link
                    href={`/${locale}/worksheet?id=${ws.id}`}
                    className="block"
                  >
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {ws.title}
                    </h3>
                    {ws.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {ws.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {relativeTime(ws.updatedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {ws.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {t('cellCount', { count: ws.cellCount })}
                      </span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(ws.id)}
                    disabled={deletingId === ws.id}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:opacity-100"
                    aria-label={t('delete')}
                  >
                    {deletingId === ws.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* List view */}
      {!loading && filtered.length > 0 && viewMode === 'list' && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <AnimatePresence mode="popLayout">
            {filtered.map((ws, i) => (
              <motion.div
                key={ws.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15, delay: i * 0.03 }}
              >
                <div className={`group flex items-center gap-4 px-5 py-4 hover:bg-accent/50 transition-colors ${i > 0 ? 'border-t border-border' : ''}`}>
                  <Link
                    href={`/${locale}/worksheet?id=${ws.id}`}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {ws.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {relativeTime(ws.updatedAt)} · {t('cellCount', { count: ws.cellCount })} · {ws.views} {t('views')}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(ws.id)}
                    disabled={deletingId === ws.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:opacity-100"
                    aria-label={t('delete')}
                  >
                    {deletingId === ws.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
}
