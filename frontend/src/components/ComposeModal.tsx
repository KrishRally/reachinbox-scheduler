import { ChangeEvent, FormEvent, useState } from 'react';
import { api } from '../api';
import { Button } from './ui/Button';
import { Field, inputCls } from './ui/Field';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// datetime-local value for "now + 1 minute" in local time
const defaultStart = () => {
  const d = new Date(Date.now() + 60_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function ComposeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [startTime, setStartTime] = useState(defaultStart);
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [saving, setSaving] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const found = (await file.text()).match(EMAIL_RE) ?? [];
    setEmails([...new Set(found.map((x) => x.toLowerCase()))]);
    setFileName(file.name);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!emails.length) return toast('Upload a CSV/text file with at least one email', 'error');
    setSaving(true);
    try {
      const r = await api.schedule({
        subject, body, emails, delaySeconds, hourlyLimit,
        startTime: new Date(startTime).toISOString(),
      });
      toast(`Scheduled ${r.count} emails`);
      onDone();
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Compose New Email" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Subject">
          <input required className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Body">
          <textarea required rows={5} className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="Leads (CSV / text file)">
          <input type="file" accept=".csv,.txt" onChange={onFile} className="text-sm" />
          {fileName && (
            <p className="mt-1 text-xs text-gray-600">{fileName}: <b>{emails.length}</b> email addresses detected</p>
          )}
        </Field>
        <Field label="Start time">
          <input type="datetime-local" required className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Delay between emails (sec)">
            <input type="number" min={0} required className={inputCls} value={delaySeconds} onChange={(e) => setDelaySeconds(Number(e.target.value))} />
          </Field>
          <Field label="Hourly limit (per sender)">
            <input type="number" min={1} required className={inputCls} value={hourlyLimit} onChange={(e) => setHourlyLimit(Number(e.target.value))} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Schedule</Button>
        </div>
      </form>
    </Modal>
  );
}
