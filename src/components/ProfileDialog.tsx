import { useEffect, useRef, useState } from 'react';
import { UserCircle2, Loader2, Camera, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const GUEST_KEY = 'taskpilot_guest_profile';

interface GuestProfile { fullName: string; bio: string; avatarUrl: string }

export function ProfileDialog() {
  const { user, username, isGuest, setUsername } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [callSign, setCallSign] = useState(username ?? '');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCallSign(username ?? ''); }, [username]);

  useEffect(() => {
    if (!open) return;
    if (isGuest) {
      try {
        const raw = localStorage.getItem(GUEST_KEY);
        if (raw) {
          const g: GuestProfile = JSON.parse(raw);
          setFullName(g.fullName ?? ''); setBio(g.bio ?? ''); setAvatarUrl(g.avatarUrl ?? '');
        }
      } catch {/* ignore */}
      return;
    }
    if (!user) return;
    setLoading(true);
    supabase.from('profiles').select('full_name, bio, avatar_url').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name ?? '');
        setBio(data?.bio ?? '');
        setAvatarUrl(data?.avatar_url ?? '');
      })
      .then(() => setLoading(false));
  }, [open, user, isGuest]);

  const signedAvatar = useSignedAvatar(avatarUrl);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast.error('Image must be under 4 MB.'); return; }
    setUploading(true);
    try {
      if (isGuest) {
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file);
        });
        setAvatarUrl(dataUrl);
        toast.success('Photo ready — remember to save.');
      } else if (user) {
        const ext = file.name.split('.').pop() || 'png';
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        setAvatarUrl(path);
        toast.success('Photo uploaded — remember to save.');
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (callSign.trim() && callSign.trim() !== username) {
        await setUsername(callSign.trim());
      }
      if (isGuest) {
        const g: GuestProfile = { fullName, bio, avatarUrl };
        localStorage.setItem(GUEST_KEY, JSON.stringify(g));
      } else if (user) {
        const { error } = await supabase.from('profiles').update({
          full_name: fullName || null, bio: bio || null, avatar_url: avatarUrl || null,
        }).eq('id', user.id);
        if (error) throw error;
      }
      toast.success('Profile saved');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const initial = (callSign || fullName || 'P').charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-secondary"
          aria-label="Open profile"
        >
          <Avatar className="w-6 h-6 border border-border">
            {signedAvatar && <AvatarImage src={signedAvatar} alt={callSign || 'Profile'} />}
            <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-bold">{initial}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">Profile</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <UserCircle2 className="w-5 h-5 text-primary" /> Your Profile
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="w-20 h-20 border-2 border-primary/30">
                  {signedAvatar && <AvatarImage src={signedAvatar} alt={callSign || 'Profile'} />}
                  <AvatarFallback className="text-2xl bg-primary/20 text-primary font-bold">{initial}</AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:opacity-90 disabled:opacity-50"
                  aria-label="Upload photo"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </div>
              <div className="text-xs text-muted-foreground">
                {isGuest ? 'Guest profiles stay on this device.' : 'JPG or PNG, up to 4 MB.'}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Call sign</Label>
              <Input value={callSign} onChange={e => setCallSign(e.target.value)} placeholder="Your call sign" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Full name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bio</Label>
              <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="A few words about you" rows={3} />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save profile
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function useSignedAvatar(pathOrUrl: string) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    if (!pathOrUrl) { setUrl(''); return; }
    if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('http')) { setUrl(pathOrUrl); return; }
    supabase.storage.from('avatars').createSignedUrl(pathOrUrl, 60 * 60).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? '');
    });
    return () => { cancelled = true; };
  }, [pathOrUrl]);
  return url;
}
