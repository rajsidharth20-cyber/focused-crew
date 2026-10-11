/** Remove a whole recurring series, leaving unrelated objectives untouched. */
export function withoutRecurringSeries<T extends { id: string; templateId: string | null }>(rows: T[], templateId: string): T[] {
  return rows.filter(row => row.id !== templateId && row.templateId !== templateId);
}

export function appendPlannerNote(notes: string[] = [], text: string, timestamp = new Date().toISOString()): string[] {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 1000) throw new Error('Note must contain 1 to 1000 characters');
  return [...notes, JSON.stringify({ text: trimmed, timestamp })];
}