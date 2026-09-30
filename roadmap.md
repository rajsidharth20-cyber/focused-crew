# FocusBot roadmap
- [x] Add secured bot database tables, policies, triggers, and rate limits
- [x] Add server-side FocusBot processing and AI calls
- [x] Add group bot settings, privacy, commands, polls, focus status, and moderation UI
- [x] Add the saved private FocusBot conversation
- [ ] Verify private reports never appear in group chat or notify ordinary members
- [ ] Verify authorization, typecheck, build, and key user flows

# Realtime scaling
- [x] Apply Realtime row changes locally for feed, friendships, groups, and member lists
- [x] Share one user-events subscription across user-facing hooks
- [x] Replace study-presence writes and reads with group and friend Realtime Presence
- [x] Pause the safety refresh while hidden
- [ ] Verify live presence with two authenticated users (requires two active users in a shared study group)
