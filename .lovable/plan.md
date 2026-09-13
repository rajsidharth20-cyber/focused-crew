# Calendar agenda for Home and Planner

## Goal
Add a calendar option to both Home and Planner. Selecting any date opens a clear day view containing that date’s objectives, commitments, and events, including recurring items.

## User experience
- Add a calendar button to the Home header and Planner header.
- Open a mobile-friendly calendar panel using the existing app calendar style.
- Default to the user’s effective “today,” respecting their chosen day-start hour.
- When a date is selected, show the full date followed by:
  - objectives for that day, with subject, priority, duration, completion, and recurring status;
  - a time-ordered agenda combining commitments, events, and objective deadlines;
  - clear empty states when nothing is planned.
- Include a quick “Today” action and previous/next-day navigation.
- Keep this historical/future date view read-only; today’s normal Home and Planner controls remain unchanged.

## Data behavior
- Load the selected date on demand so opening the app stays fast.
- Include one-off records assigned to the selected date.
- Resolve recurring objectives, commitments, and events against the selected weekday.
- Respect skipped recurring objective occurrences so a task cancelled for one day stays hidden on that day.
- Deduplicate recurring objective instances and templates.
- Support guest data from local storage and signed-in data from the backend.
- Cache recently viewed dates during the session and show a lightweight loading state while a new date is fetched.

## Technical details
- Create a shared calendar-agenda dialog used by both screens.
- Use the existing Shadcn Calendar with an interactive wrapper inside the dialog.
- Add selected-date helpers rather than changing the global effective-day setting.
- Extend schedule matching and timeline presentation to accept an explicit selected date instead of assuming the current day.
- Include commitment dates in the client model so one-off commitments appear only on their actual day.
- Preserve the existing Home rule: normal objective editing remains in Planner.
- Verify date behavior around local time zones, recurring weekdays, skipped occurrences, mobile layout, and both Home/Planner entry points.
