type PreferenceDatabase = {
  from: (table: 'notification_preferences') => any;
};

/** Save one preference without replacing the recipient's other saved choices. */
export async function saveNotificationPreference(
  db: PreferenceDatabase,
  userId: string,
  key: string,
  value: boolean,
  defaults: Record<string, boolean>,
) {
  const { data, error } = await db
    .from('notification_preferences')
    .update({ [key]: value })
    .eq('user_id', userId)
    .select('user_id')
    .maybeSingle();

  if (error) throw error;
  if (data) return;

  const { error: insertError } = await db.from('notification_preferences').insert({
    user_id: userId,
    ...defaults,
    [key]: value,
  });
  if (!insertError) return;

  // A concurrent first save may have created the row after the update above.
  if (insertError.code !== '23505') throw insertError;
  const { error: retryError } = await db
    .from('notification_preferences')
    .update({ [key]: value })
    .eq('user_id', userId);
  if (retryError) throw retryError;
}