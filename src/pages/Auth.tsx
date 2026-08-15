import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Plane, Loader2, User, UserX, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function Auth() {
  const { user, loading, isGuest, enterGuestMode } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'code'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingEmail, setExistingEmail] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const isLogin = mode === 'login';


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user || isGuest) return <Navigate to="/" replace />;

  const handleGuestMode = () => {
    enterGuestMode();
    toast.success('Welcome aboard, Guest! Your data stays on this device.');
    navigate('/');
  };

  const handleForgot = async () => {
    if (!email) { toast.error('Enter your email first.'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Password reset email sent. Check your inbox.');
      setMode('login');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendCode = async () => {
    if (!email) { toast.error('Enter your email first.'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setCodeSent(true);
      toast.success('Sign-in code sent. Check your inbox.');
    } catch (err: any) {
      toast.error(err.message ?? 'Could not send code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.trim().length < 6) { toast.error('Enter the 6-digit code.'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
      if (error) throw error;
      toast.success('Welcome back, Captain!');
    } catch (err: any) {
      toast.error(err.message ?? 'Invalid or expired code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'forgot') { await handleForgot(); return; }
    if (mode === 'code') { await (codeSent ? handleVerifyCode() : handleSendCode()); return; }
    setSubmitting(true);


    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Welcome back, Captain!');
      } else {
        if (!username.trim()) {
          toast.error('Please enter a call sign.');
          setSubmitting(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        // Supabase returns a user with an empty identities array when the email
        // is already registered — no confirmation email is sent in that case.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          setExistingEmail(true);
          setMode('login');
          toast.info('This email is already registered — sign in instead.');
          return;
        }
        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ id: data.user.id, username: username.trim() });
          if (profileError?.code === '23505') {
            toast.warning('That username is taken — pick another one in your profile.');
          }
        }
        toast.success('Check your email to confirm your boarding pass.');
      }
    } catch (err: any) {
      if (/already registered|already exists/i.test(err.message ?? '')) {
        setExistingEmail(true);
        setMode('login');
        toast.info('This email is already registered — sign in instead.');
      } else {
        toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="glass-card glow-sky p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
           <Plane className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-xl font-bold text-foreground tracking-tight">
            Task Pilot
          </h1>
        </div>

        {existingEmail && (
          <div className="mb-4 rounded-md border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
            <p className="font-medium">This email already has an account.</p>
            <p className="text-muted-foreground mt-1">
              Sign in below, or{' '}
              <button
                type="button"
                onClick={() => { setExistingEmail(false); setMode('forgot'); }}
                className="text-primary hover:underline font-medium"
              >
                reset your password
              </button>
              .
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {mode === 'signup' && (
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">Call Sign</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  className="w-full bg-secondary/50 border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="Your name"
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={mode === 'code' && codeSent}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-60"
              placeholder="you@example.com"
            />
          </div>
          {mode === 'code' && codeSent && (
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 text-center text-lg tracking-[0.4em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="000000"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={submitting}
                className="mt-2 text-[11px] text-primary hover:underline"
              >
                Resend code
              </button>
            </div>
          )}
          {mode !== 'forgot' && mode !== 'code' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-muted-foreground font-medium">Password</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => setMode('forgot')} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                    <KeyRound className="w-3 h-3" /> Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="••••••••"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Board Flight'
              : mode === 'signup' ? 'Register'
              : mode === 'code' ? (codeSent ? 'Verify code' : 'Email me a code')
              : 'Send reset link'}
          </button>
        </form>

        {mode === 'login' && (
          <button
            onClick={() => { setMode('code'); setCodeSent(false); setCode(''); }}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-secondary/50 border border-border text-muted-foreground py-2.5 rounded-md text-sm font-medium hover:text-foreground hover:bg-secondary transition-colors"
          >
            <MailCheck className="w-4 h-4" />
            Sign in with a code
          </button>
        )}

        <p className="text-center text-xs text-muted-foreground mt-4">
          {mode === 'forgot' || mode === 'code' ? (
            <button onClick={() => { setMode('login'); setCodeSent(false); setCode(''); }} className="text-primary hover:underline font-medium">Back to sign in</button>
          ) : (
            <>
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={() => setMode(isLogin ? 'signup' : 'login')}
                className="text-primary hover:underline font-medium"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </>
          )}
        </p>



        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <button
          onClick={handleGuestMode}
          className="w-full flex items-center justify-center gap-2 bg-secondary/50 border border-border text-muted-foreground py-2.5 rounded-md text-sm font-medium hover:text-foreground hover:bg-secondary transition-colors"
        >
          <UserX className="w-4 h-4" />
          Fly Solo (Guest)
        </button>
        <p className="text-center text-[10px] text-muted-foreground mt-1.5">
          Data stored locally only — won't sync across devices
        </p>
      </div>
    </div>
  );
}
