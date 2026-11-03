/** Shared across hooks/tabs on this device; never contains message text. */
export function claimNotification(tag: string, now = Date.now()): boolean {
  if (!tag) return true;
  try {
    const key = 'fc_notification_seen_v1';
    const entries = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, number>;
    if (entries[tag] && now - entries[tag] < 86400000) return false;
    const recent = Object.entries(entries).filter(([, time]) => now - time < 86400000).slice(-200);
    localStorage.setItem(key, JSON.stringify({ ...Object.fromEntries(recent), [tag]: now }));
  } catch { /* storage unavailable: do not lose a notification */ }
  return true;
}