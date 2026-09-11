# Automatic full-screen Study timer

## What will change
- Starting either Pomodoro or Stopwatch will automatically open the immersive full-screen Study view after the delay question is completed.
- Keep the timer, pause/resume, finish, current topic/subject, and live-study panel available in full screen.
- Add a compact theme selector inside full-screen Study so users can switch among all existing Focused Crew themes without leaving the timer.
- Keep the current Exit control so users can return to the normal Study screen while the timer continues.
- Restore an already-running timer directly into full screen when Study is reopened or refreshed.

## Technical details
- Drive full-screen entry from the timer running state for both timer modes, rather than limiting it to Pomodoro.
- Reuse the existing theme system and saved profile/local preference; no new themes or backend changes.
- Preserve delay prompts, saved timer state, session completion, and reduced-motion behavior.
- Verify start, refresh/restore, theme switching, pause/resume, finish, and exit on the mobile preview.
