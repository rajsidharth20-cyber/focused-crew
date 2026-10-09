import { describe, expect, it } from 'vitest';
import { clearTargetedAbuse, parseModeration } from '../../supabase/functions/focusbot/moderation';

describe('FocusBot moderation', () => {
  it('detects an explicit personal threat even inside a command', () => {
    expect(clearTargetedAbuse('/help I will kill you')).toBe(true);
  });
  it('does not treat an ordinary academic keyword as targeted abuse', () => {
    expect(clearTargetedAbuse('What does the word moron mean in this quotation?')).toBe(false);
  });
  it('keeps uncertain classifications below the automatic removal threshold', () => {
    expect(parseModeration('POTENTIALLY_PROBLEMATIC ambiguous insult').confidence).toBeLessThan(0.9);
  });
});