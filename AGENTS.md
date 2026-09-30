# Architecture rules
- Share one user-events Realtime channel per signed-in browser session, because mounting multiple social hooks must not multiply subscriptions.
- Keep study presence ephemeral on group and friend-scoped channels, because a study timer should not write heartbeat rows to the database.