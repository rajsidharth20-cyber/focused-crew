import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { onUserEvent } from '@/lib/user-events';
import { useAuth } from '@/hooks/useAuth';
import type { SocialProfile } from '@/hooks/use-friends';
import { useSocialResource } from '@/hooks/use-social-resource';
import type { SetStateAction } from 'react';

const db = supabase as any;

export interface Post {
  id: string;
  user_id: string;
  kind: 'photo' | 'text' | 'analysis';
  caption: string | null;
  image_url: string | null;
  created_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  image_url: string | null;
  caption: string | null;
  background: string | null;
  created_at: string;
  expires_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

/** Posts + stories that RLS already limits to the signed-in user and their friends. */
export function useFeed() {
  const { user } = useAuth();
  const empty = { posts: [] as Post[], stories: [] as Story[], profiles: {} as Record<string, SocialProfile>, likes: {} as Record<string, string[]>, commentCounts: {} as Record<string, number> };
  const fetchFeed = useCallback(async () => {
    if (!user) return empty;
    const [postResult, storyResult] = await Promise.all([
      db.from('posts').select('id, user_id, kind, caption, image_url, created_at').order('created_at', { ascending: false }).limit(100),
      db.from('stories').select('id, user_id, image_url, caption, background, created_at, expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true }),
    ]);
    if (postResult.error || storyResult.error) throw postResult.error || storyResult.error;
    const posts = (postResult.data ?? []) as Post[];
    const stories = (storyResult.data ?? []) as Story[];
    const ids = [...new Set([...posts.map(p => p.user_id), ...stories.map(s => s.user_id)])];
    const postIds = posts.map(p => p.id);
    // Profiles, likes, and counts are independent: no extra request waterfall.
    const results = await Promise.all([
      ids.length ? db.from('profiles').select('id, username, full_name, avatar_url').in('id', ids) : Promise.resolve({ data: [] }),
      postIds.length ? db.from('post_likes').select('post_id, user_id').in('post_id', postIds) : Promise.resolve({ data: [] }),
      postIds.length ? db.from('post_comments').select('post_id').in('post_id', postIds) : Promise.resolve({ data: [] }),
    ]);
    const failed = results.find(r => r.error);
    if (failed) throw failed.error;
    const profiles: Record<string, SocialProfile> = {};
    (results[0].data ?? []).forEach((p: SocialProfile) => { profiles[p.id] = p; });
    const likes: Record<string, string[]> = {};
    (results[1].data ?? []).forEach((r: { post_id: string; user_id: string }) => { (likes[r.post_id] ??= []).push(r.user_id); });
    const commentCounts: Record<string, number> = {};
    (results[2].data ?? []).forEach((r: { post_id: string }) => { commentCounts[r.post_id] = (commentCounts[r.post_id] ?? 0) + 1; });
    return { posts, stories, profiles, likes, commentCounts };
  }, [user?.id]);
  const { data: state, setData, loading, reload: load } = useSocialResource(user?.id, 'feed', empty, fetchFeed);
  const { posts, stories, profiles, likes, commentCounts } = state;
  function setter<K extends keyof typeof empty>(key: K) {
    return (update: SetStateAction<(typeof empty)[K]>) => setData(prev => ({ ...prev, [key]: typeof update === 'function' ? (update as (value: (typeof empty)[K]) => (typeof empty)[K])(prev[key]) : update }));
  }
  const setPosts = setter('posts');
  const setStories = setter('stories');
  const setProfiles = setter('profiles');
  const setLikes = setter('likes');
  const setCommentCounts = setter('commentCounts');

  useEffect(() => {
    if (!user) return;
    const onPost = onUserEvent(user.id, 'posts', payload => {
      const row = payload.new as unknown as Post;
      const id = (payload.old as { id?: string })?.id ?? row?.id;
      if (!id) return;
      setPosts(prev => {
        const rest = prev.filter(item => item.id !== id);
        return payload.eventType === 'DELETE' ? rest : [row, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
      });
      if (payload.eventType === 'DELETE') {
        setLikes(prev => { const next = { ...prev }; delete next[id]; return next; });
        setCommentCounts(prev => { const next = { ...prev }; delete next[id]; return next; });
      } else if (row?.user_id) {
        void db.from('profiles').select('id, username, full_name, avatar_url').eq('id', row.user_id).maybeSingle()
          .then(({ data }: { data: SocialProfile | null }) => { if (data) setProfiles(prev => ({ ...prev, [data.id]: data })); });
      }
    });
    const onStory = onUserEvent(user.id, 'stories', payload => {
      const row = payload.new as unknown as Story;
      const id = (payload.old as { id?: string })?.id ?? row?.id;
      if (!id) return;
      setStories(prev => {
        const rest = prev.filter(item => item.id !== id);
        return payload.eventType === 'DELETE' ? rest : [...rest, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
      if (payload.eventType !== 'DELETE' && row?.user_id) {
        void db.from('profiles').select('id, username, full_name, avatar_url').eq('id', row.user_id).maybeSingle()
          .then(({ data }: { data: SocialProfile | null }) => { if (data) setProfiles(prev => ({ ...prev, [data.id]: data })); });
      }
    });
    return () => {
      onPost(); onStory();
    };
  }, [user?.id, load]);

  const createPost = useCallback(
    async (input: { kind: Post['kind']; caption?: string; image_url?: string | null }) => {
      if (!user) return;
      const { error } = await db.from('posts').insert({
        user_id: user.id,
        kind: input.kind,
        caption: input.caption?.trim() || null,
        image_url: input.image_url ?? null,
      });
      if (error) throw new Error(error.message);
      await load();
    },
    [user, load]
  );

  const deletePost = useCallback(
    async (id: string) => {
      await db.from('posts').delete().eq('id', id);
      load();
    },
    [load]
  );

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!user) return;
      const liked = (likes[postId] ?? []).includes(user.id);
      setLikes(prev => {
        const cur = prev[postId] ?? [];
        return { ...prev, [postId]: liked ? cur.filter(u => u !== user.id) : [...cur, user.id] };
      });
      if (liked) {
        await db.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await db.from('post_likes').insert({ post_id: postId, user_id: user.id });
      }
    },
    [user, likes]
  );

  const createStory = useCallback(
    async (input: { image_url?: string | null; caption?: string; background?: string | null }) => {
      if (!user) return;
      const { error } = await db.from('stories').insert({
        user_id: user.id,
        image_url: input.image_url ?? null,
        caption: input.caption?.trim() || null,
        background: input.background ?? null,
      });
      if (error) throw new Error(error.message);
      await load();
    },
    [user, load]
  );

  const deleteStory = useCallback(
    async (id: string) => {
      await db.from('stories').delete().eq('id', id);
      load();
    },
    [load]
  );

  /** Stories grouped per person, own story first. */
  const storyGroups = useMemo(() => {
    const map = new Map<string, Story[]>();
    stories
      .filter(s => new Date(s.expires_at).getTime() > Date.now())
      .forEach(s => {
        const arr = map.get(s.user_id) ?? [];
        arr.push(s);
        map.set(s.user_id, arr);
      });
    const groups = Array.from(map.entries()).map(([userId, items]) => ({ userId, items }));
    groups.sort((a, b) => (a.userId === user?.id ? -1 : b.userId === user?.id ? 1 : 0));
    return groups;
  }, [stories, user]);

  return {
    loading,
    posts,
    stories,
    storyGroups,
    profiles,
    likes,
    commentCounts,
    createPost,
    deletePost,
    toggleLike,
    createStory,
    deleteStory,
    reload: load,
  };
}

export function usePostComments(postId: string | null) {
  const { user } = useAuth();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, SocialProfile>>({});

  const load = useCallback(async () => {
    if (!postId) return;
    const { data } = await db
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    const list = (data ?? []) as PostComment[];
    setComments(list);
    const ids = Array.from(new Set(list.map(c => c.user_id)));
    if (ids.length) {
      const { data: profs } = await db
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', ids);
      const map: Record<string, SocialProfile> = {};
      ((profs ?? []) as SocialProfile[]).forEach(p => (map[p.id] = p));
      setProfiles(map);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (content: string) => {
      if (!user || !postId || !content.trim()) return;
      await db.from('post_comments').insert({ post_id: postId, user_id: user.id, content: content.trim() });
      load();
    },
    [user, postId, load]
  );

  const remove = useCallback(
    async (id: string) => {
      await db.from('post_comments').delete().eq('id', id);
      load();
    },
    [load]
  );

  return { comments, profiles, add, remove, reload: load };
}
