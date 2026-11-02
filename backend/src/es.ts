import { Client } from '@elastic/elasticsearch';
import { config } from './config';

export const es = new Client({ node: config.esUrl });
const index = 'emails';

export interface EmailDoc {
  id: string;
  userId: number;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
}

// Search is best-effort: Postgres is the source of truth, so ES outages never block sending.
export async function initEs() {
  try {
    if (!(await es.indices.exists({ index }))) {
      await es.indices.create({
        index,
        mappings: {
          properties: {
            userId: { type: 'integer' },
            recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
          },
        },
      });
    }
  } catch (e) {
    console.warn('[es] unavailable:', e);
  }
}

export async function indexEmails(docs: EmailDoc[]) {
  if (!docs.length) return;
  try {
    await es.bulk({
      refresh: false,
      operations: docs.flatMap((d) => [{ index: { _index: index, _id: d.id } }, d]),
    });
  } catch (e) {
    console.warn('[es] bulk index failed:', (e as Error).message);
  }
}

export async function updateEmail(id: string, doc: Partial<EmailDoc>) {
  try {
    await es.update({ index, id, doc });
  } catch (e) {
    console.warn('[es] update failed:', (e as Error).message);
  }
}

export async function searchEmails(userId: number, q: string) {
  const r = await es.search<EmailDoc>({
    index,
    size: 100,
    query: {
      bool: {
        filter: [{ term: { userId } }],
        must: [{ multi_match: { query: q, fields: ['recipient', 'subject', 'body'], fuzziness: 'AUTO' } }],
      },
    },
  });
  return r.hits.hits.map((h) => h._source);
}

