'use client';

/**
 * ShareDialog — "Share & Collaborate" modal for the worksheet editor.
 *
 * Responsibilities:
 *   - Generate a unique worksheet session ID and shareable URL
 *   - Display copy-to-clipboard UI for the share URL
 *   - Show transport status (BroadcastChannel / WebSocket)
 *   - Allow user to set their display name
 *   - Disconnect / go back to solo mode
 *
 * Accessibility:
 *   - Radix Dialog handles focus trap, Escape key, and screen reader announcements
 *   - All interactive elements have explicit aria-labels
 *   - Status updates use role="status" with aria-live="polite"
 *   - Focus ring: focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
 */

import { AnimatePresence, m } from 'framer-motion';
import {
  Check,
  Copy,
  Globe,
  Radio,
  Share2,
  UserCircle2,
  Users,
  Wifi,
  X,
  ZapOff,
} from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useWorksheetCollab } from '@/lib/hooks/use-worksheet-collab';
import {
  type CollabStatus,
  useCollabActions,
  useCollabSession,
  useCollabStatus,
  useLocalPeer,
  useRemotePeers,
} from '@/lib/stores/collab-store';
import { useWorksheetStore } from '@/lib/stores/worksheet-store';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatusPillProps {
  status: CollabStatus;
}

function StatusPill({ status }: StatusPillProps) {
  const config = {
    idle: { label: 'Solo mode', color: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
    connecting: { label: 'Connecting…', color: 'text-amber-400', dot: 'bg-amber-400' },
    live: { label: 'Live', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    error: { label: 'Connection error', color: 'text-destructive', dot: 'bg-destructive' },
  } satisfies Record<CollabStatus, { label: string; color: string; dot: string }>;

  const { label, color, dot } = config[status];

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-sm font-medium', color)}
      role="status"
      aria-label={`Collaboration status: ${label}`}
      aria-live="polite"
    >
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          dot,
          status === 'live' && 'animate-pulse',
          status === 'connecting' && 'animate-ping',
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

interface TransportBadgeProps {
  transport: string;
}

function TransportBadge({ transport }: TransportBadgeProps) {
  const meta: Record<string, { icon: typeof Wifi; label: string }> = {
    broadcastchannel: { icon: Radio, label: 'Same-device sync' },
    websocket: { icon: Globe, label: 'Cross-device sync' },
    polling: { icon: Wifi, label: 'Polling fallback' },
  };
  const { icon: Icon, label } = meta[transport] ?? { icon: Wifi, label: transport };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-border/50 rounded-full px-2.5 py-1">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

interface CopyButtonProps {
  value: string;
  label: string;
}

function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently fail
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'shrink-0 flex items-center justify-center h-9 w-9 rounded-md transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        copied
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground',
      )}
      aria-label={copied ? 'Copied!' : label}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <m.span
            key="check"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </m.span>
        ) : (
          <m.span
            key="copy"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
          </m.span>
        )}
      </AnimatePresence>
    </button>
  );
}

interface CollaboratorAvatarRowProps {
  peers: ReturnType<typeof useRemotePeers>;
  localName: string;
  localColor: string;
}

