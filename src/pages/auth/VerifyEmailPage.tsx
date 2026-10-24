import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { signInWithGooglePopup } from '../../services/googleAuth';

interface VerifyEmailPageProps {
  onNavigate: (path: string) => void;
  onVerified: () => void;
  initialCode?: string;
}

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ onNavigate, onVerified, initialCode }) => {
  const { user, verifyEmail, sendVerificationEmail, apiFetch } = useAuth();
  const [code, setCode] = useState(initialCode || '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGmailSending, setIsGmailSending] = useState(false);
  const [gmailSentNotice, setGmailSentNotice] = useState<string | null>(null);

  const targetEmail = user?.email || '';

  // Trigger Gmail dispatch when requested
  const handleDispatchGmail = async () => {
    if (!targetEmail) return;
    setIsGmailSending(true);
    setGmailSentNotice(null);
    setError(null);

    try {
      // If code isn't available locally, fetch or resend from server
      let codeToSend = code || initialCode;
      if (!codeToSend) {
        const res = await apiFetch('/api/auth/resend-code', {
          method: 'POST',
          body: JSON.stringify({ email: targetEmail }),
        });
        codeToSend = res.verificationCode;
        if (codeToSend) setCode(codeToSend);
      }

      // Try sending via current cached Gmail token
      let result = await sendVerificationEmail(targetEmail, codeToSend || '123456', user?.name);

      // If no token cached yet, prompt Google authentication to authorize Gmail API
      if (!result.viaGmail) {
        const { accessToken } = await signInWithGooglePopup();
        result = await sendVerificationEmail(targetEmail, codeToSend || '123456', user?.name);
      }

      if (result.viaGmail) {
        setGmailSentNotice(`Verification email successfully delivered to ${targetEmail} via Google Gmail API!`);
      } else {
        setError(result.error || 'Failed to dispatch via Gmail.');
      }
    } catch (err: any) {
      console.error('Gmail send error:', err);
      setError(err.message || 'Could not send verification code via Gmail.');
    } finally {
      setIsGmailSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setError(null);
    const res = await verifyEmail(code.trim());
    setIsLoading(false);

    if (res.success) {
      setSuccess('Email successfully verified!');
      setTimeout(() => {
        onVerified();
      }, 1000);
    } else {
      setError(res.error || 'Invalid code. Please try again.');
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col justify-between py-8 px-4 sm:px-6">
      <header className="w-full flex justify-center items-center py-4">
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary font-bold text-lg">
            NJS
          </div>
          <span className="text-xl font-bold tracking-tight text-on-surface">NJS Enterprise</span>
        </button>
      </header>

      <main className="w-full max-w-md mx-auto my-auto">
        <div className="w-full bg-surface-container-lowest rounded-2xl shadow-xl p-6 sm:p-8 border border-outline-variant/30 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-on-primary mx-auto mb-4 shadow-md">
            <span className="material-symbols-outlined text-2xl">mark_email_read</span>
          </div>

          <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-2">
            Verify your email
          </h1>
          <p className="text-sm text-on-surface-variant mb-6">
            We sent a verification code to <strong className="text-on-surface">{user?.email || 'your email'}</strong>. Enter the code below to activate your enterprise profile.
          </p>

          {initialCode && (
            <div className="mb-4 p-3 rounded-xl bg-primary-fixed text-on-primary-fixed text-xs font-medium">
              Demo Code Sent: <strong>{initialCode}</strong> (Click Verify)
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-error-container/40 border border-error/30 text-error text-xs flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-700 text-xs flex items-center justify-center gap-2 font-medium">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{success}</span>
            </div>
          )}

          {gmailSentNotice && (
            <div className="mb-4 p-3 rounded-xl bg-orange-50 border border-primary/30 text-primary text-xs flex items-center justify-center gap-2 font-medium">
              <span className="material-symbols-outlined text-[18px]">outgoing_mail</span>
              <span>{gmailSentNotice}</span>
            </div>
          )}

          {/* Google Gmail Dispatch Action */}
          <div className="mb-5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs flex flex-col items-center gap-2">
            <span className="text-on-surface-variant">Want the code delivered directly to your real Gmail inbox?</span>
            <button
              type="button"
              onClick={handleDispatchGmail}
              disabled={isGmailSending}
              className="px-4 py-2 rounded-lg bg-surface border border-outline-variant hover:border-primary text-on-surface font-semibold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              {isGmailSending ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin text-primary">progress_activity</span>
                  <span>Sending via Gmail API...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                  <span>Send Code to Email via Gmail</span>
                </>
              )}
            </button>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 123456"
                maxLength={6}
                className="w-full text-center text-2xl font-bold tracking-widest px-4 py-3 rounded-xl bg-surface border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-on-surface transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-[#FF5C14] hover:bg-[#e04e0f] text-on-primary font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span>Verifying...</span>
                </>
              ) : (
                'Verify & Continue to Onboarding'
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-outline-variant/30 flex justify-between items-center text-xs text-on-surface-variant">
            <button
              onClick={() => onNavigate('sign-in')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Change account
            </button>
            <button
              onClick={() => onVerified()}
              className="text-primary font-medium hover:underline cursor-pointer"
            >
              Skip verification for now →
            </button>
          </div>
        </div>
      </main>

      <footer className="w-full text-center text-xs text-on-surface-variant py-4">
        © 2025 NJS Enterprise. All rights reserved.
      </footer>
    </div>
  );
};
