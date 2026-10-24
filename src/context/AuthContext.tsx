import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, BusinessProfile, Subscription } from '../types';
import {
  signInWithGooglePopup,
  signOutGoogle,
  sendVerificationViaGmail,
  getCachedAccessToken,
  initGoogleAuth,
} from '../services/googleAuth';

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
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('njs_token'));
  const [user, setUser] = useState<User | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasGoogleAuth, setHasGoogleAuth] = useState<boolean>(false);

  useEffect(() => {
    // Listen to Firebase Google Auth state to track access tokens
    initGoogleAuth(
      (_gUser, _gToken) => {
        setHasGoogleAuth(true);
      },
      () => {
        setHasGoogleAuth(false);
      }
    );
  }, []);

  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    const currentToken = token || localStorage.getItem('njs_token');
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Request failed with status ' + res.status);
    }
    return data;
  };

  const refreshUser = async () => {
    const currentToken = localStorage.getItem('njs_token');
    if (!currentToken) {
      setUser(null);
      setBusinessProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiFetch('/api/auth/me');
      setUser(data.user);
      setBusinessProfile(data.businessProfile);
      setSubscription(data.subscription);
    } catch (e) {
      console.warn('Session expired or invalid:', e);
      localStorage.removeItem('njs_token');
      setToken(null);
      setUser(null);
      setBusinessProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await apiFetch('/api/auth/sign-in', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('njs_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setBusinessProfile(data.businessProfile);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to sign in' };
    }
  };

  const signUp = async (name: string, email: string, password: string) => {
    try {
      const data = await apiFetch('/api/auth/sign-up', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      localStorage.setItem('njs_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true, verificationCode: data.verificationCodeSent };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to sign up' };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { user: gUser } = await signInWithGooglePopup();
      const data = await apiFetch('/api/auth/google-sign-in', {
        method: 'POST',
        body: JSON.stringify({
          email: gUser.email,
          name: gUser.displayName || gUser.email?.split('@')[0],
          profileImage: gUser.photoURL || undefined,
          googleUid: gUser.uid,
        }),
      });
      localStorage.setItem('njs_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setBusinessProfile(data.businessProfile);
      setHasGoogleAuth(true);
      return { success: true, isNewUser: data.isNewUser };
    } catch (err: any) {
      console.error('Google sign in error:', err);
      return { success: false, error: err.message || 'Google sign-in failed' };
    }
  };

  const sendVerificationEmail = async (toEmail: string, code: string, name?: string) => {
    const accessToken = getCachedAccessToken();
    if (accessToken) {
      const res = await sendVerificationViaGmail(toEmail, code, name || 'Enterprise Partner', accessToken);
      if (res.success) {
        return { success: true, viaGmail: true };
      }
      return { success: false, error: res.error, viaGmail: false };
    }
    return { success: false, error: 'Google Gmail authentication required to send directly via Gmail.', viaGmail: false };
  };

  const signOut = async () => {
    try {
      await apiFetch('/api/auth/sign-out', { method: 'POST' });
    } catch {}
    await signOutGoogle().catch(() => {});
    localStorage.removeItem('njs_token');
    setToken(null);
    setUser(null);
    setBusinessProfile(null);
    setSubscription(null);
    setHasGoogleAuth(false);
  };

  const verifyEmail = async (code: string) => {
    try {
      await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      if (user) {
        setUser({ ...user, isEmailVerified: true });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Invalid code' };
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
      return { success: false, error: err.message || 'Failed to save business profile' };
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
