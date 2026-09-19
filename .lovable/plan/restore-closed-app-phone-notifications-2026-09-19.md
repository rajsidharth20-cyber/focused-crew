# Restore closed-app phone notifications

## Goal
Make phone notifications arrive after the Focused Crew web app is closed, while preserving existing preferences and foreground alerts.

## Plan
1. Verify device-token registration, Firebase worker initialization, and background message delivery.
2. Correct the background delivery path so the messaging worker can initialize independently of the open app.
3. Keep notification taps opening the intended Focused Crew screen.
4. Validate configuration, type safety, and the relevant delivery endpoint.

## Technical details
- Keep the Firebase messaging worker separate from the offline app worker.
- Do not expose private credentials; only Firebase's publishable browser configuration remains available to the worker.
- Preserve per-category notification settings and token ownership checks.
