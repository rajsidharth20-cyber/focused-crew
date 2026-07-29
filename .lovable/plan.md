## Task Pilot — Premium Mobile Redesign

You've given a very complete brief (soft white + lavender, rounded 18–22px cards, Material 3, Inter/SF Pro, 5-tab nav with center FAB, timeline planner, expandable analytics, floating AI card). I'll treat that as locked design direction and skip the "pick a palette" round — we go straight to implementation.

Because this touches almost every screen, I'll ship it in **four sequential phases** so the app stays usable between steps and you can course-correct early.

---

### Phase 1 — Foundation (design system + shell)
Locks the look everything else inherits.

- New **"Cirrus" premium theme** in `index.css` (set as default): soft white `#FAFAFB` background, lavender primary `#7C6FE8`, ink `#1A1B26`, muted violet accents, minimal shadows, 20px radius. Flight/War/old-Premium themes kept but demoted to Settings.
- Switch primary font to **Inter** (SF Pro as system fallback). Retire JetBrains Mono from body copy.
- New utility classes: `.m3-card` (compact, low-shadow), `.m3-chip`, `.m3-fab`, `.hero-ring`.
- New app shell in `Index.tsx`:
  - Slim sticky top bar (greeting + clock + avatar).
  - **Hero section**: greeting, current/next task, big progress ring, "Start Focus" CTA.
  - **5-tab bottom nav** (Home · Focus · Planner · Analytics · Profile) with a **center FAB "+ Add Task"** that opens a quick-add sheet.
- Reduce card padding globally by ~25%, tighten typography scale.

### Phase 2 — Home + Planner
Where most daily use happens.

- **Home** reorganized into: Hero → Today's Plan (timeline strip of next 3 items with priority chips) → Quick Stats grid (Today study · Weekly hrs · Streak · Longest session) → Floating AI card (next recommendation + one-tap advice + daily review).
- Old scattered cards (Protocols, Notes, Quotes, Weekly Targets, Subjects) move into collapsible sections or the Planner tab.
- New **Planner tab**: Google-Calendar-style vertical timeline for today, colored blocks for commitments/events/objectives, tap to edit. Week strip on top, swipe between days. (Drag-and-drop reschedule ships in Phase 4 if you want it — it's a bigger lift.)
- Quick-add FAB sheet: one form that can create Task / Event / Commitment based on a segmented control.

### Phase 3 — Focus (Timer) + Analytics
Making the timer flagship-worthy and analytics premium.

- **Focus tab** redesigned around a large circular timer: subject · topic · tag shown as chips beneath, Pomodoro/Stopwatch toggle, pause, skip-break, ambient-sound selector, inline session notes. Delay prompt kept but styled as a bottom sheet.
- **Analytics tab** with expandable cards + real charts (using existing `recharts`):
  - Weekly trend (line), Month vs last month (bar), Subject distribution (donut), Study consistency (heatmap), Time-of-day (bar), Focus/Punctuality/Productivity scores as ring gauges.
  - Advanced sections hidden until enough data exists (empty-state illustration + CTA).
- Progress bars across app replaced with mini rings / sparklines where meaningful.

### Phase 4 — Polish
- Empty-state illustrations (lightweight SVG pilot/paper-plane motifs) for Planner, Analytics, Focus history.
- Micro-interactions: ripple on tap, spring animations on sheet open, swipe-to-complete on task rows, haptic feedback via `navigator.vibrate` on mobile.
- Accessibility pass: contrast, focus rings, tap targets ≥44px, safe-area on all screens.
- Optional: drag-to-reschedule on the Planner timeline.

---

### Technical notes
- No database changes needed — all existing tables (`daily_objectives`, `events`, `commitments`, `study_sessions`, etc.) map cleanly onto the new UI.
- New files: `src/components/shell/BottomNav.tsx`, `src/components/shell/QuickAddSheet.tsx`, `src/components/home/HeroSection.tsx`, `src/components/home/QuickStats.tsx`, `src/components/home/AIFloatingCard.tsx`, `src/pages/Planner.tsx`, `src/pages/Analytics.tsx`, `src/components/planner/DayTimeline.tsx`, `src/components/analytics/*` (charts), `src/components/empty/*` (illustrations).
- Existing components (`DailyObjectives`, `UpcomingEvents`, `Commitments`, `StudyStats`, `PomodoroTimer`, `StopwatchTimer`) are refactored, not rewritten — their store hooks stay untouched so no data loss risk.
- Routes updated: `/` → Home, `/focus` → Timer (replaces `/study`), `/planner`, `/analytics`, `/profile`. Old `/study` redirects.

### What I need from you before starting
1. **Approve the four-phase plan**, or tell me to compress it into fewer/more phases.
2. **Confirm the theme swap**: new "Cirrus" light theme becomes the default; Flight/War remain available in Settings. OK?
3. **Drag-and-drop on Planner** — include in Phase 4, or skip?

Once you approve, I'll start Phase 1 immediately.