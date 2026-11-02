import { useEffect, useState } from 'react';
import { api, slackConnectUrl } from '../api';
import type { SlackStatus } from '../types';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

export function SlackConnect() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.slackStatus().then(setStatus).catch(() => setStatus({ connected: false }));
    const flag = new URLSearchParams(window.location.search).get('slack');
    if (flag === 'connected') toast('Slack connected');
    if (flag === 'error') toast('Slack connection failed', 'error');
  }, []);

  const disconnect = async () => {
    await api.slackDisconnect();
    setStatus({ connected: false });
    toast('Slack disconnected');
  };

  if (!status) return null;
  return status.connected ? (
    <Button variant="outline" onClick={disconnect}>Slack: {status.channel ?? 'connected'} · Disconnect</Button>
  ) : (
    <a href={slackConnectUrl}><Button variant="outline">Connect Slack</Button></a>
  );
}
