import { Client } from '@elastic/elasticsearch';
import { EmailJob } from '../types';

const INDEX = 'email_jobs';

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200' });
  }
  return client;
}

export async function initElasticsearch(): Promise<void> {
  const es = getClient();
  try {
    const exists = await es.indices.exists({ index: INDEX });
    if (!exists) {
      await es.indices.create({
        index: INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            user_id: { type: 'keyword' },
            sender_email: { type: 'keyword' },
            recipient_email: { type: 'keyword' },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduled_at: { type: 'date' },
            sent_at: { type: 'date' },
            created_at: { type: 'date' },
          },
        },
      });
      console.log('✅ Elasticsearch index created');
    } else {
      console.log('✅ Elasticsearch index already exists');
    }
  } catch (err) {
    console.warn('⚠️  Elasticsearch not available, search will be disabled:', (err as Error).message);
  }
}

export async function indexEmail(job: EmailJob): Promise<void> {
  try {
    const es = getClient();
    await es.index({
      index: INDEX,
      id: job.id,
      document: {
        id: job.id,
        user_id: job.user_id,
        sender_email: job.sender_email,
        recipient_email: job.recipient_email,
        subject: job.subject,
        body: job.body,
        status: job.status,
        scheduled_at: job.scheduled_at,
        sent_at: job.sent_at,
        created_at: job.created_at,
      },
    });
  } catch (err) {
    console.warn('Elasticsearch index failed (non-fatal):', (err as Error).message);
  }
}

export async function updateEmailStatus(id: string, status: string, sent_at?: Date): Promise<void> {
  try {
    const es = getClient();
    await es.update({
      index: INDEX,
      id,
      doc: { status, ...(sent_at ? { sent_at } : {}) },
    });
  } catch (err) {
    console.warn('Elasticsearch update failed (non-fatal):', (err as Error).message);
  }
}

export async function searchEmails(
  userId: string,
  query: string,
  status?: string
): Promise<EmailJob[]> {
  try {
    const es = getClient();
    const must: object[] = [{ term: { user_id: userId } }];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['subject', 'body', 'recipient_email', 'sender_email'],
        },
      });
    }

    if (status) {
      must.push({ term: { status } });
    }

    const result = await es.search({
      index: INDEX,
      query: { bool: { must } },
      size: 100,
    });

    return result.hits.hits.map((h) => h._source as EmailJob);
  } catch (err) {
    console.warn('Elasticsearch search failed (non-fatal):', (err as Error).message);
    return [];
  }
}
