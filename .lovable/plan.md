## Weekly Study Report PDF

Add a "Weekly Report" button on the Study Timer page that generates and downloads a branded PDF of the last 7 days of study activity.

### Where it lives
- Button in the `/study` page header, next to "Add missed session" — icon: `FileDown`, label "Weekly Report".
- Reuses the existing `jsPDF` dependency (already used by `src/lib/daily-summary-pdf.ts`), so no new packages.

### Report contents (A4, multi-page)
1. **Cover header** — "Task Pilot — Weekly Study Report", user's call sign, date range (last 7 days, Mon–Sun of current week).
2. **Headline stats block** — this week's focused time, daily average this week, longest study day this week, active days / 7.
3. **This week vs last week** — totals, delta, and a small horizontal bar comparison.
4. **This month vs last month** — totals + delta.
5. **Daily breakdown** — bar chart (drawn with jsPDF primitives) of Mon–Sun focus minutes, with the current day highlighted.
6. **Time per study type** — Pomodoro / Stopwatch / Manual totals + percentage bars.
7. **Subject-wise hours** — table sorted by hours (top 10), with a bar for each row.
8. **Tag-wise hours** — same treatment, with each tag's color swatch.
9. **Topic-wise hours** — top 10 topics by minutes.
10. **Planned vs actual (week)** — sum of estimated minutes on this week's objectives vs actual focused time, with a progress bar and a short qualitative note ("Ahead of plan" / "Behind plan" / "On track").
11. **Footer** on every page with page number and generation timestamp.

### Technical details
- New file: `src/lib/weekly-report-pdf.ts` exporting `generateWeeklyReportPDF({ username, sessions, tags, subjects, dailyObjectives, pastObjectives })`.
- All aggregation logic lives in the PDF module (pure functions over `StudySession[]`) so the page component stays lean; mirrors the math already in `src/components/study/StudyStats.tsx` (week/month windows, per-tag, per-subject, per-topic, per-type).
- Week definition: Monday-start, matching `StudyStats`.
- Charts drawn with `doc.rect` / `doc.setFillColor` / `doc.text` — no chart library.
- Uses the same navy/blue palette as `daily-summary-pdf.ts` for visual consistency.
- Edit `src/pages/StudyTimer.tsx`: import the new generator, add a `downloadingReport` state, add the button with a spinner + `toast.loading` / `toast.success` / `toast.error` (matches the existing Summary PDF pattern in `src/pages/Index.tsx`).
- Guests: works from local session data with no backend calls.
- Empty state: if there are zero sessions in the last 7 days, still generate the PDF but include a "No sessions logged this week" note in the stats section so the download never fails silently.

### Files touched
- `src/lib/weekly-report-pdf.ts` (new)
- `src/pages/StudyTimer.tsx` (add button + handler)