function CollaboratorAvatarRow({ peers, localName, localColor }: CollaboratorAvatarRowProps) {
  if (peers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground/70 italic">
        No other collaborators yet. Share the link below to invite others.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-3" aria-label="Active collaborators">
      {/* Local peer */}
      <li className="flex items-center gap-2">
        <span
          className="flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold text-background ring-2 ring-background"
          style={{ backgroundColor: localColor }}
          aria-label={`${localName} (you)`}
        >
          {localName.charAt(0).toUpperCase()}
        </span>
        <span className="text-xs text-muted-foreground">
          {localName} <span className="text-muted-foreground/50">(you)</span>
        </span>
      </li>

      {peers.map((peer) => (
        <li key={peer.id} className="flex items-center gap-2">
          <span
            className="flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold text-background ring-2 ring-background"
            style={{ backgroundColor: peer.color }}
            aria-label={peer.name}
          >
            {peer.name.charAt(0).toUpperCase()}
          </span>
          <span className="text-xs text-muted-foreground">{peer.name}</span>
          {peer.activeCellId && (
            <span className="text-xs text-muted-foreground/50 italic">editing</span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Main dialog content
// ---------------------------------------------------------------------------

interface ShareDialogContentProps {
  onClose: () => void;
}

function ShareDialogContent({ onClose }: ShareDialogContentProps) {
  const session = useCollabSession();
  const status = useCollabStatus();
  const localPeer = useLocalPeer();
  const remotePeers = useRemotePeers();
  const { setLocalName, endSession } = useCollabActions();
  const worksheetId = useWorksheetStore((s) => s.worksheet.id);

  const nameInputId = useId();
  const urlInputId = useId();

  // Derive a stable session ID for this worksheet — use the worksheet's own ID
  // so re-opening the dialog rejoins the same session.
  const [sessionId] = useState(() => session?.worksheetSessionId ?? worksheetId);

  const { startCollab, stopCollab } = useWorksheetCollab(session ? sessionId : null);

  const [localName, setLocalNameLocal] = useState(localPeer.name === 'You' ? '' : localPeer.name);

  const handleNameChange = useCallback(
    (value: string) => {
      setLocalNameLocal(value);
      if (value.trim()) {
        setLocalName(value.trim());
      }
    },
    [setLocalName],
  );

  const handleStartCollab = useCallback(() => {
    if (localName.trim()) {
      setLocalName(localName.trim());
    }
    startCollab(sessionId);
  }, [startCollab, sessionId, localName, setLocalName]);

  const handleStopCollab = useCallback(() => {
    stopCollab(sessionId);
    endSession();
    onClose();
  }, [stopCollab, sessionId, endSession, onClose]);

  const shareUrl =
    session?.shareUrl ??
    (() => {
      if (typeof window === 'undefined') return '';
      const url = new URL(window.location.href);
      url.pathname = '/worksheet';
      url.searchParams.set('collab', sessionId);
      return url.toString();
    })();

  const isActive = status === 'live' || status === 'connecting';

  return (
    <div className="space-y-5">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <StatusPill status={status} />
        {session && <TransportBadge transport={session.transport} />}
      </div>

      {/* Name field */}
      <div className="space-y-1.5">
        <label
          htmlFor={nameInputId}
          className="text-sm font-medium text-foreground flex items-center gap-1.5"
        >
          <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          Your display name
        </label>
        <Input
          id={nameInputId}
          value={localName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Enter your name"
          maxLength={32}
          className="h-9 text-sm"
          aria-label="Your display name for collaborators"
          disabled={isActive}
        />
        {isActive && (
          <p className="text-xs text-muted-foreground/70">
            Disconnect to change your display name.
          </p>
        )}
      </div>

      {/* Collaborators */}
      {isActive && (
        <section aria-label="Active collaborators" className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-1.5 text-foreground">
            <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Collaborators
            <span className="text-xs text-muted-foreground/70 font-normal bg-muted px-1.5 py-0.5 rounded-full">
              {remotePeers.length + 1}
            </span>
          </h3>
          <CollaboratorAvatarRow
            peers={remotePeers}
            localName={localPeer.name}
            localColor={localPeer.color}
          />
        </section>
      )}

      {/* Share URL */}
      {isActive && (
        <section aria-label="Share link" className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Share link</h3>
          <div className="flex items-center gap-2">
            <label htmlFor={urlInputId} className="sr-only">
              Shareable collaboration URL
            </label>
            <Input
              id={urlInputId}
              value={shareUrl}
              readOnly
              className="h-9 text-xs font-mono text-muted-foreground bg-muted/30 border-border/50"
              aria-label="Shareable collaboration URL — read only"
              onFocus={(e) => e.target.select()}
            />
            <CopyButton value={shareUrl} label="Copy share link to clipboard" />
          </div>
          <p className="text-xs text-muted-foreground/70">
            Anyone with this link can join the same collaboration session on their device (requires
            WebSocket server) or in another tab on this device (works offline via BroadcastChannel).
          </p>
        </section>
      )}

      {/* How it works (idle state) */}
      {!isActive && (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground text-sm">How collaboration works</p>
          <ul className="space-y-1.5 list-none">
            <li className="flex items-start gap-2">
              <Radio className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" aria-hidden="true" />
              <span>
                <strong className="text-foreground font-medium">Same device:</strong> Multiple
                browser tabs sync instantly via BroadcastChannel — works offline.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Globe className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" aria-hidden="true" />
              <span>
                <strong className="text-foreground font-medium">Cross-device:</strong> WebSocket
                subscription is used when the API server is reachable.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Wifi className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span>
                <strong className="text-foreground font-medium">Conflict resolution:</strong>{' '}
                Last-write-wins per cell using cell timestamps.
              </span>
            </li>
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
        {isActive ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 hover:text-destructive hover:bg-destructive/10"
              onClick={handleStopCollab}
              aria-label="Disconnect from collaboration session and return to solo mode"
            >
              <ZapOff className="h-3.5 w-3.5" aria-hidden="true" />
              Disconnect
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onClose}
              aria-label="Close the collaboration panel"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Close
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              aria-label="Cancel and close without starting collaboration"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-2 flex-1"
              onClick={handleStartCollab}
              aria-label="Start a collaborative session for this worksheet"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              Start Collaborating
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ open, onOpenChange }: ShareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-label="Share and collaborate on this worksheet">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" aria-hidden="true" />
            Share &amp; Collaborate
          </DialogTitle>
          <DialogDescription>
            Invite others to edit this worksheet together in real time.
          </DialogDescription>
        </DialogHeader>

        <ShareDialogContent onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
