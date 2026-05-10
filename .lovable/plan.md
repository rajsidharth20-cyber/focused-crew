## Goal
Send real push notifications for upcoming events and scheduled stops that arrive even when the tab is closed or the browser is in the background — on desktop and on installed PWA (Android). iOS requires the app to be installed to the home screen (Apple's restriction).

## How it will work
1. User clicks "Enable Notifications" → browser asks permission → we subscribe them to the Push service using a VAPID public key.
2. Subscription is saved to the database, tied to the user.
3. A scheduled backend job runs every minute, finds events/stops starting in 30m, 15m, or now, and sends Web Push messages to that user's devices.
4. The service worker receives the push (even with browser closed) and shows a system notification.

## Pieces to build

### Backend (Lovable Cloud)
- Table `push_subscriptions` (user_id, endpoint, p256dh, auth, created_at) with RLS so users only manage their own.
- Table column `notified_thresholds` on `events` (and equivalent for scheduled stops if separate) to avoid duplicate sends.
- Edge function `send-event-reminders` — runs each minute via pg_cron + pg_net, queries events within the next 30 min, sends Web Push using the `web-push` library, marks thresholds as sent.
- Edge function `save-push-subscription` — stores subscription from the client.
- Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto). I will generate these and ask you to paste them into the secrets prompt.

### Frontend
- Custom service worker (`public/sw-push.js` injected into the existing PWA SW via `injectManifest` mode) that handles `push` and `notificationclick`.
- Switch `vite-plugin-pwa` to `injectManifest` strategy so we can add custom push handlers while keeping precaching.
- New hook `usePushNotifications` — requests permission, subscribes, posts subscription to backend.
- "Enable Notifications" button in Settings (or a banner on the dashboard).
- Keep the existing in-app `useEventReminders` toast hook for foreground reminders.

### Verification
- After deploy: enable notifications in the preview, create an event a couple minutes out, close the tab, confirm the OS notification appears.
- Edge function logs checked for delivery status.

## Technical notes (for reference)
```text
client → subscribe(VAPID public) → /functions/save-push-subscription → DB
pg_cron (every 1 min) → /functions/send-event-reminders → web-push → FCM/APNs/Mozilla → SW push event → showNotification
```
- iOS Safari only delivers Web Push to apps added to the Home Screen (iOS 16.4+).
- Chrome/Edge/Firefox on desktop and Android work without install.
- A user must grant permission once; we'll show a clear prompt.

## What I need from you
1. Approve this plan.
2. After I generate VAPID keys, paste them into the secret prompts I'll show.