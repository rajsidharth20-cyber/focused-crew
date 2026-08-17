# Focused Crew — 5 updates

## 1. Stop objectives repeating 2–3× a day
Recurring objectives are copied into "today" by whichever screen loads the planner first. Several screens load it at once, so the same copy gets created two or three times.

Fix:
- Add a database rule so only one copy per template per day can exist (unique on user + template + date), and make the copy step ignore duplicates instead of creating new rows.
- Add an in-memory guard so a second load in the same browser tab can't fire the copy step while the first is still running.
- Clean up existing duplicate rows already in the database (keeps the oldest of each set).

## 2. User-chosen "new day" time
Today the day flips at a fixed 3:00 AM.

- Add a `day_start_hour` setting on the user profile (0–11, default 3).
- Replace the hard-coded 3 in the day-boundary helper with a reactive hook that reads this setting (falls back to 3 for guests, stored locally).
- Add a "New day starts at" picker in Settings.
- Everything that keys off "today" (objectives, notes, streak, stats) follows the new hour automatically.

## 3. Profile redesign (Instagram + YPT)
New `/profile` screen for yourself and reworked `/u/:userId` for others:

- Header: avatar, name, @username, bio, edit/message button.
- Stat row: Posts · Followers · Following (tappable lists).
- Study stats block: total hours, this week, current streak, top subjects (YPT-style bars).
- Grid of the user's posts.
- Private account toggle: when on, only accepted followers see posts, stories and study stats; others see a locked state and a "Requested" button.

Backend:
- New `follows` table (follower, following, status pending/accepted) with access rules; auto-accept when the target is public, pending when private.
- `is_private` flag on profiles.
- Access rules on posts/stories/study data updated to allow accepted followers (existing friend access stays).

## 4. Home screen = objectives only
- Home keeps the greeting/streak header, the running-timer pill, and today's objective list as a read-only checklist (tap to complete, tap to add progress notes).
- Remove the add/edit/delete controls and subject board from Home; Home shows an "Open planner" link when empty.
- Planner page gains the full objectives editor (add, edit, delete, recurring, deadlines, priorities) alongside the existing timeline, commitments and events.

## 5. Images in Copilot
- Attach button in the Copilot composer (camera/gallery, image files only, size-checked).
- Preview thumbnail before sending; image goes to the model as an inline attachment.
- Edge function passes image parts through to the Gemini vision-capable model so it can read timetables, notes or screenshots and act on them with the existing tools.

## Naming
Replace remaining "Task Pilot" strings with **Focused Crew** (page title, meta description, manifest, share text, PDF headers).

## Technical notes
- Migrations: unique index + duplicate cleanup on `daily_objectives`, `profiles.day_start_hour`, `profiles.is_private`, new `follows` table with GRANTs + RLS, follower-aware policies on `posts`/`stories`.
- New: `src/hooks/use-day-start.ts`, `src/pages/Profile.tsx`, `src/hooks/use-follows.ts`, objectives editor moved into `src/pages/Planner.tsx`.
- Copilot: multipart message payload in `supabase/functions/ai-copilot/index.ts`, upload to the existing private `social` bucket.
