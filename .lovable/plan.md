# FocusBot: native study-group AI bot

## Goal
Add **🤖 FocusBot — Your AI study-group assistant** to the existing Focused Crew groups and chats without replacing the current messaging, profiles, notifications, authentication, or realtime behavior.

FocusBot will be off by default. Only a group owner/admin can enable it, and every member will see when it can analyze group messages.

## What users will get

### In study groups
- A **Group Settings → Bots → FocusBot** area using the current Focused Crew styling.
- An explicit enable confirmation explaining message access.
- Independent capability switches for spam detection, AI moderation, study assistance, summaries, focus sessions, productivity reminders, and polls.
- Conservative defaults: commands, mentions, summaries, and rule-based spam checks enabled; automatic moderation actions disabled.
- An always-visible active-bot notice in chat plus a privacy explanation.
- FocusBot messages in the existing group chat with its bot avatar, verified bot label, reply support, timestamps, pinning, deletion by admins, and realtime delivery.

### Commands and mentions
- `/help` — command list.
- `/summary` — concise summary of a bounded recent group-message window only.
- `/focus` — starts a 25-minute group focus session and visible countdown/status.
- `/rules` — shows admin-editable group rules.
- `/poll` — guided question/options flow followed by an in-chat poll with one vote per member.
- `/stopbot` — disables FocusBot for owners/admins only.
- `@FocusBot …` — concise study help only when explicitly mentioned.
- Unsupported or unauthorized commands return a clear, safe response.

### Moderation
- Rule checks run first for repetition, links/promotions, message bursts, and obvious spam patterns.
- AI is called only when a rule result is ambiguous or semantic review is needed.
- Results use `SAFE`, `POTENTIALLY_PROBLEMATIC`, and `HIGH_CONFIDENCE_VIOLATION` with a stored reason and confidence.
- The moderation panel shows flagged messages and supports Review, Dismiss, Delete, and Mute.
- Optional automatic delete/temporary mute controls are available but remain off until an admin explicitly enables them.
- Important flags notify only group owners/admins.

### Private FocusBot chat
- One ongoing FocusBot conversation per signed-in user, saved in Lovable Cloud and available across devices.
- It is user-initiated and never monitors normal private conversations.
- The chat uses the existing social/chat navigation and server-side AI processing.

## Existing architecture reused
- Keep human and FocusBot group messages in `group_messages`, so current realtime delivery, replies, pins, hiding, and chat loading continue to work.
- Extend the existing private `messages` architecture for the single user↔FocusBot conversation rather than introducing another messaging product.
- Keep existing `study_groups`, `group_members`, `profiles`, push registrations, and notification history.
- Do not create a fake auth user or human profile for FocusBot. Bot identity is explicit metadata rendered as a system bot.
- Continue using the existing group owner/admin checks and server-side rate-limit infrastructure.

## Database changes
Add only bot-specific state and extend the existing message tables:

- `group_messages`: bot-author metadata and moderation state, with constraints preventing client-created bot messages.
- `messages`: bot-conversation metadata so one cloud-saved private FocusBot conversation can use the existing DM table and realtime flow.
- `bot_instances`: one FocusBot configuration per group, disabled until an admin enables it.
- `bot_permissions`: independently configurable capabilities.
- `bot_settings`: moderation level, response mode, language, rules, auto-action settings, and rate limits.
- `bot_events`: deduplicated processing/audit events with safe result metadata.
- `bot_flags`: moderation review state, confidence, reason, reviewer, and action.
- `bot_focus_sessions`: temporary 25-minute group sessions.
- `bot_polls`, `bot_poll_options`, `bot_poll_votes`: guided polls with one vote per member.
- `bot_direct_state`: the single private FocusBot conversation state per user.
- `group_member_restrictions`: time-limited bot/admin mutes enforced when sending group messages.

Every new public table will receive explicit grants, RLS, indexes, ownership checks, and service-role access in the same migration. Existing tables and rows remain intact.

## Server-side processing
Create one cohesive Edge Function, `focusbot`, with internal actions for settings, commands, mentions, summaries, moderation, private chat, polls, and review actions. Shared helpers keep authorization and response formatting consistent.

Message flow:

```text
Human message saves immediately in the existing table
        |
Database trigger creates one deduplicated bot event
        |
Server-side FocusBot handler validates group, membership, and enabled permissions
        |
Cheap command / mention / spam rules run first
        |
AI only runs when semantic work is required
        |
Bot reply or admin flag is written to existing realtime chat
```

The trigger-driven handler is asynchronous: chat never waits for AI. Each event is claimed once, retries only transient failures with bounded backoff, and records a safe failure without breaking messaging.

## AI and cost controls
- Use Lovable AI server-side only; no AI or privileged keys reach the browser.
- Use the required `openai/gpt-6-astra` model only after deterministic rules decide AI is necessary.
- Send bounded context: recent relevant messages only, with strict character/message caps; never entire group history.
- Strip unnecessary profile data and send only display-safe message text and timestamps.
- Cache/deduplicate summaries for the same message window.
- Default limits: 5 bot requests per user per minute and 20 AI requests per group per minute, configurable downward/upward within safe server bounds.
- Only `429` and transient server failures retry; credit, permission, and provider failures stop cleanly and surface a safe temporary-unavailable response.

## Security and privacy
- Bot-generated rows can be inserted only by server-side code; authenticated clients cannot set bot-author fields.
- All server actions revalidate the signed-in user, group membership, admin role, bot status, permission status, and target ownership.
- Members can read bot settings/events only for groups they belong to; detailed moderation logs are admin-only.
- Normal members cannot enable/disable the bot, change permissions, edit rules, review flags, mute users, or use `/stopbot`.
- Database constraints and policies prevent cross-group reads and forged bot identities.
- Bot activation and permission changes are audited.
- Bot notices accurately state that enabled group messages may be analyzed.
- Private DMs are never scanned; only the dedicated user-initiated FocusBot conversation is processed.

## Notifications
- Add a bot-moderation notification category and preference.
- Server-side notification delivery targets verified group owners/admins only and links directly to the flagged message review.
- No group-wide moderation alerts and no sensitive message body in lock-screen notifications.

## UI integration
- Add a settings entry from the existing group page; do not redesign unrelated screens.
- Add compact FocusBot identity, BOT badge, active notice, command suggestions, polls, focus-session status, and moderation views within current components and design tokens.
- Add the FocusBot conversation to the existing chat list/navigation.
- Use AI Elements for the dedicated private bot transcript/composer while preserving the established group-chat appearance.
- Verify phone-size and desktop layouts, keyboard/focus behavior, loading, disabled, empty, and error states.

## Verification
- Typecheck and production build.
- RLS and unauthorized-request tests for all bot tables/actions.
- Admin/member enable, disable, permission, rules, moderation, mute, and review tests.
- `/help`, `/summary`, `/focus`, `/rules`, guided `/poll`, `/stopbot`, and `@FocusBot` tests.
- Disabled-bot, non-member, user-leaves, multi-group, duplicate-event, simultaneous-message, rate-limit, AI-failure, and realtime regression tests.
- Private FocusBot persistence and isolation tests.
- Mobile visual checks for settings, chat bot messages, polls, focus status, and moderation.
- Confirm existing human group chats, DMs, profiles, avatars, notifications, image uploads, replies, pins, delete-for-me/all, and realtime remain functional.

## Delivery notes
The first version includes all requested commands, guided polls, review-first moderation, optional explicit auto-actions, one cloud-saved private bot chat, privacy notices, rate limits, and audit records. Automatic actions will be constrained to deletion and temporary group-chat mute; they will not alter account-level access or global roles.
