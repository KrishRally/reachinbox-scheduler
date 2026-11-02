import { useState } from 'react';
import { ComposeModal } from '../components/ComposeModal';
import { Header } from '../components/Header';
import { SlackConnect } from '../components/SlackConnect';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/ui/Button';
import { Column, Table } from '../components/ui/Table';
import { useEmails } from '../hooks/useEmails';
import type { EmailRow } from '../types';

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString() : '—');

const base: Column<EmailRow>[] = [
  { header: 'Email', render: (r) => r.email },
  { header: 'Subject', render: (r) => r.subject },
];
const scheduledCols: Column<EmailRow>[] = [
  ...base,
  { header: 'Scheduled time', render: (r) => fmt(r.scheduledAt) },
  { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];
const sentCols: Column<EmailRow>[] = [
  ...base,
  { header: 'Sent time', render: (r) => fmt(r.sentAt) },
  { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  {
    header: 'Preview',
    render: (r) => r.previewUrl
      ? <a href={r.previewUrl} target="_blank" rel="noreferrer" className="text-brand underline">View</a>
      : <span className="text-xs text-red-600">{r.error ?? '—'}</span>,
  },
];

export default function Dashboard() {
  const [tab, setTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [composing, setComposing] = useState(false);
  const { rows, loading, error, reload } = useEmails(tab);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-1 rounded-lg bg-gray-200 p-1">
            {(['scheduled', 'sent'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                {t === 'scheduled' ? 'Scheduled Emails' : 'Sent Emails'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <SlackConnect />
            <Button onClick={() => setComposing(true)}>Compose New Email</Button>
          </div>
        </div>

        {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="rounded-xl border bg-white">
          <Table
            columns={tab === 'scheduled' ? scheduledCols : sentCols}
            rows={rows}
            loading={loading}
            rowKey={(r) => r.id}
            emptyText={tab === 'scheduled' ? 'No scheduled emails' : 'No sent emails yet'}
          />
        </div>
      </main>
      {composing && <ComposeModal onClose={() => setComposing(false)} onDone={reload} />}
    </div>
  );
}
