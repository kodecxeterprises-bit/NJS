import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface ForgotPasswordPageProps { onNavigate: (path: string) => void; }
export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [isRecovery,setIsRecovery]=useState(() => window.location.pathname.includes('reset-password') || window.location.hash.includes('type=recovery'));
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{ if(event==='PASSWORD_RECOVERY') setIsRecovery(true); });
    void supabase.auth.getSession().then(({data})=>{ if(window.location.pathname.includes('reset-password') && data.session) setIsRecovery(true); });
    return ()=>subscription.unsubscribe();
  },[]);
  const requestReset=async(e:React.FormEvent)=>{
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/reset-password`}); if(error) throw error; setMessage('If an account exists for that email, Supabase will send a secure password-reset link. Open the link on this device to choose a new password.'); }
    catch(err:any){setError(err.message||'Could not request a password reset.');} finally{setBusy(false);}
  };
  const savePassword=async(e:React.FormEvent)=>{
    e.preventDefault(); setError(''); if(password.length<8){setError('Use at least 8 characters for your new password.');return;} if(password!==confirmPassword){setError('The passwords do not match.');return;}
    setBusy(true); try {const {error}=await supabase.auth.updateUser({password}); if(error) throw error; showToast('Password updated. Please sign in with your new password.','success'); await supabase.auth.signOut(); onNavigate('sign-in');} catch(err:any){setError(err.message||'Could not update password. Open the latest reset email link and try again.');} finally{setBusy(false);}
  };
  return <div className="min-h-screen bg-surface text-on-surface flex flex-col justify-between py-8 px-4"><header className="flex justify-center"><button onClick={()=>onNavigate('landing')} className="font-bold text-xl">NJS Enterprise</button></header><main className="w-full max-w-md mx-auto my-auto bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-xl"><div className="text-center mb-6"><div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-primary text-on-primary grid place-items-center"><span className="material-symbols-outlined">{isRecovery?'lock_reset':'mail'}</span></div><h1 className="text-2xl font-bold">{isRecovery?'Choose a new password':'Reset your password'}</h1><p className="text-sm text-on-surface-variant mt-2">{isRecovery?'Enter your new password below.':'We will email you a secure password-reset link.'}</p></div>{error&&<p role="alert" className="mb-4 rounded-lg bg-error-container p-3 text-sm">{error}</p>}{message&&<p role="status" className="mb-4 rounded-lg bg-surface-container p-3 text-sm">{message}</p>}{!isRecovery?<form onSubmit={requestReset} className="space-y-4"><label className="block text-sm font-medium">Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-surface p-3" placeholder="you@example.com"/></label><button disabled={busy} className="w-full rounded-xl bg-primary text-on-primary p-3 font-semibold disabled:opacity-60">{busy?'Sending…':'Send reset link'}</button></form>:<form onSubmit={savePassword} className="space-y-4"><label className="block text-sm font-medium">New password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-surface p-3"/></label><label className="block text-sm font-medium">Confirm new password<input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-surface p-3"/></label><button disabled={busy} className="w-full rounded-xl bg-primary text-on-primary p-3 font-semibold disabled:opacity-60">{busy?'Updating…':'Update password'}</button></form>}<button onClick={()=>onNavigate('sign-in')} className="mt-5 w-full text-sm font-semibold text-primary">Back to sign in</button></main><footer className="text-center text-xs text-on-surface-variant">NJS Enterprise</footer></div>;
};
