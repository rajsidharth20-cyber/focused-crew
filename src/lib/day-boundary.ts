/**
 * Returns "today's" date string (YYYY-MM-DD), where the day boundary is 3:00 AM.
 * Before 3 AM, we still consider it the previous day.
 */
export function getEffectiveToday(): string {
  const now = new Date();
  if (now.getHours() < 3) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
}
