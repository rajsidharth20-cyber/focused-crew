import { useState } from 'react';
import { Settings, Swords, Plane, Sparkles, Instagram, Mail, KeyRound, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function SettingsDialog() {
  const { theme, setTheme } = useTheme();
  const { user, isGuest } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

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
            <Label className="text-sm font-medium text-muted-foreground mb-3 block">Theme</Label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'flight', Icon: Plane, name: 'Flight', desc: 'Sky blue cockpit' },
                { key: 'war', Icon: Swords, name: 'War', desc: 'Tactical fire ops' },
                { key: 'premium', Icon: Sparkles, name: 'Premium', desc: 'Light & elegant' },
              ].map(({ key, Icon, name, desc }) => (
                <button
                  key={key}
                  onClick={() => setTheme(key as any)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    theme === key
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-display font-semibold">{name}</span>
                  <span className="text-[10px] text-muted-foreground text-center">{desc}</span>
                </button>
              ))}
            </div>
          </div>

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
