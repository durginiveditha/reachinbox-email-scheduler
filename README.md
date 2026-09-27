# ReachInbox — Full-Stack Email Job Scheduler

A production-grade email scheduling system built with TypeScript, BullMQ, Redis, PostgreSQL, and Next.js.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Frontend                   │
│   (Google Login → Dashboard → Compose → Tables)     │
└────────────────────┬────────────────────────────────┘
                     │ REST API (JWT)
┌────────────────────▼────────────────────────────────┐
│                  Express.js Backend                  │
│  /auth  /emails  /slack  /admin/queues (Bull Board) │
└──────┬──────────────┬───────────────────────────────┘
       │              │
  ┌────▼────┐   ┌─────▼──────┐
  │ BullMQ  │   │ PostgreSQL │
  │  Queue  │   │  (jobs DB) │
  └────┬────┘   └─────┬──────┘
       │              │
  ┌────▼────┐   ┌─────▼──────┐
  │  Redis  │   │Elasticsearch│
  │(queue + │   │ (search +  │
  │rate lmt)│   │  indexing) │
  └─────────┘   └────────────┘
       │
  ┌────▼──────────────────────┐
  │     BullMQ Worker         │
  │  (concurrency: 5)         │
  │  → Ethereal SMTP send     │
  │  → Rate limit check       │
  │  → Slack notification     │
  └───────────────────────────┘
```

## How Scheduling Works

1. **Client** calls `POST /emails/schedule` with recipients, subject, body, start time, delay
2. **Backend** creates a `email_batch` record and one `email_job` row per recipient in PostgreSQL
3. Each job is added to BullMQ as a **delayed job** using `jobId = idempotencyKey` (guarantees no duplicates)
4. BullMQ stores the job in **Redis** with a timestamp-based delay
5. When the time arrives, BullMQ moves the job from "delayed" to "waiting" automatically
6. The **Worker** picks it up, checks rate limits, sends via Ethereal SMTP, and updates status in DB + Elasticsearch

## Persistence on Restart

- BullMQ stores all queued/delayed jobs in **Redis with persistence** (AOF enabled)
- PostgreSQL holds the authoritative state of every email job
- On restart: Redis still has all future delayed jobs → they fire at the correct time
- The worker checks `idempotency_key` before sending → no duplicate sends ever
- Status in DB (`scheduled`, `sent`, `failed`, `delayed`) is the source of truth

## Rate Limiting

### Per-sender limit (default: 50/hour)
- Redis key: `rate:sender:{email}:{YYYY-MM-DD-HH}` incremented atomically per send
- If limit exceeded: job is re-queued with delay = `ms until next UTC hour`
- Slack notification fires at the moment of hitting the limit

### Global limit (default: 200/hour)
- Redis key: `rate:global:{YYYY-MM-DD-HH}` — same pattern
- Safe across multiple workers: atomic Redis INCR prevents race conditions

### Under 1000 emails scheduled at once
- They are all stored in DB and Redis immediately
- The worker's `limiter` option caps throughput at 10 jobs/second
- Rate limit logic re-queues excess into the next hour — no jobs are dropped

### Delay between emails
- 2000ms minimum delay is enforced inside the worker via `sleep()` before each send
- Configurable via `MIN_DELAY_BETWEEN_EMAILS_MS` env var

## Features Implemented

### Backend
- [x] Express.js + TypeScript
- [x] BullMQ delayed jobs (no cron)
- [x] PostgreSQL persistence (schema auto-init)
- [x] Ethereal Email SMTP (auto-creates test account)
- [x] Idempotency via `jobId = idempotencyKey` (no duplicate sends)
- [x] Bull Board dashboard at `/admin/queues`
- [x] Elasticsearch indexing + full-text search
- [x] Google OAuth 2.0 + JWT auth
- [x] Per-sender rate limiting (Redis-backed, atomic)
- [x] Global rate limiting
- [x] Configurable worker concurrency
- [x] Configurable delay between emails
- [x] Jobs re-queued (not dropped) when rate limited
- [x] Slack OAuth + notifications on rate limit hit
- [x] CSV parsing for recipients
- [x] Restart-safe (Redis AOF + DB state)

### Frontend
- [x] Next.js 14 + TypeScript
- [x] Tailwind CSS
- [x] Google OAuth login (real)
- [x] Dashboard with Scheduled / Sent tabs
- [x] Stats bar (counts per status)
- [x] Compose modal with CSV upload + drag & drop
- [x] Manual email entry
- [x] Pagination
- [x] Search (via Elasticsearch)
- [x] Loading states + empty states
- [x] Slack connect / disconnect
- [x] Link to Bull Board queue dashboard
- [x] JWT token persistence (localStorage)
- [x] Auto-logout on 401

## Setup

### Prerequisites
- Node.js 18+
- Docker + Docker Compose

### 1. Start infrastructure
```bash
docker-compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, SESSION_SECRET
npm install
npm run dev         # API server on :3001
npm run worker      # BullMQ worker (separate terminal)
```

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev         # Next.js on :3000
```

