export interface User { id: number; email: string; name: string; avatar: string }
export type EmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed';
export interface EmailRow {
  id: string;
  email: string;
  subject: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  previewUrl: string | null;
  error: string | null;
}
export interface SchedulePayload {
  subject: string;
  body: string;
  emails: string[];
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
}
export interface SlackStatus { connected: boolean; channel?: string; team?: string }
