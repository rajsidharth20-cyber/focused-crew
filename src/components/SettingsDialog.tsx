import { Settings, Swords, Plane, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/hooks/use-theme';

export function SettingsDialog() {
  const { theme, setTheme } = useTheme();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-sm font-medium text-muted-foreground mb-3 block">Theme</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTheme('flight')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  theme === 'flight'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                }`}
              >
                <Plane className="w-6 h-6" />
                <span className="text-sm font-display font-semibold">Flight</span>
                <span className="text-[10px] text-muted-foreground">Sky blue cockpit</span>
              </button>
              <button
                onClick={() => setTheme('war')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  theme === 'war'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                }`}
              >
                <Swords className="w-6 h-6" />
                <span className="text-sm font-display font-semibold">War</span>
                <span className="text-[10px] text-muted-foreground">Tactical fire ops</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
