/** Resolve identity from the authenticated sender's profile, never a client-supplied title. */
export function directMessageTitle(profile: { full_name?: string | null; username?: string | null } | null): string {
  return (profile?.full_name?.trim() || profile?.username?.trim() || 'New message').slice(0, 120);
}