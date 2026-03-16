import { useState } from 'react';
import { Plane, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function UsernamePrompt() {
  const { setUsername } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await setUsername(name.trim());
      toast.success(`Welcome aboard, ${name.trim()}!`);
    } catch {
      toast.error('Failed to save call sign.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="glass-card glow-sky p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-4 justify-center">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Plane className="w-5 h-5 text-primary" />
          </div>
        </div>
        <h2 className="font-display text-lg font-bold text-foreground text-center mb-1">What's your call sign?</h2>
        <p className="text-xs text-muted-foreground text-center mb-5">We'll use this to greet you before each flight.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            autoFocus
            className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            placeholder="Your name"
          />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Ready for Takeoff
          </button>
        </form>
      </div>
    </div>
  );
}
