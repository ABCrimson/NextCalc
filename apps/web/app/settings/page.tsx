'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Palette,
  Calculator,
  Download,
  Keyboard,
  Moon,
  Sun,
  Monitor,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ThemeValue = 'dark' | 'light' | 'system';
type AngleMode = 'deg' | 'rad';
type ComputeMode = 'exact' | 'approximate';

interface UserSettings {
  username: string;
  displayName: string;
  theme: ThemeValue;
  angleMode: AngleMode;
  computeMode: ComputeMode;
}

interface SaveStatus {
  type: 'idle' | 'saved' | 'error';
}

interface KeyboardShortcut {
  keys: string[];
  description: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'nextcalc-user-settings' as const;
const HISTORY_STORAGE_KEY = 'calculator-storage' as const;

const DEFAULT_SETTINGS: UserSettings = {
  username: '',
  displayName: '',
  theme: 'system',
  angleMode: 'deg',
  computeMode: 'approximate',
};

const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { keys: ['Ctrl', 'K'], description: 'Open command palette' },
  { keys: ['Ctrl', '/'], description: 'Show keyboard shortcuts help' },
  { keys: ['Escape'], description: 'Clear current input / close modal' },
  { keys: ['Enter'], description: 'Evaluate expression' },
  { keys: ['Backspace'], description: 'Delete last character' },
  { keys: ['Ctrl', 'Z'], description: 'Undo last action' },
  { keys: ['Ctrl', 'H'], description: 'Toggle history panel' },
  { keys: ['Alt', '1'], description: 'Switch to Calculator tab' },
  { keys: ['Alt', '2'], description: 'Switch to Solver tab' },
  { keys: ['Alt', '3'], description: 'Switch to Statistics tab' },
];

// ---------------------------------------------------------------------------
// Theme helpers
// ---------------------------------------------------------------------------

function applyTheme(theme: ThemeValue): void {
  const root = document.documentElement;
  if (theme === 'system') {
    // Detect actual system preference and apply it
    localStorage.removeItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    root.setAttribute('data-theme', systemTheme);
  } else {
    // Sync with the 'theme' key used by ThemeToggle and the layout script
    localStorage.setItem('theme', theme);
    root.setAttribute('data-theme', theme);
  }
}

function loadSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      username: parsed.username ?? DEFAULT_SETTINGS.username,
      displayName: parsed.displayName ?? DEFAULT_SETTINGS.displayName,
      theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
      angleMode: parsed.angleMode ?? DEFAULT_SETTINGS.angleMode,
      computeMode: parsed.computeMode ?? DEFAULT_SETTINGS.computeMode,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: UserSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated section card that slides in from below. */
function SettingsSection({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/** Pill-shaped keyboard key badge. */
function KeyBadge({ label }: { label: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center rounded px-2 py-0.5',
        'text-xs font-mono font-medium',
        'bg-muted border border-border text-muted-foreground',
        'shadow-[inset_0_-1px_0_rgba(0,0,0,0.2)]',
      )}
    >
      {label}
    </kbd>
  );
}

/** Row in the keyboard shortcuts reference card. */
function ShortcutRow({ keys, description }: KeyboardShortcut) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{description}</span>
      <span className="flex items-center gap-1 shrink-0">
        {keys.map((k, i) => (
          <span key={k} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-muted-foreground/50 text-xs select-none">+</span>
            )}
            <KeyBadge label={k} />
          </span>
        ))}
      </span>
    </div>
  );
}

