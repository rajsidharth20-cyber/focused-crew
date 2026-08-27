import { Calendar, Loader2, RefreshCw, Link2Off, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/use-google-calendar';
import { Label } from '@/components/ui/label';

export function GoogleCalendarCard() {
  const { status, loading, connecting, syncing, error, connect, disconnect, sync } = useGoogleCalendar();

  const needsReconnect = status.state === 'reconnect_required';
  const isConnected = status.state === 'connected';

  const subtitle = loading
    ? 'Checking…'
    : needsReconnect
      ? 'Access expired — reconnect to keep syncing'
      : isConnected
        ? status.lastSyncedAt
          ? `Last synced ${new Date(status.lastSyncedAt).toLocaleString()}`
          : 'Ready to sync'
        : 'Push your schedule, events and deadlines to your Google account';

  return (
    <div className="border-t border-border/50 pt-4 space-y-3">
      <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5" /> Google Calendar
      </Label>

      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              needsReconnect ? 'bg-destructive/15' : 'bg-primary/15'
            }`}
          >
            {needsReconnect ? (
              <AlertTriangle className="w-4 h-4 text-destructive" />
            ) : isConnected ? (
              <CheckCircle2 className="w-4 h-4 text-primary" />
            ) : (
              <Calendar className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">
              {isConnected || needsReconnect ? (status.email ?? 'Google account') : 'Not connected'}
            </div>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-md px-2.5 py-2 leading-relaxed">
            {error}
          </p>
        )}

        {isConnected ? (
          <div className="flex gap-2">
            <button
              onClick={() => sync()}
              disabled={syncing}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <button
              onClick={disconnect}
              className="inline-flex items-center justify-center gap-2 border border-border py-2 px-3 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground"
              aria-label="Disconnect Google Calendar"
            >
              <Link2Off className="w-4 h-4" />
            </button>
          </div>
        ) : needsReconnect ? (
          <div className="flex gap-2">
            <button
              onClick={connect}
              disabled={connecting}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {connecting ? 'Reconnecting…' : 'Reconnect Google'}
            </button>
            <button
              onClick={disconnect}
              className="inline-flex items-center justify-center gap-2 border border-border py-2 px-3 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground"
              aria-label="Remove Google Calendar connection"
            >
              <Link2Off className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={connecting || loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            {connecting ? 'Waiting for Google…' : 'Connect Google Calendar'}
          </button>
        )}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Syncs your classes &amp; commitments, upcoming events and objective deadlines (next 60 days) into your Google Calendar. Nothing is read from Google.
        </p>
      </div>
    </div>
  );
}
