import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Loader2, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash automatically and fires PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { toast.error('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated. You are signed in.');
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? 'Could not update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="glass-card glow-sky p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-4 justify-center">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Plane className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-lg font-bold">Reset Password</h1>
        </div>
        {!ready ? (
          <p className="text-xs text-muted-foreground text-center">
            Open the reset link from your email to continue. If you got here by mistake, <button className="text-primary hover:underline" onClick={() => navigate('/auth')}>go back to sign in</button>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">New password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">Confirm password</label>
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit" disabled={submitting}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
