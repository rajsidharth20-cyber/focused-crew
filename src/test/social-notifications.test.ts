import { describe, expect, it } from 'vitest';
import { socialNotificationAllowed, socialNotificationKey, resolveSocialNotification } from '../../supabase/functions/_shared/social-notifications';

describe('social notifications', () => {
  it('honors global and separate social opt-outs', () => {
    expect(socialNotificationAllowed({ push_enabled: false, new_posts: true }, 'new_posts')).toBe(false);
    expect(socialNotificationAllowed({ push_enabled: true, story_likes: false }, 'story_likes')).toBe(false);
    expect(socialNotificationAllowed({ push_enabled: true, new_posts: true }, 'new_posts')).toBe(true);
  });
  it('uses stable keys so unlike/re-like cannot duplicate a story alert', () => {
    expect(socialNotificationKey('story_likes', 'story1', 'liker1')).toBe('story_likes:story1:liker1');
    expect(socialNotificationKey('story_likes', 'story1', 'liker2')).not.toBe(socialNotificationKey('story_likes', 'story1', 'liker1'));
  });
  it('rejects notifying about another author’s post or liking your own story', async () => {
    const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: 'owner', created_at: new Date().toISOString() } }) }) }) }) };
    expect(await resolveSocialNotification(db, 'stranger', 'new_posts', 'post1')).toBeNull();
    expect(await resolveSocialNotification(db, 'owner', 'story_likes', 'story1')).toBeNull();
  });
  it('notifies only the story owner after a saved like, never a blocked owner', async () => {
    function database(blocked: boolean, saved: boolean) {
      return { from: (table: string) => {
        const data = table === 'stories' ? { user_id: 'owner', created_at: new Date().toISOString() } : table === 'profiles' ? { full_name: 'Liker' } : saved ? { story_id: 'story1' } : null;
        const chain: any = { eq: () => chain, maybeSingle: async () => ({ data }), or: async () => ({ data: blocked ? [{ id: 'block' }] : [] }) };
        return { select: () => chain };
      } };
    }
    const result = await resolveSocialNotification(database(false, true), 'liker', 'story_likes', 'story1');
    expect(result?.recipients).toEqual(['owner']);
    expect(result?.body).toBe('Liked your story');
    expect(await resolveSocialNotification(database(true, true), 'liker', 'story_likes', 'story1')).toBeNull();
    expect(await resolveSocialNotification(database(false, false), 'liker', 'story_likes', 'story1')).toBeNull();
  });
});