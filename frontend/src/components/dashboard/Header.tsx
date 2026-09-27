'use client';
import Image from 'next/image';
import { LogOut, Slack, CheckCircle } from 'lucide-react';
import { User } from '../../types';
import { slackApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  const handleSlack = async () => {
    if (user.slack_connected) {
      await slackApi.disconnect();
      toast.success('Slack disconnected');
      window.location.reload();
    } else {
      slackApi.connect();
    }
  };

  return (
    <header className="bg-surface-0 border-b border-surface-3 h-16 flex items-center px-6 gap-4 sticky top-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-auto">
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <span className="font-semibold text-ink-1 text-sm">ReachInbox</span>
      </div>

      {/* Slack connect */}
      <button
        onClick={handleSlack}
        className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors
          ${user.slack_connected
            ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
            : 'border-surface-3 text-ink-3 hover:bg-surface-1'
          }`}
      >
        {user.slack_connected ? (
          <><CheckCircle className="w-4 h-4" /> Slack connected</>
        ) : (
          <><Slack className="w-4 h-4" /> Connect Slack</>
        )}
      </button>

      {/* User info */}
      <div className="flex items-center gap-3 pl-3 border-l border-surface-3">
        {user.avatar ? (
          <Image src={user.avatar} alt={user.name} width={32} height={32} className="rounded-full" />
        ) : (
          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-medium text-sm">
            {user.name[0]}
          </div>
        )}
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-ink-1 leading-none">{user.name}</p>
          <p className="text-xs text-ink-4 mt-0.5">{user.email}</p>
        </div>
        <button
          onClick={onLogout}
          title="Logout"
          className="p-1.5 text-ink-4 hover:text-ink-2 hover:bg-surface-1 rounded-lg transition-colors ml-1"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
