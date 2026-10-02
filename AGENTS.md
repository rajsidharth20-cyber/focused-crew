# Architecture rules
- Share one user-events Realtime channel per signed-in browser session, because mounting multiple social hooks must not multiply subscriptions.
- Keep study presence ephemeral on group and friend-scoped channels, because a study timer should not write heartbeat rows to the database.
- Load historical planner objectives only on demand from history or exports, because boot should transfer today's plan rather than 90 days of history.
- Import PDF rendering libraries inside export actions, because ordinary navigation should not load report dependencies.