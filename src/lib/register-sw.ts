import { registerSW as viteRegisterSW } from 'virtual:pwa-register';

const BLOCKED_HOST_SUFFIXES = [
  'lovableproject.com',
  'lovableproject-dev.com',
  'beta.lovable.dev',
];

function isBlockedContext() {
  if (!import.meta.env.PROD) return true;
  if (typeof window === 'undefined') return true;
  if (window.self !== window.top) return true;
  const host = window.location.hostname;
  if (host.startsWith('id-preview--') || host.startsWith('preview--')) return true;
  if (BLOCKED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) return true;
  if (new URLSearchParams(window.location.search).has('sw')
    && new URLSearchParams(window.location.search).get('sw') === 'off') return true;
  return false;
}

async function unregisterAppSW() {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => {
        const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? '';
        return url.endsWith('/sw.js');
      })
      .map((r) => r.unregister()),
  );
}

/** Drops legacy FCM workers that were registered on the root scope. */
async function cleanupRootScopedFcmSW() {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => {
        const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? '';
        return url.endsWith('/firebase-messaging-sw.js') && new URL(r.scope).pathname === '/';
      })
      .map((r) => r.unregister()),
  );
}

export function registerAppServiceWorker() {
  if (isBlockedContext()) {
    unregisterAppSW().catch(() => {});
    return;
  }

  cleanupRootScopedFcmSW().catch(() => {});

  // Update in the background instead of reloading the page the moment a new
  // worker takes control — an automatic reload here can loop endlessly.
  viteRegisterSW({
    immediate: true,
    onNeedRefresh() {},
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
}
