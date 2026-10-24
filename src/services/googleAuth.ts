import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory token caching per guidelines
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initGoogleAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGooglePopup = async (): Promise<{ user: FirebaseUser; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Auth');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const signOutGoogle = async () => {
  await firebaseSignOut(auth);
  cachedAccessToken = null;
};

/**
 * Send an email via the official Gmail API
 * Requires https://www.googleapis.com/auth/gmail.send scope and active accessToken
 */
export const sendVerificationViaGmail = async (
  toEmail: string,
  verificationCode: string,
  recipientName: string = 'Enterprise Partner',
  tokenOverride?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  const token = tokenOverride || cachedAccessToken;
  if (!token) {
    return {
      success: false,
      error: 'Google account not connected or Gmail permission missing. Please authenticate with Google first.',
    };
  }

  try {
    // Construct RFC 2822 message
    const subject = `Your NJS Verification Code: ${verificationCode}`;
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>NJS Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FFF8F6; margin: 0; padding: 32px; color: #2B2B2B;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #EBE0DC; overflow: hidden; box-shadow: 0 4px 12px rgba(17, 17, 17, 0.05);">
    <div style="background-color: #FF5C14; padding: 24px; text-align: center;">
      <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">NJS Platform</h1>
      <p style="color: #FFF1EA; margin: 4px 0 0 0; font-size: 13px;">AI-Powered B2B Business Matchmaking</p>
    </div>
    <div style="padding: 32px 28px;">
      <h2 style="font-size: 20px; font-weight: 700; color: #111111; margin-top: 0;">Verify Your Email Address</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #737373;">
        Hello <strong>${recipientName}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #737373;">
        Thank you for joining the NJS Platform. Use the one-time verification code below to verify your account and activate your business profile:
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <div style="display: inline-block; background-color: #FFF1EA; border: 2px dashed #FF5C14; border-radius: 12px; padding: 16px 36px;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #FF5C14;">
            ${verificationCode}
          </span>
        </div>
      </div>
      <p style="font-size: 13px; color: #737373; line-height: 1.5;">
        This security code will expire in 15 minutes. If you did not initiate this request, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #F5F5F5; margin: 24px 0;" />
      <p style="font-size: 12px; color: #9E9E9E; margin: 0; text-align: center;">
        Sent via NJS Enterprise Gmail Integration • Secure Dispatch
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const rawMessage = [
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      htmlBody,
    ].join('\r\n');

    // Base64URL safe encoding
    const encoded = btoa(unescape(encodeURIComponent(rawMessage)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Gmail API returned ${response.status}`);
    }

    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (err: any) {
    console.error('Failed to send verification email via Gmail:', err);
    return { success: false, error: err.message || 'Failed to dispatch email via Gmail' };
  }
};
