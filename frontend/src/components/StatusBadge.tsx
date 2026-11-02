import type { EmailStatus } from '../types';

const styles: Record<EmailStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export const StatusBadge = ({ status }: { status: EmailStatus }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>{status}</span>
);
