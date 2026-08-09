import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserAvatar } from '@/components/UserAvatar';
import { supabase } from '@/integrations/supabase/client';
import { socialName, useFriends, type SocialProfile } from '@/hooks/use-friends';

const db = supabase as any;

export function FriendsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { incoming, outgoing, friends, profiles, accept, remove, sendRequest, statusWith } = useFriends();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SocialProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;
    setSearching(true);
    const { data } = await db.rpc('search_profiles_by_username', { _term: term.trim() });
    setResults((data ?? []) as SocialProfile[]);
    setSearching(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Friends</DialogTitle>
        </DialogHeader>

        <form onSubmit={search} className="flex gap-2">
          <Input
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Search by username"
            aria-label="Search by username"
          />
          <Button type="submit" size="icon" aria-label="Search">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </form>

        <div className="max-h-[60vh] overflow-y-auto space-y-4">
          {results.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase text-muted-foreground">Results</h3>
              {results.map(p => {
                const status = statusWith(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-2.5">
                    <UserAvatar src={p.avatar_url} name={socialName(p)} className="w-8 h-8" />
                    <Link to={`/u/${p.id}`} className="flex-1 min-w-0 text-[13px] font-medium truncate">
                      {socialName(p)}
                    </Link>
                    {status === 'none' ? (
                      <Button size="sm" className="rounded-full h-7" onClick={() => sendRequest(p.id)}>
                        <UserPlus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground capitalize">{status}</span>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {incoming.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase text-muted-foreground">Requests</h3>
              {incoming.map(r => (
                <div key={r.id} className="flex items-center gap-2.5">
                  <UserAvatar
                    src={profiles[r.requester_id]?.avatar_url}
                    name={socialName(profiles[r.requester_id])}
                    className="w-8 h-8"
                  />
                  <span className="flex-1 min-w-0 text-[13px] font-medium truncate">
                    {socialName(profiles[r.requester_id])}
                  </span>
                  <Button size="icon" className="h-7 w-7 rounded-full" onClick={() => accept(r.id)} aria-label="Accept">
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full"
                    onClick={() => remove(r.id)}
                    aria-label="Decline"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </section>
          )}

          {outgoing.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase text-muted-foreground">Sent</h3>
              {outgoing.map(r => (
                <div key={r.id} className="flex items-center gap-2.5">
                  <UserAvatar
                    src={profiles[r.addressee_id]?.avatar_url}
                    name={socialName(profiles[r.addressee_id])}
                    className="w-8 h-8"
                  />
                  <span className="flex-1 min-w-0 text-[13px] truncate">
                    {socialName(profiles[r.addressee_id])}
                  </span>
                  <Button size="sm" variant="ghost" className="h-7 rounded-full" onClick={() => remove(r.id)}>
                    Cancel
                  </Button>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase text-muted-foreground">
              Friends ({friends.length})
            </h3>
            {friends.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                Search a username to send your first friend request.
              </p>
            ) : (
              friends.map(id => (
                <Link key={id} to={`/u/${id}`} className="flex items-center gap-2.5">
                  <UserAvatar src={profiles[id]?.avatar_url} name={socialName(profiles[id])} className="w-8 h-8" />
                  <span className="text-[13px] font-medium truncate">{socialName(profiles[id])}</span>
                </Link>
              ))
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
