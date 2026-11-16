export function socialNotificationKey(category: 'story_likes' | 'new_posts', sourceId: string, actorId: string) {
  return `${category}:${sourceId}:${actorId}`;
}

export function socialNotificationAllowed(prefs: Record<string, boolean> | undefined, category: 'story_likes' | 'new_posts') {
  return !prefs || (prefs.push_enabled !== false && prefs[category] !== false);
}

/** Resolve recipients and content from saved actions, never client-supplied names or recipients. */
export async function resolveSocialNotification(db: any, callerId: string, category: 'story_likes' | 'new_posts', sourceId: string) {
  const table = category === 'new_posts' ? 'posts' : 'stories';
  const { data: source, error } = await db.from(table).select('id,user_id,created_at').eq('id', sourceId).maybeSingle();
  if (error) throw error;
  if (!source || Date.now() - Date.parse(source.created_at) > (category === 'new_posts' ? 10 * 60 * 1000 : 24 * 60 * 60 * 1000)) return null;
  let recipients: string[];
  if (category === 'new_posts') {
    if (source.user_id !== callerId) return null;
    const { data, error: failed } = await db.rpc('social_post_notification_recipients', { _post_id: sourceId });
    if (failed) throw failed;
    recipients = (data ?? []).map((r: { user_id: string }) => r.user_id);
  } else {
    if (source.user_id === callerId) return null;
    const { data: blocks, error: blockedError } = await db.from('blocks').select('id').or(`and(blocker_id.eq.${callerId},blocked_id.eq.${source.user_id}),and(blocker_id.eq.${source.user_id},blocked_id.eq.${callerId})`);
    if (blockedError) throw blockedError;
    if (blocks?.length) return null;
    const { data: like, error: failed } = await db.from('story_likes').select('story_id').eq('story_id', sourceId).eq('user_id', callerId).maybeSingle();
    if (failed) throw failed;
    if (!like) return null;
    recipients = [source.user_id];
  }
  const { data: actor, error: failed } = await db.from('profiles').select('username,full_name').eq('id', callerId).maybeSingle();
  if (failed) throw failed;
  const name = actor?.full_name?.trim() || actor?.username?.trim() || 'Someone';
  return { recipients, title: name.slice(0, 120), body: category === 'new_posts' ? 'Shared a new post' : 'Liked your story', url: category === 'new_posts' ? `/u/${callerId}` : '/feed', dedupeBase: socialNotificationKey(category, sourceId, callerId) };
}