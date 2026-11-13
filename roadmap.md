# Social performance
- [x] Share cached friends/groups/feed reads and eliminate loading waterfalls
- [x] Split Social tabs and verify signed-in switching, chat, and live presence regressions

# Startup performance
- [x] Hydrate returning auth and planner snapshots synchronously without blocking revalidation
- [x] Split hidden dialogs, defer push/live subscriptions, and configure query caching
- [x] Persist optimistic objective changes with rollback; verify signed-in and guest startup/timers

# Chat notifications
- [x] Verify recipient preferences and registration; prevent automatic token refresh when push is disabled
- [ ] Verify real device delivery where authorized; recipient accounts without registered devices still require on-device setup
- [x] Fix silent send failures, group reply authorization and delivery tracking
- [x] Verify signed-in private/group send requests and reminder tests; test recipient has no registered device, so physical delivery remains unverified
- [x] Fix preference updates to save one setting without overwriting other saved choices

# Backend reminders
- [x] Recheck automatic scheduling authentication, fair user batches and delivery outcomes (13:15 UTC automatic run verified; 23 tests passed)
- [ ] Verify closed-phone reminder display and save the remaining registered user's timezone (requires that user to open the app; seven accounts have no registered devices)
- [x] Finish secured backend reminder processing and bounded delivery retries
- [x] Activate one five-minute schedule and verify automatic execution
- [x] Remove duplicate signed-in reminder sends; preserve guests and social notifications
- [x] Test timing, preferences, concurrency, delivery failures and worker behavior
- [x] Report phone-only verification limitations

# Study performance
- [x] Scope subject timer ticks to clock displays and progress card
- [x] Load recent sessions on boot; defer full history and preserve all-time streaks
- [x] Verify timer rendering, recent queries, history and totals

# Planner updates
- [x] Add confirmed permanent removal of repeating objectives and all occurrences
- [x] Add saved weekly-target notes in Planner
- [x] Test removal and weekly notes, including signed-in persistence

# Timer blank screen
- [x] Fix shared Presence subscriptions when starting or reopening the timer
- [x] Verify signed-in fresh start and mid-session reopening without runtime errors

# FocusBot roadmap
- [x] Apply transactional reporting, four-reporter restrictions, and global messaging enforcement
- [x] Enable high-confidence automatic moderation without command bypasses
- [x] Verify restriction expiry, report privacy, and moderation actions
- [x] Add secured bot database tables, policies, triggers, and rate limits
- [x] Add server-side FocusBot processing and AI calls
- [x] Add group bot settings, privacy, commands, polls, focus status, and moderation UI
- [x] Add the saved private FocusBot conversation
- [x] Verify private reports never appear in group chat or notify ordinary members
- [x] Verify authorization, build, and key user flows

# Realtime scaling
- [x] Apply Realtime row changes locally for feed, friendships, groups, and member lists
- [x] Share one user-events subscription across user-facing hooks
- [x] Replace study-presence writes and reads with group and friend Realtime Presence
- [x] Pause the safety refresh while hidden
- [ ] Verify live presence with two authenticated users (requires two active users in a shared study group)

# Loading performance
- [x] Defer objective and expired-target history until requested in Planner or weekly report
- [x] Load PDF rendering only when exporting
- [x] Select only displayed planner columns on initial and calendar reads
- [x] Verify boot, history, calendar, and PDF exports