### Environment Variables

**backend/.env**
```
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/reachinbox
REDIS_HOST=localhost
REDIS_PORT=6379
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
JWT_SECRET=<random 32-char string>
SESSION_SECRET=<random 32-char string>
ELASTICSEARCH_URL=http://localhost:9200
SLACK_CLIENT_ID=<from Slack App settings>
SLACK_CLIENT_SECRET=<from Slack App settings>
SLACK_REDIRECT_URI=http://localhost:3001/slack/callback
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50
MIN_DELAY_BETWEEN_EMAILS_MS=2000
WORKER_CONCURRENCY=5
FRONTEND_URL=http://localhost:3000
```

**frontend/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Setting up Ethereal Email
Ethereal accounts are **auto-created** on first run — check server logs:
```
✅ Ethereal test account created: xyz@ethereal.email
```
Preview sent emails at https://ethereal.email using those credentials.
To reuse an account across restarts, copy the credentials to `.env` as `ETHEREAL_USER` / `ETHEREAL_PASS`.

### Setting up Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add `http://localhost:3001/auth/google/callback` as an authorized redirect URI

### Setting up Slack (optional)
1. Create a Slack app at https://api.slack.com/apps
2. Add OAuth scopes: `chat:write`, `incoming-webhook`
3. Set redirect URI to `http://localhost:3001/slack/callback`
4. Copy Client ID and Secret to `.env`

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /auth/google | — | Initiate Google OAuth |
| GET | /auth/me | JWT | Get current user |
| POST | /emails/schedule | JWT | Schedule email campaign (multipart) |
| GET | /emails/scheduled | JWT | List scheduled emails |
| GET | /emails/sent | JWT | List sent emails |
| GET | /emails/stats | JWT | Get email counts by status |
| GET | /emails/search?q= | JWT | Full-text search via Elasticsearch |
| GET | /slack/connect | JWT | Initiate Slack OAuth |
| GET | /admin/queues | — | Bull Board queue dashboard |

## Trade-offs & Notes

- **Elasticsearch is optional**: if ES is down, search returns empty results (non-fatal)
- **Ethereal Email** is fake SMTP — emails are captured for testing, not actually delivered
- **Rate limit re-queue** preserves order approximately but not perfectly under concurrent workers
- **Bull Board** is open (no auth) — add middleware to protect in production
- Worker and server should run as separate processes in production; use PM2 or Docker

## Delay Configuration

| Setting | Default | Notes |
|---------|---------|-------|
| `MIN_DELAY_BETWEEN_EMAILS_MS` | 2000ms | Min wait between each email send |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | 50 | Per-sender hourly cap |
| `MAX_EMAILS_PER_HOUR` | 200 | Global hourly cap |
| `WORKER_CONCURRENCY` | 5 | Parallel job processing |
