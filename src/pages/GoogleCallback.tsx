import { useEffect } from 'react';

/**
 * Landing page for the Google Calendar OAuth popup.
 * The connector gateway redirects here with a one-time code, which we hand
 * back to the opener window to exchange server-side.
 */
export default function GoogleCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code =
      params.get('code') ||
      params.get('authorization_code') ||
      params.get('connection_code') ||
      '';
    const error = params.get('error') || params.get('error_description') || '';

    try {
      window.opener?.postMessage({ source: 'taskpilot-google-calendar', code, error }, window.location.origin);
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => window.close(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
      <p className="text-sm text-muted-foreground">
        Finishing Google Calendar connection… you can close this window.
      </p>
    </div>
  );
}
