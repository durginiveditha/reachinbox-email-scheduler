'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, RefreshCw, Search, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { emailApi } from '../../lib/api';
import { EmailJob, EmailStats, PaginatedResponse } from '../../types';
import Header from '../../components/dashboard/Header';
import StatsBar from '../../components/dashboard/StatsBar';
import EmailTable from '../../components/dashboard/EmailTable';
import ComposeModal from '../../components/dashboard/ComposeModal';

type Tab = 'scheduled' | 'sent';

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [tab, setTab] = useState<Tab>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [emails, setEmails] = useState<PaginatedResponse<EmailJob>>({ data: [], total: 0, page: 1 });
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  // Handle Slack callback messages
  useEffect(() => {
    if (params.get('slack_connected') === 'true') toast.success('Slack connected!');
    if (params.get('slack_error')) toast.error('Slack connection failed');
  }, [params]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      setStats(await emailApi.getStats());
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadEmails = useCallback(async () => {
    setEmailsLoading(true);
    try {
      const fn = tab === 'scheduled' ? emailApi.getScheduled : emailApi.getSent;
      setEmails(await fn(page, search || undefined));
    } finally {
      setEmailsLoading(false);
    }
  }, [tab, page, search]);

  useEffect(() => { if (user) { loadStats(); loadEmails(); } }, [user, loadStats, loadEmails]);

  // Reset page on tab or search change
  useEffect(() => { setPage(1); }, [tab, search]);

  const handleRefresh = () => { loadStats(); loadEmails(); };

  const handleComposeSuccess = () => {
    setTimeout(() => { loadStats(); loadEmails(); }, 500);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-1">
      <Header user={user} onLogout={logout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page title + actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink-1">Email Dashboard</h1>
            <p className="text-sm text-ink-3 mt-0.5">Schedule and track your email campaigns</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/admin/queues`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary hidden sm:flex"
            >
              <ExternalLink className="w-4 h-4" />
              Queue Dashboard
            </a>
            <button onClick={handleRefresh} className="btn-secondary">
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={() => setComposeOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Compose
            </button>
          </div>
        </div>

        {/* Stats */}
        <StatsBar stats={stats} loading={statsLoading} />

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex bg-surface-2 p-1 rounded-lg gap-1">
            {(['scheduled', 'sent'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize
                  ${tab === t ? 'bg-surface-0 text-ink-1 shadow-card' : 'text-ink-3 hover:text-ink-2'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative sm:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4" />
            <input
              type="text"
              placeholder="Search by email, subject…"
              className="input pl-9 w-full sm:w-72"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Email table */}
        <EmailTable
          emails={emails.data}
          total={emails.total}
          page={page}
          onPageChange={setPage}
          loading={emailsLoading}
          type={tab}
        />
      </main>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSuccess={handleComposeSuccess}
      />
    </div>
  );
}
