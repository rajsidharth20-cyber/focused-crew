/** Wait for this registration, not ready (which waits for the page's root worker). */
export function waitForWorkerActive(registration: ServiceWorkerRegistration, timeoutMs = 10000): Promise<void> {
  if (registration.active?.state === 'activated') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const worker = registration.installing ?? registration.waiting ?? registration.active;
    if (!worker) { reject(new Error('Notification worker is unavailable.')); return; }
    const cleanup = () => { clearTimeout(timeout); worker.removeEventListener('statechange', check); };
    const check = () => {
      if (worker.state === 'activated') { cleanup(); resolve(); }
      else if (worker.state === 'redundant') { cleanup(); reject(new Error('Notification worker could not start.')); }
    };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Notification setup timed out. Please try again.')); }, timeoutMs);
    worker.addEventListener('statechange', check);
    check();
  });
}