import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;

export interface StoryView {
  story_id: string;
  user_id: string;
  created_at: string;
}

/** Views and likes for a set of stories (Instagram-style story insights). */
export function useStoryEngagement(storyIds: string[]) {
  const { user } = useAuth();
  const key = useMemo(() => storyIds.slice().sort().join(','), [storyIds]);
  const [views, setViews] = useState<Record<string, StoryView[]>>({});
  const [likes, setLikes] = useState<Record<string, StoryView[]>>({});

  const load = useCallback(async () => {
    const ids = key ? key.split(',') : [];
    if (!user || ids.length === 0) {
      setViews({});
      setLikes({});
      return;
    }
    const [{ data: viewRows }, { data: likeRows }] = await Promise.all([
      db.from('story_views').select('story_id, user_id, created_at').in('story_id', ids),
      db.from('story_likes').select('story_id, user_id, created_at').in('story_id', ids),
    ]);
    const group = (rows: StoryView[]) => {
      const map: Record<string, StoryView[]> = {};
      rows.forEach(r => {
        (map[r.story_id] ??= []).push(r);
      });
      return map;
    };
    setViews(group((viewRows ?? []) as StoryView[]));
    setLikes(group((likeRows ?? []) as StoryView[]));
  }, [key, user]);

  useEffect(() => {
    load();
  }, [load]);

  const markViewed = useCallback(
    async (storyId: string) => {
      if (!user) return;
      if ((views[storyId] ?? []).some(v => v.user_id === user.id)) return;
      const optimistic: StoryView = { story_id: storyId, user_id: user.id, created_at: new Date().toISOString() };
      setViews(prev => ({ ...prev, [storyId]: [...(prev[storyId] ?? []), optimistic] }));
      await db
        .from('story_views')
        .upsert({ story_id: storyId, user_id: user.id }, { onConflict: 'story_id,user_id', ignoreDuplicates: true });
    },
    [user, views]
  );

  const toggleLike = useCallback(
    async (storyId: string) => {
      if (!user) return;
      const liked = (likes[storyId] ?? []).some(l => l.user_id === user.id);
      setLikes(prev => {
        const cur = prev[storyId] ?? [];
        return {
          ...prev,
          [storyId]: liked
            ? cur.filter(l => l.user_id !== user.id)
            : [...cur, { story_id: storyId, user_id: user.id, created_at: new Date().toISOString() }],
        };
      });
      if (liked) {
        await db.from('story_likes').delete().eq('story_id', storyId).eq('user_id', user.id);
      } else {
        await db.from('story_likes').insert({ story_id: storyId, user_id: user.id });
      }
    },
    [user, likes]
  );

  return { views, likes, markViewed, toggleLike, reload: load };
}
