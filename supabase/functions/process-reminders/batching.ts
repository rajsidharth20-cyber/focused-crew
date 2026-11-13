/** A partial final page must resume at its cursor, not restart from user one. */
export function exhaustedReminderUsers(pageSize: number, processedCount: number): boolean {
  return pageSize < 100 && processedCount === pageSize;
}