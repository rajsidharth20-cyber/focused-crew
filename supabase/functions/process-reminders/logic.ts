// Pure reminder rules (no I/O) so they can be unit-tested with Deno.
// Rules mirror the former in-app hooks:
//  - events & commitments: 30 min before, 15 min before, at start
//  - study reminder: from 4 PM local, < 15 min studied and open objectives
//  - streak reminder: from 8 PM local, < 30 min studied
//  - goal completion: every objective of the planner day completed

export const FALLBACK_TZ = "Asia/Kolkata";
/** A start reminder older than this is dropped instead of sent late. */
export const START_GRACE_MIN = 10;

export function validTz(tz: string | null | undefined): string {
  if (!tz) return FALLBACK_TZ;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return FALLBACK_TZ; }
}

export type LocalParts = { y: number; m: number; d: number; hh: number; mm: number; dow: number; date: string };

const fmtCache = new Map<string, Intl.DateTimeFormat>();
export function localParts(instant: Date, tz: string): LocalParts {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(instant)) p[x.type] = x.value;
  const y = +p.year, m = +p.month, d = +p.day;
  return {
    y, m, d, hh: +p.hour % 24, mm: +p.minute,
    dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    date: `${p.year}-${p.month}-${p.day}`,
  };
}

function offsetMs(instant: number, tz: string) {
  const p = localParts(new Date(instant), tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, new Date(instant).getUTCSeconds());
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Converts a local wall-clock date + time in `tz` to a UTC instant (DST-safe). */
export function zonedToUtc(date: string, time: string, tz: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!dm || !tm) return null;
  const hh = +tm[1], mm = +tm[2];
  if (hh > 23 || mm > 59) return null;
  const guess = Date.UTC(+dm[1], +dm[2] - 1, +dm[3], hh, mm);
  let t = guess - offsetMs(guess, tz);
  t = guess - offsetMs(t, tz);
  const result = new Date(t);
  const actual = localParts(result, tz);
  // A nonexistent wall time during a DST jump must not fire at another hour.
  if (actual.date !== date || actual.hh !== hh || actual.mm !== mm) return null;
  return result;
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function dowOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Planner day for `now`, honouring the user's day-start hour (default 3 AM). */
export function plannerDay(now: Date, tz: string, dayStartHour: number) {
  const p = localParts(now, tz);
  const h = Number.isInteger(dayStartHour) && dayStartHour >= 0 && dayStartHour <= 11 ? dayStartHour : 3;
  const day = p.hh < h ? addDays(p.date, -1) : p.date;
  const hs = `${String(h).padStart(2, "0")}:00`;
  const start = zonedToUtc(day, hs, tz) ?? new Date(`${day}T00:00:00Z`);
  const end = zonedToUtc(addDays(day, 1), hs, tz) ?? new Date(start.getTime() + 86400000);
  return { day, start, end, localHour: p.hh };
}

export type Stage = "30" | "15" | "now";
export function dueStage(startAt: Date, now: Date): Stage | null {
  const diff = (startAt.getTime() - now.getTime()) / 60000;
  if (diff <= 30 && diff > 15) return "30";
  if (diff <= 15 && diff > 0) return "15";
  if (diff <= 0 && diff > -START_GRACE_MIN) return "now";
  return null;
}

export type ScheduledItem = {
  id: string; title: string; start_time: string | null;
  date: string | null; recurring_days: number[] | null;
};

export type Reminder = {
  user_id: string; category: string; title: string; body: string; url: string;
  dedupe_key: string; ttlSeconds: number;
};

export function scheduleReminders(
  userId: string, kind: "event" | "schedule", items: ScheduledItem[], now: Date, tz: string,
): Reminder[] {
  const today = localParts(now, tz).date;
  const out: Reminder[] = [];
  for (const it of items) {
    if (!it.start_time || !it.title) continue;
    // Check yesterday/today/tomorrow so reminders near local midnight still fire.
    for (const date of [addDays(today, -1), today, addDays(today, 1)]) {
      const rec = Array.isArray(it.recurring_days) && it.recurring_days.length > 0 ? it.recurring_days : null;
      const matches = rec ? rec.includes(dowOf(date)) : it.date === date;
      if (!matches) continue;
      const startAt = zonedToUtc(date, it.start_time, tz);
      if (!startAt) continue;
      const stage = dueStage(startAt, now);
      if (!stage) continue;
      const title = it.title.slice(0, 80);
      const body = stage === "now"
        ? `🚨 "${title}" is starting now!`
        : `⏰ "${title}" starts in ${stage} minutes`;
      const category = kind === "event" ? "event_reminders" : "schedule_reminders";
      const hhmm = it.start_time.slice(0, 5).replace(":", "");
      out.push({
        user_id: userId, category,
        title: kind === "event" ? "Event reminder" : "Schedule reminder",
        body, url: kind === "event" ? "/planner" : "/",
        // Time is part of the key so editing an event's time re-arms its reminders.
        dedupe_key: `${userId}:${category}:${kind}-${it.id}-${date}-${hhmm}-${stage}`,
        ttlSeconds: Math.max(60, (startAt.getTime() - now.getTime()) / 1000 + START_GRACE_MIN * 60),
      });
    }
  }
  return out;
}

export type DailyInput = {
  userId: string; now: Date; tz: string; dayStartHour: number;
  studiedSeconds: number; totalObjectives: number; openObjectives: number;
};

export function dailyReminders(i: DailyInput, day: string, localHour: number): Reminder[] {
  const out: Reminder[] = [];
  const minutes = Math.round(i.studiedSeconds / 60);
  // Reminders expire at the end of the planner day.
  const endTtl = Math.max(1, Math.min(3 * 3600, Math.floor((plannerDay(i.now, i.tz, i.dayStartHour).end.getTime() - i.now.getTime()) / 1000)));
  if (i.totalObjectives > 0 && i.openObjectives === 0) {
    out.push({
      user_id: i.userId, category: "goal_completion", title: "All objectives cleared ✈️",
      body: `You completed all ${i.totalObjectives} objectives today. Nice flying.`, url: "/",
      dedupe_key: `${i.userId}:goal_completion:goals-${day}`, ttlSeconds: endTtl,
    });
  }
  if (localHour >= 16 && minutes < 15 && i.openObjectives > 0) {
    out.push({
      user_id: i.userId, category: "study_reminders", title: "Time to get moving",
      body: `${i.openObjectives} objectives are still open today.`, url: "/study",
      dedupe_key: `${i.userId}:study_reminders:study-${day}`, ttlSeconds: endTtl,
    });
  }
  if (localHour >= 20 && minutes < 30) {
    out.push({
      user_id: i.userId, category: "streak_reminders", title: "Your streak is at risk 🔥",
      body: `Only ${minutes} min studied today. A short session keeps it alive.`, url: "/study",
      dedupe_key: `${i.userId}:streak_reminders:streak-${day}`, ttlSeconds: endTtl,
    });
  }
  return out;
}

export type ObjectiveRow = {
  id: string; date: string; completed: boolean; skipped: boolean;
  is_template: boolean; template_id: string | null; recurring_days: number[] | null;
};

/** Counts objectives for a planner day, including recurring templates not yet materialised. */
export function countObjectives(rows: ObjectiveRow[], day: string) {
  const dow = dowOf(day);
  const instances = rows.filter((r) => !r.is_template && r.date === day && !r.skipped);
  const materialised = new Set(rows.filter((r) => !r.is_template && r.date === day).map((r) => r.template_id));
  const pendingTemplates = rows.filter((r) =>
    r.is_template && (r.recurring_days ?? []).includes(dow) && !materialised.has(r.id)
  ).length;
  const total = instances.length + pendingTemplates;
  const open = instances.filter((r) => !r.completed).length + pendingTemplates;
  return { total, open };
}
