
import React, { useState } from 'react';

interface ContactPageProps {
  onNavigate: (path: string) => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Your support request could not be submitted.'
        );
      }

      setTicketNumber(data.ticketNumber);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  
        
  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-8 sm:px-6">
      <div className="text-center mb-9">
        <span className="text-xs font-bold uppercase tracking-widest text-primary">
          NJS Support Centre
        </span>

        <h1 className="text-3xl sm:text-4xl font-bold mt-3">
          How can we help?
        </h1>

        <p className="text-sm text-on-surface-variant mt-3 max-w-xl mx-auto">
          Tell us what you need help with. Our support team will receive
          your request and create a ticket that can be tracked.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-xl p-6 sm:p-10">
        {ticketNumber ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-4xl">
                check_circle
              </span>
            </div>

            <h2 className="text-2xl font-bold">Ticket submitted!</h2>

            <p className="text-sm text-on-surface-variant">
              Your request has been received by the NJS support team.
            </p>

            <div className="bg-surface-container-low rounded-2xl p-5">
              <p className="text-xs text-on-surface-variant mb-2">
                YOUR SUPPORT TICKET NUMBER
              </p>

              <p className="text-2xl font-bold text-primary tracking-wider">
                {ticketNumber}
              </p>

              <p className="text-xs text-on-surface-variant mt-2">
                Keep this number for future reference.
              </p>
            </div>

            <button
              onClick={() => onNavigate('dashboard')}
              className="px-6 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold mb-2">
                Support category *
              </label>

              <select
                required
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-outline-variant outline-none text-sm focus:border-primary"
              >
                <option value="general">General Support</option>
                <option value="account">Account & Login</option>
                <option value="business_profile">Business Profile</option>
                <option value="connections">Discover & Matchmaking</option>
                <option value="messaging">Messages & Connections</option>
                <option value="billing">Billing & Subscription</option>
                <option value="bug_report">Report a Problem</option>
                <option value="other">Other Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2">
                Subject *
              </label>

              <input
                required
                maxLength={180}
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="What do you need help with?"
                className="w-full px-4 py-3 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2">
                Describe your issue *
              </label>

              <textarea
                required
                minLength={10}
                maxLength={5000}
                rows={7}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us what happened and how we can help..."
                className="w-full px-4 py-3 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm resize-y"
              />

              <p className="text-xs text-on-surface-variant mt-2">
                Please don't include passwords or sensitive payment details.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 p-3 text-sm"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-md hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Submitting ticket...' : 'Submit Support Ticket'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
);

      