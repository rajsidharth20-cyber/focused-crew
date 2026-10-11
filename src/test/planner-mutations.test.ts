import { describe, expect, it } from 'vitest';
import { appendPlannerNote, withoutRecurringSeries } from '@/lib/planner-mutations';

describe('Planner mutations', () => {
  it('completely removes the repeating objective and every occurrence', () => {
    const rows = [
      { id: 'series', templateId: null },
      { id: 'today', templateId: 'series' },
      { id: 'past', templateId: 'series' },
      { id: 'future', templateId: 'series' },
      { id: 'other', templateId: null },
    ];
    expect(withoutRecurringSeries(rows, 'series')).toEqual([{ id: 'other', templateId: null }]);
  });
  it('appends a weekly note without replacing previous notes', () => {
    const previous = [JSON.stringify({ text: 'First note', timestamp: '2026-10-10' })];
    const result = appendPlannerNote(previous, ' New progress ', '2026-10-11');
    expect(result.map(note => JSON.parse(note).text)).toEqual(['First note', 'New progress']);
    expect(previous).toHaveLength(1);
  });
  it('rejects empty and overlong notes', () => {
    expect(() => appendPlannerNote([], ' ')).toThrow();
    expect(() => appendPlannerNote([], 'x'.repeat(1001))).toThrow();
  });
});