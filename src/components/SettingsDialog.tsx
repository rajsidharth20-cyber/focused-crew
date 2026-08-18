import { useState } from 'react';
import { Settings, Instagram, Mail, KeyRound, Loader2, Trash2, Sunrise } from 'lucide-react';
import { useDayStart, DAY_START_OPTIONS } from '@/hooks/use-day-start';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { GoogleCalendarCard } from '@/components/GoogleCalendarCard';

export function SettingsDialog() {
  const { theme, setTheme, themes } = useTheme();
  const { user, isGuest } = useAuth();
  const dayStart = useDayStart();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    const typed = window.prompt('This permanently deletes your account and all your data. Type DELETE to confirm.');
    if (typed?.trim().toUpperCase() !== 'DELETE') return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success('Your account and data have been deleted.');
      window.location.href = '/auth';
    } catch (err: any) {
      toast.error(err.message ?? 'Could not delete account.');
    } finally {
      setDeleting(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    setChanging(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated.');
      setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message ?? 'Could not change password.');
    } finally {
      setChanging(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          <div>
            <Label className="text-sm font-medium text-muted-foreground mb-1 block">Theme</Label>
            <p className="text-xs text-muted-foreground mb-3">Saved to your account and synced across devices.</p>
            <div className="grid grid-cols-2 gap-2.5">
              {themes.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  className={`press flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                    theme === t.key
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                  }`}
                >
                  <span
                    className="h-9 w-9 shrink-0 rounded-xl border border-border/60 overflow-hidden flex flex-col"
                    aria-hidden
                    style={{ background: t.swatch[0] }}
                  >
                    <span className="flex-1" style={{ background: t.swatch[1] }} />
                    <span className="h-2.5 w-full" style={{ background: t.swatch[2] }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground truncate">
                      {t.emoji} {t.name}
                    </span>
                    <span className="block text-[10px] text-muted-foreground truncate">{t.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border/50 pt-4">
            <Label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Sunrise className="w-3.5 h-3.5" /> New day starts at
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Tasks and study stats roll over to a fresh day at this time.
            </p>
            <select
              value={dayStart.hour}
              onChange={e => dayStart.setHour(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {DAY_START_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {user && !isGuest && (
            <Link
              to="/settings/notifications"
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">Notifications</div>
                <div className="text-xs text-muted-foreground">Choose what you get alerted about</div>
              </div>
            </Link>
          )}

          {user && !isGuest && <GoogleCalendarCard />}

          {user && !isGuest && (

            <div className="space-y-3 border-t border-border/50 pt-4">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Change password
              </Label>
              <Input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} />
              <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={6} />
              <button
                onClick={handleChangePassword}
                disabled={changing || !newPassword}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {changing ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Update password
              </button>
            </div>
          )}

          {user && !isGuest && (
            <div className="space-y-2 border-t border-destructive/30 pt-4">
              <Label className="text-sm font-medium text-destructive flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete account
              </Label>
              <p className="text-xs text-muted-foreground">
                Permanently erases your profile, posts, messages, study data and photos. This cannot be undone.
              </p>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full inline-flex items-center justify-center gap-2 border border-destructive/50 text-destructive py-2 rounded-md text-sm font-semibold hover:bg-destructive/10 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete my account
              </button>
            </div>
          )}


          <div className="border-t border-border/50 pt-4 space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">Connect with the developer</Label>
            <div className="space-y-2">
              <a
                href="https://instagram.com/astrosid01"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                  <Instagram className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Instagram</div>
                  <div className="text-sm font-semibold truncate">@astrosid01</div>
                </div>
              </a>
              <a
                href="mailto:rajsidharth20@gmail.com"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="text-sm font-semibold truncate">rajsidharth20@gmail.com</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
