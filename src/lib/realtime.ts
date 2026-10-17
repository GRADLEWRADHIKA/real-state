import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { RealtimeEvent } from '@estateflow/shared';
import { client } from './api';
import { keysFor } from './links';

/** Live updates over /api/events: refetch what changed and pop up new notifications. */
export function useRealtime(enabled: boolean, mapLink: (link: string) => string = (l) => l) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'open' | 'closed'>('closed');

  useEffect(() => {
    if (!enabled) return;
    const onEvent = (e: RealtimeEvent) => {
      if (e.type === 'change' || e.type === 'notification') {
        for (const k of keysFor(e.resources)) void qc.invalidateQueries({ queryKey: [k] });
      }
      if (e.type === 'notification' && e.notification) {
        const n = e.notification;
        toast(n.title, {
          description: n.message,
          action: n.link ? { label: 'Open', onClick: () => navigate(mapLink(n.link!)) } : undefined,
        });
      }
    };
    return client.events(onEvent, setStatus);
    // mapLink is a pure per-role mapping; a new identity does not need a new subscription.
  }, [enabled, qc, navigate]);

  return status;
}
