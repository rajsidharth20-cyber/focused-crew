# FocusedCrew hardening roadmap

Remediation order for the audit findings. Nothing here is implemented yet — approve and I'll work down the list, or tell me which items to skip.

## Top 10 fixes, in priority order

### 1. Lock down the open AI endpoints (immediate)
`ai-advisor`, `daily-quote`, `daily-summary` run with `verify_jwt = false` and no user check, so anyone can spend your AI budget. Flip them to `verify_jwt = true`, add an `auth.getUser()` guard, and tighten CORS to the app origin.

### 2. Add rate limiting (immediate)
A `rate_limits` table plus a shared helper used by AI functions, DM sends, posts, comments, friend requests and username suggestions. Per-user, per-action, sliding window.

### 3. Blocking and reporting (immediate)
New `blocks` and `reports` tables with grants and RLS. Blocking must be enforced in the DM insert policy, group message reads, feed visibility and friend requests — not only in the UI.

### 4. Consent-gated DMs
Change the `messages` insert policy so a first message is only allowed to friends, group mates, or as a limited "message request" quota. Today any account can DM any user id without limit.

### 5. Roles and admin moderation, server side
A separate `user_roles` table with an `app_role` enum and a `has_role()` security-definer function. Moderation actions (hide post, restrict user, resolve report) run behind role checks in the database and an edge function — never a client flag.

### 6. Missing indexes
Add indexes on `messages(receiver_id, created_at)`, `subjects(user_id)`, `commitments(user_id)`, `events(user_id)`, `weekly_targets(user_id)`, `user_quotes(user_id)`, `daily_objectives(user_id, date)`, `group_members(user_id)`, `story_views(user_id)`, `post_comments(user_id)`, `group_announcements(group_id)`.

### 7. Fix realtime fan-out
Stop the unfiltered `study_presence` subscription. Scope presence to the user's groups/friends (per-group channels or filtered subscriptions), share one `useLiveStudy` instance through context instead of three, and patch state from payloads rather than reloading. Same treatment for the feed subscription, which currently refetches everything on any post change anywhere.

### 8. Paginate the heavy reads
Cursor pagination for chat (currently 500 rows), group chat (300), and the feed (100 posts plus every like and comment row). Replace comment-row downloads with counts.

### 9. Storage limits and cleanup
Set per-bucket `file_size_limit` and `allowed_mime_types` on `avatars`, `group-images`, `social`. Add a scheduled job to delete expired stories and their objects, and to trim `notification_log`.

### 10. Account deletion and recovery
A user-initiated delete flow (edge function, cascade through user data and storage), plus confirming PITR/backup posture and documenting a storage rollback path.

## Technical notes

- Every new public table gets `GRANT` statements in the same migration as its `CREATE TABLE`, then RLS, then policies.
- Blocking checks belong in `private.*` security-definer helpers so policies stay non-recursive, matching the existing `is_group_member` / `are_friends` pattern.
- Rate limiting is enforced in the database for direct table writes and in edge functions for AI calls; the UI only reflects it.
- Items 1-5 are behaviour and security changes. Items 6-8 are performance only and carry no user-visible change beyond speed.
