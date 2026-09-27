'use client';
import { useState, useRef } from 'react';
import { X, Upload, Users, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { emailApi } from '../../lib/api';

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ComposeModal({ open, onClose, onSuccess }: ComposeModalProps) {
  const [form, setForm] = useState({
    subject: '',
    body: '',
    senderEmail: '',
    startTime: '',
    delayBetweenEmailsMs: 2000,
    hourlyLimit: 50,
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvCount, setCsvCount] = useState(0);
  const [manualEmails, setManualEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFile = (file: File) => {
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      setCsvCount([...new Set(matches)].length);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (!form.subject || !form.body || !form.senderEmail || !form.startTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    const manualList = manualEmails
      .split(/[\n,;]/)
      .map((e) => e.trim())
      .filter((e) => /\S+@\S+\.\S+/.test(e));

    if (!csvFile && !manualList.length) {
      toast.error('Add recipients via CSV or manual entry');
      return;
    }

    setLoading(true);
    try {
      const result = await emailApi.schedule(
        { ...form, recipients: manualList },
        csvFile || undefined
      );
      toast.success(`Scheduled ${result.totalScheduled} emails!`);
      onSuccess();
      onClose();
      resetForm();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to schedule';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ subject: '', body: '', senderEmail: '', startTime: '', delayBetweenEmailsMs: 2000, hourlyLimit: 50 });
    setCsvFile(null);
    setCsvCount(0);
    setManualEmails('');
  };

  const totalRecipients = csvCount + manualEmails.split(/[\n,;]/).filter(e => /\S+@\S+\.\S+/.test(e.trim())).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-1/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-0 rounded-2xl shadow-card-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-3 sticky top-0 bg-surface-0 rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-semibold text-ink-1">Compose Email Campaign</h2>
            <p className="text-sm text-ink-3 mt-0.5">Schedule emails to be sent automatically</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-1 rounded-lg transition-colors text-ink-3">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Sender */}
          <div>
            <label className="label">Sender Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              className="input"
              placeholder="hello@company.com"
              value={form.senderEmail}
              onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
            />
          </div>

          {/* Subject */}
          <div>
            <label className="label">Subject <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="input"
              placeholder="Your email subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>

          {/* Body */}
          <div>
            <label className="label">Email Body <span className="text-red-500">*</span></label>
            <textarea
              className="input min-h-[120px] resize-none"
              placeholder="Write your email content here..."
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>

          {/* CSV Upload */}
          <div>
            <label className="label">Upload Recipient CSV</label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors
                ${csvFile ? 'border-brand-300 bg-brand-50' : 'border-surface-3 hover:border-brand-300 hover:bg-surface-1'}`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {csvFile ? (
                <div className="flex items-center justify-center gap-2 text-brand-600">
                  <Users className="w-5 h-5" />
                  <span className="font-medium">{csvFile.name}</span>
                  <span className="badge bg-brand-100 text-brand-700 ml-1">{csvCount} emails</span>
                </div>
              ) : (
                <div className="text-ink-3">
                  <Upload className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm font-medium">Drop CSV file or click to browse</p>
                  <p className="text-xs mt-1">We'll parse all email addresses automatically</p>
                </div>
              )}
            </div>
          </div>

          {/* Manual emails */}
          <div>
            <label className="label">Manual Recipients (comma or newline separated)</label>
            <textarea
              className="input min-h-[72px] resize-none font-mono text-xs"
              placeholder="alice@example.com, bob@example.com"
              value={manualEmails}
              onChange={(e) => setManualEmails(e.target.value)}
            />
          </div>

          {totalRecipients > 0 && (
            <div className="flex items-center gap-2 text-sm text-brand-600 bg-brand-50 rounded-lg px-3 py-2">
              <Users className="w-4 h-4" />
              <span><strong>{totalRecipients}</strong> recipients will receive this campaign</span>
            </div>
          )}

          {/* Scheduling settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="sm:col-span-1">
              <label className="label">Start Time <span className="text-red-500">*</span></label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4" />
                <input
                  type="datetime-local"
                  className="input pl-9"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            </div>
            <div>
              <label className="label">Delay (ms)</label>
              <input
                type="number"
                className="input"
                min={500}
                step={500}
                value={form.delayBetweenEmailsMs}
                onChange={(e) => setForm({ ...form, delayBetweenEmailsMs: parseInt(e.target.value) })}
              />
              <p className="text-xs text-ink-4 mt-1">Min delay between sends</p>
            </div>
            <div>
              <label className="label">Hourly Limit</label>
              <input
                type="number"
                className="input"
                min={1}
                max={200}
                value={form.hourlyLimit}
                onChange={(e) => setForm({ ...form, hourlyLimit: parseInt(e.target.value) })}
              />
              <p className="text-xs text-ink-4 mt-1">Max emails per hour</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-surface-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scheduling…</>
            ) : (
              <><Send className="w-4 h-4" /> Schedule Campaign</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
