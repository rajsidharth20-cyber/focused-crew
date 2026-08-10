import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { SocialProfile } from '@/hooks/use-friends';

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
  const instanceId = useId();
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [profiles, setProfiles] = useState<Record<string, SocialProfile>>({});
  const [likes, setLikes] = useState<Record<string, string[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const [{ data: postRows }, { data: storyRows }] = await Promise.all([
      db.from('posts').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('stories').select('*').order('created_at', { ascending: true }),
    ]);
    const p = (postRows ?? []) as Post[];
    const s = (storyRows ?? []) as Story[];
    setPosts(p);
    setStories(s);

    const ids = Array.from(new Set([...p.map(x => x.user_id), ...s.map(x => x.user_id)]));
    if (ids.length) {
      const { data: profs } = await db
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', ids);
      const map: Record<string, SocialProfile> = {};
      ((profs ?? []) as SocialProfile[]).forEach(x => (map[x.id] = x));
      setProfiles(map);
    }

    const postIds = p.map(x => x.id);
    if (postIds.length) {
      const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
        db.from('post_likes').select('post_id, user_id').in('post_id', postIds),
        db.from('post_comments').select('post_id').in('post_id', postIds),
      ]);
      const lm: Record<string, string[]> = {};
      ((likeRows ?? []) as { post_id: string; user_id: string }[]).forEach(r => {
        (lm[r.post_id] ??= []).push(r.user_id);
      });
      setLikes(lm);
      const cm: Record<string, number> = {};
      ((commentRows ?? []) as { post_id: string }[]).forEach(r => {
        cm[r.post_id] = (cm[r.post_id] ?? 0) + 1;
      });
      setCommentCounts(cm);
    } else {
      setLikes({});
      setCommentCounts({});
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel(`feed-${user.id}-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load, instanceId]);

  const createPost = useCallback(
    async (input: { kind: Post['kind']; caption?: string; image_url?: string | null }) => {
      if (!user) return;
      await db.from('posts').insert({
        user_id: user.id,
        kind: input.kind,
        caption: input.caption?.trim() || null,
        image_url: input.image_url ?? null,
      });
      load();
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
      await db.from('stories').insert({
        user_id: user.id,
        image_url: input.image_url ?? null,
        caption: input.caption?.trim() || null,
        background: input.background ?? null,
      });
      load();
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
