import React, { useState } from 'react';

interface ContactPageProps {
  onNavigate: (path: string) => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/30 px-6 lg:px-16 py-4 flex items-center justify-between">
        <div onClick={() => onNavigate('landing')} className="flex items-center gap-2 cursor-pointer select-none">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold text-lg">
            NJS
          </div>
          <span className="text-xl font-bold tracking-tight text-on-surface">NJS Platform</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('sign-in')} className="text-sm font-medium hover:text-primary">
            Sign In
          </button>
          <button onClick={() => onNavigate('sign-up')} className="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 shadow-xs">
            Get Started
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 flex-1 my-auto">
        <div className="bg-surface-container-lowest rounded-3xl p-8 sm:p-12 border border-outline-variant/30 shadow-xl">
          <div className="text-center max-w-lg mx-auto mb-8">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Enterprise Inquiries</span>
            <h1 className="text-3xl font-bold text-on-surface mt-2">Get in touch with NJS</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Have questions about neural matchmaking or enterprise custom deployments? Reach out to our engineering team.
            </p>
          </div>

          {submitted ? (
            <div className="p-8 rounded-2xl bg-green-500/10 border border-green-500/30 text-center space-y-3">
              <span className="material-symbols-outlined text-4xl text-green-700">check_circle</span>
              <h2 className="text-xl font-bold text-green-800">Message Received</h2>
              <p className="text-sm text-green-700 leading-relaxed">
                Thank you for contacting NJS Platform. An enterprise specialist will follow up with you within one business day.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold"
              >
                Send Another Note
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Your Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Alex Morgan"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Business Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="alex@company.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Company / Organization</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Industrial Ltd."
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">How can we assist? *</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  placeholder="Tell us about your sourcing objectives or enterprise requirements..."
                  className="w-full p-4 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-md hover:opacity-90 transition-opacity cursor-pointer"
              >
                Send Message
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="bg-surface-container-low py-8 px-6 text-center text-xs text-on-surface-variant border-t border-outline-variant/30">
        © 2025 NJS Platform. All rights reserved.
      </footer>
    </div>
  );
};