/** Theme option button. */
function ThemeOption({
  value,
  current,
  icon: Icon,
  label,
  onSelect,
}: {
  value: ThemeValue;
  current: ThemeValue;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onSelect: (v: ThemeValue) => void;
}) {
  const isActive = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={isActive}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl p-4 border transition-all duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        isActive
          ? 'border-primary bg-primary/10 text-primary shadow-[0_0_12px_0] shadow-primary/20'
          : 'border-border bg-background/50 text-muted-foreground hover:border-border/80 hover:bg-accent/30 hover:text-foreground',
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Settings page for NextCalc Pro.
 *
 * Persists all settings to localStorage. Sections:
 *  - Profile (username, display name)
 *  - Appearance (theme)
 *  - Calculator defaults (angle mode, compute mode)
 *  - Data (export history JSON, clear history)
 *  - Keyboard shortcuts reference
 *
 * Accessibility:
 *  - All interactive controls have explicit labels
 *  - Focus rings: focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
 *  - Semantic landmark regions (main, sections with aria-labelledby)
 *  - Keyboard-operable theme selector (aria-pressed toggles)
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ type: 'idle' });
  const [historyCount, setHistoryCount] = useState(0);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    // Apply stored theme immediately
    applyTheme(loaded.theme);

    // Count history entries from the calculator store persisted data
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { history?: unknown[] } };
        setHistoryCount(parsed?.state?.history?.length ?? 0);
      }
    } catch {
      setHistoryCount(0);
    }
  }, []);

  // Persist and apply theme on change
  const updateTheme = useCallback((theme: ThemeValue) => {
    setSettings((prev) => {
      const next = { ...prev, theme };
      saveSettings(next);
      return next;
    });
    applyTheme(theme);
  }, []);

  // Generic field updater — saves on every change
  const updateField = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        saveSettings(next);
        return next;
      });
    },
    [],
  );

  // Save all — shows feedback badge
  const handleSave = useCallback(() => {
    try {
      saveSettings(settings);
      setSaveStatus({ type: 'saved' });
    } catch {
      setSaveStatus({ type: 'error' });
    }
    const timer = setTimeout(() => setSaveStatus({ type: 'idle' }), 2500);
    return () => clearTimeout(timer);
  }, [settings]);

  // Export history as JSON download
  const handleExportHistory = useCallback(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      const history: unknown[] = (data as { state?: { history?: unknown[] } })?.state?.history ?? [];
      const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `nextcalc-history-${new Date().toISOString().split('T')[0]}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      // If localStorage is unavailable or data is malformed, fail silently.
    }
  }, []);

  // Clear history from localStorage
  const handleClearHistory = useCallback(() => {
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { history?: unknown[] } };
        if (parsed?.state) {
          parsed.state.history = [];
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(parsed));
        }
      }
      setHistoryCount(0);
      setClearConfirm(false);
    } catch {
      // Fail silently.
    }
  }, [clearConfirm]);

  return (
    <div className="relative min-h-screen">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background" />
        <motion.div
          className="absolute top-[-10%] right-[-5%] w-[480px] h-[480px] rounded-full bg-gradient-to-br from-violet-500/10 to-indigo-500/10 blur-3xl"
          animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 22, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[-10%] left-[-5%] w-[560px] h-[560px] rounded-full bg-gradient-to-br from-sky-500/10 to-cyan-500/10 blur-3xl"
          animate={{ x: [0, -60, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 28, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(148,163,184,0.8) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-10 relative">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30">
              <Settings className="h-6 w-6 text-violet-400" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-300 via-indigo-300 to-sky-300 bg-clip-text text-transparent">
              Settings
            </h1>
          </div>
          <p className="text-muted-foreground text-sm ml-[52px]">
            Manage your profile, appearance, and calculator defaults.
          </p>
        </motion.div>

        <main className="space-y-6" aria-label="Settings sections">
          {/* ------------------------------------------------------------------ */}
          {/* Profile */}
          {/* ------------------------------------------------------------------ */}
          <SettingsSection delay={0.08}>
            <Card className="bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-500/15 to-blue-500/15 border border-sky-500/25">
                    <User className="h-4 w-4 text-sky-400" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Profile
                  </CardTitle>
                </div>
                <CardDescription className="text-muted-foreground text-sm ml-9">
                  Your display identity across NextCalc Pro. Stored locally for now.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-sm text-foreground">
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    value={settings.username}
                    onChange={(e) => updateField('username', e.target.value)}
                    placeholder="e.g. euler42"
                    autoComplete="username"
                    aria-describedby="username-hint"
                  />
                  <p id="username-hint" className="text-xs text-muted-foreground">
                    Used to identify you in shared worksheets and forums.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="displayName" className="text-sm text-foreground">
                    Display name
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={settings.displayName}
                    onChange={(e) => updateField('displayName', e.target.value)}
                    placeholder="e.g. Leonhard Euler"
                    autoComplete="name"
                    aria-describedby="displayname-hint"
                  />
                  <p id="displayname-hint" className="text-xs text-muted-foreground">
                    The name shown in comments and the navigation bar.
                  </p>
                </div>
              </CardContent>
            </Card>
          </SettingsSection>

          {/* ------------------------------------------------------------------ */}
          {/* Appearance */}
          {/* ------------------------------------------------------------------ */}
          <SettingsSection delay={0.14}>
            <Card className="bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/15 to-purple-500/15 border border-violet-500/25">
                    <Palette className="h-4 w-4 text-violet-400" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Appearance
                  </CardTitle>
                </div>
                <CardDescription className="text-muted-foreground text-sm ml-9">
                  Choose how NextCalc Pro looks. "System" follows your OS preference.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <fieldset>
                  <legend className="text-sm font-medium text-foreground mb-3">
                    Color theme
                  </legend>
                  <div
                    className="grid grid-cols-3 gap-3"
                    role="group"
                    aria-label="Color theme selection"
                  >
                    <ThemeOption
                      value="light"
                      current={settings.theme}
                      icon={Sun}
                      label="Light"
                      onSelect={updateTheme}
                    />
                    <ThemeOption
                      value="dark"
                      current={settings.theme}
                      icon={Moon}
                      label="Dark"
                      onSelect={updateTheme}
                    />
                    <ThemeOption
                      value="system"
                      current={settings.theme}
                      icon={Monitor}
                      label="System"
                      onSelect={updateTheme}
                    />
                  </div>
                </fieldset>
              </CardContent>
            </Card>
          </SettingsSection>

          {/* ------------------------------------------------------------------ */}
          {/* Calculator defaults */}
          {/* ------------------------------------------------------------------ */}
          <SettingsSection delay={0.2}>
            <Card className="bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/25">
                    <Calculator className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Calculator Defaults
                  </CardTitle>
                </div>
                <CardDescription className="text-muted-foreground text-sm ml-9">
                  These values pre-populate the calculator on every session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Angle mode */}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="angleMode"
                      className="text-sm font-medium text-foreground"
                    >
                      Default angle mode
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Used for trigonometric functions: sin, cos, tan.
                    </p>
                  </div>
                  <Select
                    value={settings.angleMode}
                    onValueChange={(v) => updateField('angleMode', v as AngleMode)}
                  >
                    <SelectTrigger
                      id="angleMode"
                      className="w-36"
                      aria-label="Default angle mode"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deg">Degrees</SelectItem>
                      <SelectItem value="rad">Radians</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Compute mode */}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="computeMode"
                      className="text-sm font-medium text-foreground"
                    >
                      Default compute mode
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Exact uses symbolic arithmetic; Approximate uses floating-point.
                    </p>
                  </div>
                  <Select
                    value={settings.computeMode}
                    onValueChange={(v) => updateField('computeMode', v as ComputeMode)}
                  >
                    <SelectTrigger
                      id="computeMode"
                      className="w-36"
                      aria-label="Default compute mode"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exact</SelectItem>
                      <SelectItem value="approximate">Approximate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Auto-evaluate toggle */}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="autoEval"
                      className="text-sm font-medium text-foreground"
                    >
                      Show thousands separator
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Format large results with commas (e.g., 1,000,000).
                    </p>
                  </div>
                  <Switch
                    id="autoEval"
                    checked={false}
                    disabled
                    aria-label="Show thousands separator (coming soon)"
                    aria-describedby="autoEval-hint"
                  />
                </div>
                <p id="autoEval-hint" className="text-xs text-muted-foreground -mt-4">
                  Coming soon.
                </p>
              </CardContent>
            </Card>
          </SettingsSection>

          {/* ------------------------------------------------------------------ */}
          {/* Data */}
          {/* ------------------------------------------------------------------ */}
          <SettingsSection delay={0.26}>
            <Card className="bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/25">
                    <Download className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Data
                  </CardTitle>
                </div>
                <CardDescription className="text-muted-foreground text-sm ml-9">
                  Manage your locally stored calculation history.
                  {historyCount > 0 && (
                    <span className="ml-1 text-foreground font-medium">
                      ({historyCount} {historyCount === 1 ? 'entry' : 'entries'})
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={handleExportHistory}
                    disabled={historyCount === 0}
                    className="flex-1 gap-2"
                    aria-label="Export calculation history as JSON file"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Export history as JSON
                  </Button>

                  <Button
                    variant={clearConfirm ? 'destructive' : 'outline'}
                    onClick={handleClearHistory}
                    disabled={historyCount === 0}
                    className={cn(
                      'flex-1 gap-2 transition-all duration-200',
                      clearConfirm && 'animate-pulse',
                    )}
                    aria-label={
                      clearConfirm
                        ? 'Click again to confirm clearing all history'
                        : 'Clear all calculation history'
                    }
                    aria-live="polite"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {clearConfirm ? 'Confirm clear?' : 'Clear history'}
                  </Button>
                </div>

                {historyCount === 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No calculation history found. Start using the calculator to build a history.
                  </p>
                )}
              </CardContent>
            </Card>
          </SettingsSection>

          {/* ------------------------------------------------------------------ */}
          {/* Keyboard shortcuts */}
          {/* ------------------------------------------------------------------ */}
          <SettingsSection delay={0.32}>
            <Card className="bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500/15 to-pink-500/15 border border-rose-500/25">
                    <Keyboard className="h-4 w-4 text-rose-400" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Keyboard Shortcuts
                  </CardTitle>
                </div>
                <CardDescription className="text-muted-foreground text-sm ml-9">
                  Quick reference for all global keyboard bindings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="rounded-lg border border-border/50 bg-background/40 px-4"
                  role="table"
                  aria-label="Keyboard shortcuts reference"
                >
                  {KEYBOARD_SHORTCUTS.map((shortcut) => (
                    <ShortcutRow key={shortcut.description} {...shortcut} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  All shortcuts work globally unless a text input is focused.
                </p>
              </CardContent>
            </Card>
          </SettingsSection>

          {/* ------------------------------------------------------------------ */}
          {/* Save bar */}
          {/* ------------------------------------------------------------------ */}
          <SettingsSection delay={0.38}>
            <div className="flex items-center justify-between gap-4 rounded-xl px-5 py-4 bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              {/* Status feedback */}
              <div aria-live="polite" aria-atomic="true">
                {saveStatus.type === 'saved' && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1.5 text-sm text-emerald-400 font-medium"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Settings saved
                  </motion.span>
                )}
                {saveStatus.type === 'error' && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1.5 text-sm text-destructive font-medium"
                  >
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    Failed to save
                  </motion.span>
                )}
                {saveStatus.type === 'idle' && (
                  <span className="text-xs text-muted-foreground">
                    Profile and calculator defaults are auto-saved on change. Use this button
                    to confirm all settings.
                  </span>
                )}
              </div>

              <Button
                onClick={handleSave}
                className="shrink-0 gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0"
                aria-label="Save all settings"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Save settings
              </Button>
            </div>
          </SettingsSection>
        </main>
      </div>
    </div>
  );
}
