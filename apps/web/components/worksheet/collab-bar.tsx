'use client';

/**
 * CollabBar — real-time collaboration toolbar strip
 *
 * Shows:
 *   - "Share & Collaborate" button (opens ShareDialog)
 *   - "Live" animated indicator when a session is active
 *   - Avatar rail of connected collaborators with colour-coded circles
 *   - Peer count badge
 *
 * Used inside the WorksheetEditor toolbar alongside existing action buttons.
 *
 * Accessibility:
 *   - Collaborator avatars have aria-label with peer name
 *   - Live indicator has role="status" and aria-live="polite"
 *   - Focus ring: focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
 *   - Dialog is accessible via Radix UI
 *
 * Animations:
 *   - Framer Motion layout animations for avatar rail
 *   - Live pulse respects prefers-reduced-motion (Framer Motion built-in)
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useCollabStatus,
  useRemotePeers,
  useLocalPeer,
  useCollabSession,
} from '@/lib/stores/collab-store';
import { useWorksheetCollab } from '@/lib/hooks/use-worksheet-collab';
import { ShareDialog } from './share-dialog';

// ---------------------------------------------------------------------------
// Live indicator
// ---------------------------------------------------------------------------

function LiveIndicator() {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-xs font-semibold text-emerald-400"
      role="status"
      aria-label="Collaboration is live"
      aria-live="polite"
    >
      {/* Animated pulse dot */}
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      Live
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// Collaborator avatar stack
// ---------------------------------------------------------------------------

interface AvatarStackProps {
  maxVisible?: number;
}

function AvatarStack({ maxVisible = 4 }: AvatarStackProps) {
  const status = useCollabStatus();
  const remotePeers = useRemotePeers();
  const localPeer = useLocalPeer();

  if (status !== 'live' && status !== 'connecting') return null;

  const allPeers = [
    { id: localPeer.id, name: localPeer.name, color: localPeer.color, isLocal: true },
    ...remotePeers.map((p) => ({ id: p.id, name: p.name, color: p.color, isLocal: false })),
  ];

  const visible = allPeers.slice(0, maxVisible);
  const overflow = allPeers.length - maxVisible;

  return (
    <motion.div
      layout
      className="flex items-center"
      aria-label={`${allPeers.length} collaborator${allPeers.length !== 1 ? 's' : ''} active`}
      role="group"
    >
      <ul className="flex items-center -space-x-2" aria-label="Active collaborators">
        <AnimatePresence initial={false}>
          {visible.map((peer) => (
            <motion.li
              key={peer.id}
              layout
              initial={{ opacity: 0, scale: 0.6, x: 8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.6, x: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span
                className={cn(
                  'flex items-center justify-center h-7 w-7 rounded-full',
                  'text-xs font-bold text-background',
                  'ring-2 ring-background',
                  peer.isLocal && 'ring-primary/40',
                  'cursor-default select-none'
                )}
                style={{ backgroundColor: peer.color }}
                aria-label={`${peer.name}${peer.isLocal ? ' (you)' : ''}`}
                title={`${peer.name}${peer.isLocal ? ' (you)' : ''}`}
              >
                {peer.name.charAt(0).toUpperCase()}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>

        {overflow > 0 && (
          <motion.li
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-1"
          >
            <span
              className="flex items-center justify-center h-7 w-7 rounded-full bg-muted border border-border/60 text-xs font-medium text-muted-foreground ring-2 ring-background cursor-default select-none"
              aria-label={`${overflow} more collaborator${overflow !== 1 ? 's' : ''}`}
              title={`${overflow} more`}
            >
              +{overflow}
            </span>
          </motion.li>
        )}
      </ul>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Auto-join from URL param
// ---------------------------------------------------------------------------

function AutoJoinEffect() {
  const { joinSession } = useWorksheetCollab(null);
  const session = useCollabSession();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (session) return; // already in a session

    const params = new URLSearchParams(window.location.search);
    const collabId = params.get('collab');
    if (!collabId) return;

    // Slight delay to let the worksheet store hydrate from localStorage first
    const timer = setTimeout(() => {
      joinSession(collabId);
    }, 300);

    return () => clearTimeout(timer);
  // We intentionally only run this once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ---------------------------------------------------------------------------
// Main CollabBar component
// ---------------------------------------------------------------------------

export function CollabBar() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const status = useCollabStatus();
  const session = useCollabSession();
  const remotePeers = useRemotePeers();

  const isLive = status === 'live';
  const isConnecting = status === 'connecting';
  const hasSession = session !== null;
  const peerCount = remotePeers.length;

  const handleOpenDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  return (
    <>
      {/* Auto-join from URL collab param */}
      <AutoJoinEffect />

      {/* Collab section in toolbar */}
      <div
        className="flex items-center gap-2"
        role="group"
        aria-label="Collaboration controls"
      >
        {/* Live indicator */}
        <AnimatePresence>
          {isLive && <LiveIndicator key="live" />}
        </AnimatePresence>

        {/* Avatar stack — shown when session is active */}
        <AnimatePresence>
          {hasSession && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <AvatarStack />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share & Collaborate button */}
        <Button
          variant={hasSession ? 'outline' : 'outline'}
          size="sm"
          className={cn(
            'gap-2 text-xs h-8 transition-all duration-200',
            isLive && 'border-emerald-500/40 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/60',
            isConnecting && 'border-amber-500/40 text-amber-400'
          )}
          onClick={handleOpenDialog}
          aria-label={
            hasSession
              ? `Collaboration settings — ${peerCount + 1} collaborator${peerCount + 1 !== 1 ? 's' : ''} active`
              : 'Open share and collaborate panel'
          }
          aria-expanded={dialogOpen}
          aria-haspopup="dialog"
        >
          {hasSession ? (
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">
            {hasSession ? 'Collaborating' : 'Share'}
          </span>
          {hasSession && peerCount > 0 && (
            <span
              className={cn(
                'inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold',
                isLive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'
              )}
              aria-hidden="true"
            >
              {peerCount + 1}
            </span>
          )}
        </Button>
      </div>

      {/* Share dialog */}
      <ShareDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
