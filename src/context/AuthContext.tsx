
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { User, BusinessProfile, Subscription } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  businessProfile: BusinessProfile | null;
  subscription: Subscription | null;
  token: string | null;
  isLoading: boolean;
  hasGoogleAuth: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; verificationCode?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
  sendVerificationEmail: (toEmail: string, code: string, name?: string) => Promise<{ success: boolean; error?: string; viaGmail?: boolean }>;
  signOut: () => Promise<void>;
  verifyEmail: (code: string) => Promise<{ success: boolean; error?: string }>;
  updateBusinessProfile: (profile: Partial<BusinessProfile>) => Promise<{ success: boolean; profile?: BusinessProfile; error?: string }>;
  refreshUser: () => Promise<void>;
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasGoogleAuth, setHasGoogleAuth] = useState(false);

  const clearAppUser = useCallback(() => {
    setToken(null);
    setUser(null);
    setBusinessProfile(null);
    setSubscription(null);
    setHasGoogleAuth(false);
  }, []);

  // All protected API requests use the current Supabase access token.
  const apiFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    const headers = new Headers(options.headers);
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    } else {
      headers.delete('Authorization');
    }

    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return data;
  }, []);

  // Loads the existing NJS user, business profile and subscription
  // through the application's API after Supabase authenticates the user.
  const loadAppProfile = useCallback(async (accessToken: string) => {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Could not load your NJS profile');
    }

    setUser(data.user ?? null);
    setBusinessProfile(data.businessProfile ?? null);
    setSubscription(data.subscription ?? null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (!session) {
        clearAppUser();
        return;
      }

      setToken(session.access_token);
      setHasGoogleAuth(
        session.user.app_metadata?.provider === 'google' ||
        session.user.app_metadata?.providers?.includes('google') === true
      );

      await loadAppProfile(session.access_token);
    } catch (err) {
      console.error('Unable to refresh NJS session:', err);
      clearAppUser();
    } finally {
      setIsLoading(false);
    }
  }, [clearAppUser, loadAppProfile]);

  useEffect(() => {
    let active = true;

    // Subscribe to sign-in, sign-out, token refresh and OAuth callbacks.
    const { data: { subscription: authSubscription } } =
      supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return;

        if (!session) {
          clearAppUser();
          setIsLoading(false);
          return;
        }

        setToken(session.access_token);
        setHasGoogleAuth(
          session.user.app_metadata?.provider === 'google' ||
          session.user.app_metadata?.providers?.includes('google') === true
        );

        // Run API work outside the auth callback to avoid locking
        // Supabase's auth-state processing.
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          Promise.resolve().then(async () => {
            if (!active) return;
            try {
              await loadAppProfile(session.access_token);
            } catch (err) {
              console.error('Unable to load NJS profile:', err);
            } finally {
              if (active) setIsLoading(false);
            }
          });
        }
      });

    void refreshUser();

    return () => {
      active = false;
      authSubscription.unsubscribe();
    };
  }, [clearAppUser, loadAppProfile, refreshUser]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      if (!data.session) {
        throw new Error('Sign-in succeeded but no session was returned. Please try again.');
      }

      setToken(data.session.access_token);
      await loadAppProfile(data.session.access_token);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to sign in' };
    }
  };

  const signUp = async (name: string, email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // Never return or expose a made-up verification code.
      // Supabase sends the confirmation email when confirmation is enabled.
      if (data.session) {
        setToken(data.session.access_token);
        try {
          await loadAppProfile(data.session.access_token);
        } catch (profileError) {
          console.warn('Account created; NJS profile setup is pending.', profileError);
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to sign up' };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // Supabase redirects the browser to Google; it completes the
      // sign-in when the user returns to the configured redirect URL.
      return { success: true };
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      return { success: false, error: err.message || 'Google sign-in failed' };
    }
  };

  const sendVerificationEmail = async (toEmail: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: toEmail.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
      return { success: true, viaGmail: false };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Could not resend the confirmation email',
        viaGmail: false,
      };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.warn('Supabase sign-out warning:', error.message);
    } finally {
      clearAppUser();
    }
  };

  const verifyEmail = async (_code: string) => {
    try {
      // Supabase verifies the address through its confirmation link,
      // not by entering an application-generated code.
      const { data, error } = await supabase.auth.getUser();

      if (error) throw error;

      if (!data.user?.email_confirmed_at) {
        return {
          success: false,
          error: 'Please open the confirmation link sent to your email first.',
        };
      }

      await refreshUser();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Email verification could not be checked' };
    }
  };

  const updateBusinessProfile = async (profileData: Partial<BusinessProfile>) => {
    try {
      const res = await apiFetch('/api/business/save', {
        method: 'POST',
        body: JSON.stringify(profileData),
      });

      setBusinessProfile(res.businessProfile);
      return { success: true, profile: res.businessProfile };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to save business profile',
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        businessProfile,
        subscription,
        token,
        isLoading,
        hasGoogleAuth,
        signIn,
        signUp,
        signInWithGoogle,
        sendVerificationEmail,
        signOut,
        verifyEmail,
        updateBusinessProfile,
        refreshUser,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};