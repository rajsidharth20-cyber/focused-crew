import { describe, expect, it } from 'vitest';
import { directMessageTitle } from '../../supabase/functions/_shared/direct-message-title';

describe('personal message sender title', () => {
  it('shows the sender’s full name', () => {
    expect(directMessageTitle({ full_name: 'Sidharth raj', username: 'sid' })).toBe('Sidharth raj');
  });
  it('uses the username when the full name is missing', () => {
    expect(directMessageTitle({ full_name: ' ', username: 'sid' })).toBe('sid');
  });
  it('keeps a safe fallback for missing profiles', () => {
    expect(directMessageTitle(null)).toBe('New message');
  });
});