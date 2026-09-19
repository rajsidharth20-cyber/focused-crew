/* Firebase Cloud Messaging service worker (background + closed-app notifications). */
/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A closed web app starts this worker only when a push arrives. Firebase must
// therefore be initialised synchronously during worker startup; an async config
// fetch can finish after the first push event has already been missed.
const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: params.get("apiKey") || "",
  projectId: params.get("projectId") || "",
  messagingSenderId: params.get("messagingSenderId") || "",
  appId: params.get("appId") || "",
};

if (Object.values(firebaseConfig).every(Boolean)) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const d = payload.data || {};
    const title = d.title || "Focused Crew";
    return self.registration.showNotification(title, {
      body: d.body || "",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: d.tag || d.category || "focused-crew",
      renotify: false,
      data: { url: d.url || "/" },
    });
  });
} else {
  console.error("[fcm-sw] missing Firebase web configuration");
}

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
