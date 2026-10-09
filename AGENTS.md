# Architecture rules
- Enforce reporting thresholds and messaging restrictions transactionally at the database boundary, because client-only safeguards can be bypassed and concurrent reports must count reliably.
- Share one user-events Realtime channel per signed-in browser session, because mounting multiple social hooks must not multiply subscriptions.
- Keep study presence ephemeral on group and friend-scoped channels, because a study timer should not write heartbeat rows to the database.
- Load historical planner objectives only on demand from history or exports, because boot should transfer today's plan rather than 90 days of history.
- Import PDF rendering libraries inside export actions, because ordinary navigation should not load report dependencies.
- Send group messages only through the authenticated FocusBot handler, because direct client inserts would bypass server-side text and image moderation.