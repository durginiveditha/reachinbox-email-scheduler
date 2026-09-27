'use client';
import { format } from 'date-fns';
import { Mail, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { EmailJob } from '../../types';

interface EmailTableProps {
  emails: EmailJob[];
  total: number;
  page: number;
  onPageChange: (p: number) => void;
  loading: boolean;
  type: 'scheduled' | 'sent';
}

const PAGE_SIZE = 20;

export default function EmailTable({ emails, total, page, onPageChange, loading, type }: EmailTableProps) {
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="divide-y divide-surface-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
              <div className="w-8 h-8 bg-surface-2 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-surface-2 rounded w-1/3" />
                <div className="h-3 bg-surface-2 rounded w-1/2" />
              </div>
              <div className="h-5 w-20 bg-surface-2 rounded-full" />
              <div className="h-3 w-24 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!emails.length) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center mb-4">
          <Inbox className="w-7 h-7 text-ink-4" />
        </div>
        <p className="text-ink-2 font-medium">
          {type === 'scheduled' ? 'No emails scheduled yet' : 'No emails sent yet'}
        </p>
        <p className="text-ink-4 text-sm mt-1">
          {type === 'scheduled'
            ? 'Compose a new email to get started'
            : 'Sent emails will appear here'}
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-1 border-b border-surface-3">
              <th className="text-left font-medium text-ink-3 px-4 py-3">Recipient</th>
              <th className="text-left font-medium text-ink-3 px-4 py-3">Subject</th>
              <th className="text-left font-medium text-ink-3 px-4 py-3">From</th>
              <th className="text-left font-medium text-ink-3 px-4 py-3">
                {type === 'scheduled' ? 'Scheduled For' : 'Sent At'}
              </th>
              <th className="text-left font-medium text-ink-3 px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-2">
            {emails.map((email) => (
              <tr key={email.id} className="hover:bg-surface-1 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-brand-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <Mail className="w-3.5 h-3.5 text-brand-600" />
                    </div>
                    <span className="text-ink-1 font-medium truncate max-w-[180px]">
                      {email.recipient_email}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-2 truncate max-w-[200px]">{email.subject}</td>
                <td className="px-4 py-3 text-ink-3 text-xs truncate max-w-[160px]">{email.sender_email}</td>
                <td className="px-4 py-3 text-ink-3 whitespace-nowrap text-xs">
                  {type === 'scheduled'
                    ? format(new Date(email.scheduled_at), 'MMM d, yyyy HH:mm')
                    : email.sent_at
                    ? format(new Date(email.sent_at), 'MMM d, yyyy HH:mm')
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge-${email.status}`}>
                    {email.status}
                  </span>
                  {email.error_message && (
                    <p className="text-xs text-red-500 mt-0.5 truncate max-w-[120px]" title={email.error_message}>
                      {email.error_message}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-surface-2 px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-ink-4">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-1.5 rounded-lg text-ink-3 hover:bg-surface-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-ink-2 px-2">{page} / {totalPages}</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg text-ink-3 hover:bg-surface-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
