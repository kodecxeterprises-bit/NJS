import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { signInWithGooglePopup } from '../../services/googleAuth';

interface ForgotPasswordPageProps {
  onNavigate: (path: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate }) => {
  const { apiFetch, sendVerificationEmail } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<string | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setGmailStatus(null);
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(res.message);
      const generatedCode = res.debugCode;
      if (generatedCode) {
        setCode(generatedCode);

        // Attempt sending via Gmail
        const gmailRes = await sendVerificationEmail(email, generatedCode, email.split('@')[0]);
        if (gmailRes.viaGmail) {
          setGmailStatus(`Password reset code dispatched via Gmail API to ${email}!`);
        }
      }
      setStep('reset');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendViaGmailDirectly = async () => {
    if (!email || !code) return;
    try {
      let res = await sendVerificationEmail(email, code, email.split('@')[0]);
      if (!res.viaGmail) {
        await signInWithGooglePopup();
        res = await sendVerificationEmail(email, code, email.split('@')[0]);
      }
      if (res.viaGmail) {
        setGmailStatus(`Recovery email sent to ${email} via Google Gmail API!`);
      }
    } catch (e: any) {
      setError(e.message || 'Gmail dispatch error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword }),
      });
      showToast('Password reset successfully! Please sign in with your new password.', 'success');
      onNavigate('sign-in');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
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
        <div className="w-full bg-surface-container-lowest rounded-2xl shadow-xl p-6 sm:p-8 border border-outline-variant/30">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-on-primary mb-3 shadow-md">
              <span className="material-symbols-outlined text-2xl">lock_reset</span>
            </div>
            <h1 className="text-2xl font-bold text-on-surface text-center tracking-tight mb-1">
              Reset Your Password
            </h1>
            <p className="text-sm text-on-surface-variant text-center">
              {step === 'request'
                ? 'Enter your registered email address to receive a secure recovery code.'
                : 'Enter your verification code and choose a new password.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-error-container/40 border border-error/30 text-error text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 rounded-xl bg-primary-fixed text-on-primary-fixed text-xs font-medium">
              {message}
            </div>
          )}

          {gmailStatus && (
            <div className="mb-4 p-3 rounded-xl bg-orange-50 border border-primary/30 text-primary text-xs flex items-center justify-center gap-2 font-medium">
              <span className="material-symbols-outlined text-[18px]">outgoing_mail</span>
              <span>{gmailStatus}</span>
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@njsenterprise.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-primary-container text-on-primary-container font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {isLoading ? 'Sending...' : 'Send Recovery Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Verification Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface transition-all"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-primary-container text-on-primary-container font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {isLoading ? 'Updating...' : 'Set New Password'}
              </button>

              <button
                type="button"
                onClick={handleSendViaGmailDirectly}
                className="w-full py-2.5 px-4 rounded-xl bg-surface border border-outline-variant hover:border-primary text-on-surface text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">outgoing_mail</span>
                <span>Resend Code to Email via Gmail API</span>
              </button>
            </form>
          )}

          <div className="text-center mt-6 pt-4 border-t border-outline-variant/30">
            <button
              onClick={() => onNavigate('sign-in')}
              className="text-xs text-primary font-semibold hover:underline cursor-pointer"
            >
              ← Back to Sign In
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
