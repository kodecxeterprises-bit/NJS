import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface SignUpPageProps {
  onNavigate: (path: string) => void;
  onRegistered: (verificationCode?: string) => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onNavigate, onRegistered }) => {
  const { signUp, signInWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const res = await signInWithGoogle();
      if (res.success) {
        onNavigate('onboarding');
      } else {
        setError(res.error || 'Failed to sign up with Google.');
      }
    } catch (err: any) {
      setError(err.message || 'Google sign-up was cancelled or failed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!agreedTerms) {
      setError('You must agree to the Terms and Privacy Policy to continue.');
      return;
    }

    setIsLoading(true);
    const res = await signUp(fullName, email, password);
    setIsLoading(false);

    if (res.success) {
      onRegistered(res.verificationCode);
    } else {
      setError(res.error || 'Failed to create account.');
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col justify-between py-8 px-4 sm:px-6">
      {/* Header Logo */}
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

      {/* Main Card */}
      <main className="w-full max-w-md mx-auto my-auto">
        <div className="w-full bg-surface-container-lowest rounded-2xl shadow-xl p-6 sm:p-8 border border-outline-variant/30">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-on-primary mb-3 shadow-md">
              <span className="material-symbols-outlined text-2xl">person_add</span>
            </div>
            <h1 className="text-2xl font-bold text-on-surface text-center tracking-tight mb-1">
              Create your NJS account
            </h1>
            <p className="text-sm text-on-surface-variant text-center">
              Start your journey with NJS Enterprise today.
            </p>
          </div>

          {/* Continue with Google */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-surface border border-outline-variant hover:border-primary text-on-surface text-sm font-medium transition-all shadow-xs mb-4 cursor-pointer disabled:opacity-60"
          >
            {isGoogleLoading ? (
              <span className="material-symbols-outlined text-[20px] animate-spin text-primary">
                progress_activity
              </span>
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span>{isGoogleLoading ? 'Connecting Google Account...' : 'Continue with Google'}</span>
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-outline-variant/60"></div>
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
              or sign up with email
            </span>
            <div className="flex-1 h-px bg-outline-variant/60"></div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-error-container/40 border border-error/30 text-error text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface" htmlFor="fullname">
                Full Name
              </label>
              <input
                id="fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm text-on-surface transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@njsenterprise.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm text-on-surface transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm text-on-surface transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface" htmlFor="confirm_password">
                Confirm Password
              </label>
              <input
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm text-on-surface transition-all"
                required
              />
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input
                id="terms"
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary border-outline accent-primary cursor-pointer"
              />
              <label htmlFor="terms" className="text-xs text-on-surface-variant leading-relaxed select-none cursor-pointer">
                I agree to the{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('terms')}
                  className="text-primary font-medium hover:underline cursor-pointer"
                >
                  Terms of Service
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('privacy')}
                  className="text-primary font-medium hover:underline cursor-pointer"
                >
                  Privacy Policy
                </button>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-[#FF5C14] hover:bg-[#e04e0f] text-on-primary font-semibold text-sm shadow-md transition-all duration-200 mt-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span>Creating Account...</span>
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="text-center mt-6 pt-4 border-t border-outline-variant/30">
            <p className="text-sm text-on-surface-variant">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate('sign-in')}
                className="text-primary font-semibold hover:underline ml-1 cursor-pointer"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </main>

      <footer className="w-full text-center text-xs text-on-surface-variant py-4 flex flex-col sm:flex-row items-center justify-center gap-3">
        <span>© 2025 NJS Enterprise. All rights reserved.</span>
        <div className="flex items-center gap-3 text-outline">
          <button onClick={() => onNavigate('terms')} className="hover:text-primary transition-colors cursor-pointer">
            Terms of Service
          </button>
          <span>•</span>
          <button onClick={() => onNavigate('privacy')} className="hover:text-primary transition-colors cursor-pointer">
            Privacy Policy
          </button>
        </div>
      </footer>
    </div>
  );
};
