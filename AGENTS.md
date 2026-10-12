# Architecture rules
- Enforce reporting thresholds and messaging restrictions transactionally at the database boundary, because client-only safeguards can be bypassed and concurrent reports must count reliably.
- Share one user-events Realtime channel per signed-in browser session, because mounting multiple social hooks must not multiply subscriptions.
- Keep study presence ephemeral on group and friend-scoped channels, because a study timer should not write heartbeat rows to the database.
- Share study Presence channels between publishers and readers with pre-registered handlers and reference-counted cleanup, because opening a timer must not add handlers to an already-subscribed channel or remove another consumer's connection.
- Load historical planner objectives only on demand from history or exports, because boot should transfer today's plan rather than 90 days of history.
- Import PDF rendering libraries inside export actions, because ordinary navigation should not load report dependencies.
- Send group messages only through the authenticated FocusBot handler, because direct client inserts would bypass server-side text and image moderation.
- Delete recurring series and append weekly notes through owner-scoped database functions, because deletion must be atomic and simultaneous notes must not overwrite one another; guest mutations use equivalent local helpers.