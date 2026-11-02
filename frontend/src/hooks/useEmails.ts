import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { EmailRow } from '../types';

// Fetches a list and polls every 5s so status changes show up live.
export function useEmails(status: 'scheduled' | 'sent') {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.emails(status));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return { rows, loading, error, reload: load };
}
