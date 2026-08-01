/* Firebase Cloud Messaging service worker (background + closed-app notifications). */
/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const CONFIG_URL = "https://noznnfeuifjqkhnqoooc.supabase.co/functions/v1/push-config";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const ready = (async () => {
  try {
    const res = await fetch(CONFIG_URL);
    const cfg = await res.json();
    if (!cfg?.apiKey) return;
    firebase.initializeApp({
      apiKey: cfg.apiKey,
      projectId: cfg.projectId,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    });
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const d = payload.data || {};
      const title = d.title || "Task Pilot";
      self.registration.showNotification(title, {
        body: d.body || "",
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag: d.tag || d.category || "task-pilot",
        renotify: false,
        data: { url: d.url || "/" },
      });
    });
  } catch (e) {
    console.error("[fcm-sw] init failed", e);
  }
})();

self.addEventListener("push", () => {
  /* keep the worker alive until firebase is initialised */
  ready;
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          client.postMessage({ type: "NOTIFICATION_CLICK", url });
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
