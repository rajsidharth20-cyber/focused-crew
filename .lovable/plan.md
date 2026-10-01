# Faster planner loading and report exports

## Changes
- Remove the 90-day objective-history query from app startup; initial loading will fetch only today’s objectives, recurring templates, subjects, active weekly targets, commitments, and relevant events.
- Add an explicit lazy history loader to the shared planner store. The Planner history control will request the 90-day history only when opened, while calendar dates continue loading their own day on demand.
- Make the weekly report request history immediately before export so its objective comparisons remain complete without slowing normal navigation.
- Replace broad column selection in the planner’s startup, agenda, and recurring-objective queries with the exact fields each screen uses.
- Load the PDF library dynamically inside both daily and weekly report generation, preserving the existing on-demand screen imports.

## Technical details
- Keep lazy history deduplicated and cached per signed-in session, with loading/error state exposed only where needed.
- Preserve guest behavior using local data, with no extra network work.
- Keep all existing editing, recurring-objective, calendar, statistics, and report behavior unchanged.

## Verification
- Confirm the initial request set contains no past-objective range query and no PDF library chunk.
- Open objective history and a past calendar date, then verify their data appears correctly.
- Export daily and weekly reports and verify both downloads still work.
- Run focused type checks and confirm the preview build is healthy.
