import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchProfiles,
  leaveGroup,
  memberName,
  type GroupMember,
  type MemberProfile,
  type StudyGroup,
} from '@/hooks/use-study-groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/UserAvatar';
import { useLiveStudy } from '@/hooks/use-live-study';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Copy,
  Loader2,
  LogOut,
  Megaphone,
  MessagesSquare,
  Trophy,
  UserPlus,
  Users,
  Radio,
} from 'lucide-react';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

const fmt = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** 3 AM day boundary, matching the rest of the app. */
function dayStart(offsetDays = 0) {
  const d = new Date();
  if (d.getHours() < 3) d.setDate(d.getDate() - 1);
  d.setHours(3, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

export default function GroupDashboard() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [todaySeconds, setTodaySeconds] = useState<Record<string, number>>({});
  const [weekSeconds, setWeekSeconds] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [inviteTerm, setInviteTerm] = useState('');
  const [invitePeople, setInvitePeople] = useState<MemberProfile[]>([]);

  const { presence, isUserLive } = useLiveStudy(members.map(m => m.user_id));

  const myRole = members.find(m => m.user_id === user?.id)?.role;
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isMember = Boolean(myRole);

  const load = useCallback(async () => {
    if (!groupId || !user) return;
    const [{ data: g }, { data: mems }, { data: anns }] = await Promise.all([
      supabase.from('study_groups').select('*').eq('id', groupId).maybeSingle(),
      supabase.from('group_members').select('*').eq('group_id', groupId).order('joined_at'),
      supabase
        .from('group_announcements')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setGroup((g as StudyGroup) ?? null);
    const memberList = (mems ?? []) as GroupMember[];
    setMembers(memberList);
    setAnnouncements((anns ?? []) as Announcement[]);
    const ids = memberList.map(m => m.user_id);
    setProfiles(await fetchProfiles(ids));

    if (ids.length > 0) {
      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('user_id, duration_seconds, started_at')
        .in('user_id', ids)
        .gte('started_at', dayStart(-6).toISOString());
      const today: Record<string, number> = {};
      const week: Record<string, number> = {};
      const todayFrom = dayStart().getTime();
      (sessions ?? []).forEach(s => {
        week[s.user_id] = (week[s.user_id] ?? 0) + (s.duration_seconds ?? 0);
        if (new Date(s.started_at).getTime() >= todayFrom) {
          today[s.user_id] = (today[s.user_id] ?? 0) + (s.duration_seconds ?? 0);
        }
      });
      setTodaySeconds(today);
      setWeekSeconds(week);
    }
    setLoading(false);
  }, [groupId, user]);

  useEffect(() => {
    load();
    if (!groupId) return;
    const channel = supabase
      .channel(`group-dash-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_announcements', filter: `group_id=eq.${groupId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, load]);

  const ranking = useMemo(
    () =>
      [...members]
        .map(m => ({ ...m, seconds: weekSeconds[m.user_id] ?? 0 }))
        .sort((a, b) => b.seconds - a.seconds),
    [members, weekSeconds]
  );

  const liveMembers = useMemo(
    () => members.filter(m => isUserLive(m.user_id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members, presence]
  );

  const groupToday = useMemo(
    () => Object.values(todaySeconds).reduce((a, b) => a + b, 0),
    [todaySeconds]
  );

  const searchPeople = useCallback(
    async (value: string) => {
      if (value.trim().length < 3) {
        setInvitePeople([]);
        return;
      }
      const { data } = await supabase.rpc('search_profiles_by_username', { _term: value.trim() });
      const memberIds = new Set(members.map(m => m.user_id));
      setInvitePeople(((data ?? []) as MemberProfile[]).filter(p => !memberIds.has(p.id)));
    },
    [members]
  );

  useEffect(() => {
    const id = setTimeout(() => searchPeople(inviteTerm.trim()), 250);
    return () => clearTimeout(id);
  }, [inviteTerm, searchPeople]);

  const invite = async (inviteeId: string) => {
    if (!groupId || !user) return;
    const { error } = await supabase
      .from('group_invites')
      .insert({ group_id: groupId, inviter_id: user.id, invitee_id: inviteeId });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Already invited' : error.message);
      return;
    }
    toast.success('Invite sent');
  };

  const postAnnouncement = async () => {
    if (!groupId || !user || !draft.trim()) return;
    const { error } = await supabase
      .from('group_announcements')
      .insert({ group_id: groupId, user_id: user.id, content: draft.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft('');
  };

  const handleLeave = async () => {
    if (!groupId || !user) return;
    const { error } = await leaveGroup(groupId, user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('You left the group');
    navigate('/groups');
  };

  if (isGuest || !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Users className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Sign in with an account to use study groups.</p>
        <Button onClick={() => navigate('/auth')}>Sign in</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground">This group is not available.</p>
        <Button onClick={() => navigate('/groups')}>Back to groups</Button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <header className="flex items-center gap-2 px-3 py-3 border-b border-border/60 sticky top-0 bg-background/90 backdrop-blur z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/groups')} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold truncate">{group.name}</h1>
          <p className="text-[11px] text-muted-foreground truncate">
            {members.length} member{members.length === 1 ? '' : 's'} ·{' '}
            {group.is_public ? 'Public' : 'Private'}
          </p>
        </div>
        {isMember && (
          <Button asChild size="sm" variant="secondary" className="rounded-full">
            <Link to={`/groups/${group.id}/chat`}>
              <MessagesSquare className="w-4 h-4 mr-1" /> Chat
            </Link>
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/60 bg-card p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Today (group)</p>
            <p className="text-xl font-bold tabular-nums mt-1">{fmt(groupToday)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">You today</p>
            <p className="text-xl font-bold tabular-nums mt-1">{fmt(todaySeconds[user.id] ?? 0)}</p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-500" /> Studying now
          </h2>
          {liveMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is studying right now.</p>
          ) : (
            <ul className="rounded-2xl border border-border/60 bg-card divide-y divide-border/50">
              {liveMembers.map(m => {
                const p = presence[m.user_id];
                const since = p?.started_at ? new Date(p.started_at) : null;
                const mins = since ? Math.max(0, Math.floor((Date.now() - since.getTime()) / 60000)) : 0;
                return (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                    <UserAvatar
                      src={profiles[m.user_id]?.avatar_url}
                      name={memberName(profiles[m.user_id])}
                      className="w-8 h-8"
                      live
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">
                        {memberName(profiles[m.user_id])}
                        {m.user_id === user.id && <span className="text-[10px] text-primary ml-1">you</span>}
                      </p>
                      <p className="text-[11px] text-emerald-600 truncate">
                        {p?.topic ? `${p.topic} · ` : ''}{p?.mode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'} · {mins}m in
                      </p>
                    </div>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Weekly ranking
            </h2>
          </div>
          <ul className="rounded-2xl border border-border/60 bg-card divide-y divide-border/50">
            {ranking.map((m, i) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-5 text-sm font-bold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <UserAvatar
                  src={profiles[m.user_id]?.avatar_url}
                  name={memberName(profiles[m.user_id])}
                  className="w-8 h-8"
                  live={isUserLive(m.user_id)}
                />
                <span className="flex-1 min-w-0 truncate text-sm">
                  {memberName(profiles[m.user_id])}
                  {m.user_id === user.id && (
                    <span className="text-[10px] text-primary ml-1">you</span>
                  )}
                </span>
                <span className="text-sm tabular-nums font-medium">{fmt(m.seconds)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5" /> Announcements
          </h2>
          {isAdmin && (
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Share an update with the group"
                rows={2}
              />
              <Button size="sm" onClick={postAnnouncement} disabled={!draft.trim()}>
                Post announcement
              </Button>
            </div>
          )}
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <ul className="space-y-2">
              {announcements.map(a => (
                <li key={a.id} className="rounded-2xl border border-border/60 bg-card px-3 py-2.5">
                  <p className="text-sm whitespace-pre-wrap break-words">{a.content}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {memberName(profiles[a.user_id])} ·{' '}
                    {new Date(a.created_at).toLocaleString([], {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Members
            </h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost">
                  <UserPlus className="w-4 h-4 mr-1" /> Invite
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Invite friends</DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                  <span className="text-xs text-muted-foreground">Join code</span>
                  <code className="font-mono tracking-widest text-sm flex-1">{group.join_code}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(group.join_code);
                      toast.success('Code copied');
                    }}
                    aria-label="Copy join code"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Input
                  value={inviteTerm}
                  onChange={e => setInviteTerm(e.target.value)}
                  placeholder="Search by exact username"
                />
                <ul className="max-h-64 overflow-y-auto divide-y divide-border/50">
                  {invitePeople.map(p => (
                    <li key={p.id} className="flex items-center gap-3 py-2">
                      <UserAvatar src={p.avatar_url} name={memberName(p)} className="w-8 h-8" />
                      <span className="flex-1 min-w-0 truncate text-sm">{memberName(p)}</span>
                      <Button size="sm" variant="secondary" onClick={() => invite(p.id)}>
                        Invite
                      </Button>
                    </li>
                  ))}
                  {invitePeople.length === 0 && (
                    <li className="py-3 text-sm text-muted-foreground">
                      {inviteTerm.trim().length < 3
                        ? 'Type at least 3 characters of a username.'
                        : 'No people found.'}
                    </li>
                  )}
                </ul>
              </DialogContent>
            </Dialog>
          </div>
          <ul className="rounded-2xl border border-border/60 bg-card divide-y divide-border/50">
            {members.map(m => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <UserAvatar
                  src={profiles[m.user_id]?.avatar_url}
                  name={memberName(profiles[m.user_id])}
                  className="w-8 h-8"
                  live={isUserLive(m.user_id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{memberName(profiles[m.user_id])}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{m.role}</p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {fmt(todaySeconds[m.user_id] ?? 0)} today
                </span>
              </li>
            ))}
          </ul>
        </section>

        {isMember && group.owner_id !== user.id && (
          <Button variant="ghost" className="w-full text-destructive" onClick={handleLeave}>
            <LogOut className="w-4 h-4 mr-2" /> Leave group
          </Button>
        )}
      </div>
    </div>
  );
}
