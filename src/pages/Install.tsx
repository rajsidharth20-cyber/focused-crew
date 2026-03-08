import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Smartphone, Share, MoreVertical, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export default function InstallPage() {
  const [installed, setInstalled] = useState(false);
  const navigate = useNavigate();

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      deferredPrompt = null;
    }
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  if (isStandalone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 text-center max-w-sm"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-xl font-bold text-foreground mb-2">Already Installed!</h1>
          <p className="text-sm text-muted-foreground mb-6">FocusFlow is running as an app.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Open FocusFlow
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full space-y-6"
      >
        {/* App Icon */}
        <div className="text-center">
          <img
            src="/pwa-192x192.png"
            alt="FocusFlow"
            className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-lg"
          />
          <h1 className="font-display text-2xl font-bold text-foreground">FocusFlow</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-Powered Schedule Planner</p>
        </div>

        {/* Install Button (Android / Desktop) */}
        {!isIOS && (
          <button
            onClick={handleInstall}
            className="w-full bg-primary text-primary-foreground px-6 py-4 rounded-xl font-semibold text-base hover:opacity-90 transition-opacity flex items-center justify-center gap-3 glow-amber"
          >
            <Download className="w-5 h-5" />
            Install App
          </button>
        )}

        {installed && (
          <p className="text-center text-sm text-primary font-medium">✓ App installed! Check your home screen.</p>
        )}

        {/* iOS Instructions */}
        {isIOS && (
          <div className="glass-card p-5 space-y-4">
            <h2 className="font-display text-sm font-semibold text-primary uppercase tracking-wide">
              Install on iPhone
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Share className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="text-sm text-foreground">
                  Tap the <strong>Share</strong> button in Safari's toolbar
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Plus className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="text-sm text-foreground">
                  Scroll down and tap <strong>"Add to Home Screen"</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Smartphone className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="text-sm text-foreground">
                  Tap <strong>"Add"</strong> — FocusFlow will appear on your home screen
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Android Manual Instructions */}
        {isAndroid && (
          <div className="glass-card p-5 space-y-4">
            <h2 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Or install manually
            </h2>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Tap the browser menu → <strong>"Add to Home screen"</strong>
              </p>
            </div>
          </div>
        )}

        {/* Go to app */}
        <button
          onClick={() => navigate('/')}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Continue in browser →
        </button>
      </motion.div>
    </div>
  );
}
