import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Pause, Play, Square, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/hooks/useAuth';
import { useFriends, socialName } from '@/hooks/use-friends';
import {
  useMyGroups,
  fetchProfiles,
  memberName,
  searchPublicGroups,
  type MemberProfile,
  type StudyGroup,
} from '@/hooks/use-study-groups';
import { useLiveStudy } from '@/hooks/use-live-study';
import { useNow } from '@/hooks/use-now';
import { fmtHMS } from '@/components/home/SubjectBoard';

interface Props {
  subjectName: string;
  color: string;
  elapsed: number;
  isRunning: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClose: () => void;
}

const MOTIVATION = [
  'Stay focused, great things take time. 🔥',
  'One deep block beats five distracted ones. ✨',
  'Small sessions, compounding results. 📈',
  'You showed up — that is the hard part. 💪',
];

const fmtClock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * The screen shown right after a session starts: a compact active-timer header
 * plus the live social context (rooms + people studying) around it.
 * Timer, presence and data logic live in the hooks — this file is presentation.
 */
export function FullScreenSubjectTimer({
  subjectName, color, elapsed, isRunning, onPause, onResume, onStop, onClose,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = useNow(1000);
  const instanceId = useId();
  const [tab, setTab] = useState<'mine' | 'all'>('mine');

  const { groups } = useMyGroups();
  const { friends, profiles: friendProfiles } = useFriends();
  const [membersByGroup, setMembersByGroup] = useState<Record<string, string[]>>({});
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [publicGroups, setPublicGroups] = useState<StudyGroup[]>([]);

  const groupIds = useMemo(() => groups.map(g => g.id).sort().join(','), [groups]);

  const loadMembers = useCallback(async () => {
    const ids = groupIds ? groupIds.split(',') : [];
    if (ids.length === 0) {
      setMembersByGroup({});
      return;
    }
    const { data } = await supabase.from('group_members').select('group_id, user_id').in('group_id', ids);
    const map: Record<string, string[]> = {};
    (data ?? []).forEach(m => {
      (map[m.group_id] ??= []).push(m.user_id);
    });
    setMembersByGroup(map);
    setProfiles(prev => ({
      ...prev,
      ...(await fetchProfiles(Array.from(new Set((data ?? []).map(m => m.user_id))))),
    }));
  }, [groupIds]);

  useEffect(() => {
    loadMembers();
    if (!groupIds) return;
    const channel = supabase
      .channel(`session-room-members-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => loadMembers())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupIds, loadMembers, instanceId]);

  useEffect(() => {
    if (tab !== 'all' || publicGroups.length) return;
    searchPublicGroups('').then(setPublicGroups);
  }, [tab, publicGroups.length]);

  const memberIds = useMemo(
    () => Array.from(new Set(Object.values(membersByGroup).flat())),
    [membersByGroup],
  );
  const watchIds = useMemo(
    () => Array.from(new Set([...friends, ...memberIds])).filter(id => id !== user?.id),
    [friends, memberIds, user],
  );
  const { presence, isUserLive } = useLiveStudy(watchIds);

  const nameFor = (id: string) =>
    friendProfiles[id] ? socialName(friendProfiles[id]) : memberName(profiles[id]);
  const avatarFor = (id: string) => friendProfiles[id]?.avatar_url ?? profiles[id]?.avatar_url;
  const secondsFor = (id: string) => {
    const started = presence[id]?.started_at;
    return started ? Math.max(0, (now.getTime() - new Date(started).getTime()) / 1000) : 0;
  };

  const livePeople = watchIds
    .filter(isUserLive)
    .map(id => ({ id, seconds: secondsFor(id) }))
    .sort((a, b) => b.seconds - a.seconds);

  const myRooms = groups
    .map(g => {
      const members = membersByGroup[g.id] ?? [];
      return { group: g, members, live: members.filter(id => id !== user?.id && isUserLive(id)) };
    })
    .sort((a, b) => b.live.length - a.live.length || a.group.name.localeCompare(b.group.name));

  const otherRooms = publicGroups.filter(g => !groups.some(mine => mine.id === g.id));

  const motivation = MOTIVATION[Math.floor(elapsed / 600) % MOTIVATION.length];
  const minuteProgress = (elapsed % 3600) / 3600;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden"
      style={{
        background: `radial-gradient(120% 60% at 50% 0%, ${color}22 0%, transparent 60%), hsl(var(--background))`,
        paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)',
      }}
    >
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4">
        {/* ---- Active timer header ---- */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
            <h1 className="truncate text-[17px] font-semibold tracking-tight">{subjectName}</h1>
            <span className="text-[13px] tabular-nums text-muted-foreground">{fmtHMS(elapsed)}</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close session view"
            className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/50"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        <section className="rounded-[26px] border border-border/50 bg-card/70 p-5 backdrop-blur-xl">
          <p className="text-[11.5px] uppercase tracking-[0.18em] text-muted-foreground">
            {isRunning ? 'Current focus time' : 'Paused'}
          </p>
          <div className="mt-2 flex items-center gap-4">
            <span className="text-[38px] font-bold leading-none tabular-nums tracking-tight sm:text-[46px]">
              {fmtClock(elapsed)}
            </span>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={isRunning ? onPause : onResume}
              aria-label={isRunning ? 'Pause timer' : 'Resume timer'}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-primary-foreground shadow-lg"
              style={{ background: color }}
            >
              {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={onStop}
              className="press ml-auto inline-flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-2.5 text-[12.5px] font-medium"
            >
              <Square className="h-3.5 w-3.5" />Stop
            </motion.button>
          </div>

          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: color }}
              animate={{ width: `${Math.max(2, minuteProgress * 100)}%` }}
              transition={{ duration: 0.8, ease: 'linear' }}
            />
          </div>
          <p className="mt-2.5 text-[12px] text-muted-foreground">{motivation}</p>
        </section>

        {/* ---- Rooms ---- */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex rounded-full border border-border/60 bg-secondary/40 p-1">
              {(['mine', 'all'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition ${
                    tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  {t === 'mine' ? 'My rooms' : 'All rooms'}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate('/social')}
              className="press text-[12px] font-medium text-primary"
            >
              View all →
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.ul
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {tab === 'mine' && myRooms.length === 0 && (
                <EmptyRow
                  text="You haven't joined a study room yet."
                  action="Browse rooms"
                  onClick={() => setTab('all')}
                />
              )}
              {tab === 'all' && otherRooms.length === 0 && (
                <EmptyRow text="No public rooms to discover right now." />
              )}

              {(tab === 'mine' ? myRooms : otherRooms.map(g => ({ group: g, members: [], live: [] as string[] }))).map(
                ({ group, members, live }, i) => (
                  <motion.li
                    key={group.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.2) }}
                  >
                    <button
                      onClick={() => navigate(`/groups/${group.id}`)}
                      className="press flex w-full items-center gap-3 rounded-[22px] border border-border/50 bg-card/70 px-3.5 py-3 text-left backdrop-blur"
                    >
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[15px] font-semibold"
                        style={{ background: `${color}1f`, color }}
                      >
                        {group.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold leading-tight">{group.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                          {live.length > 0 && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            </span>
                          )}
                          {tab === 'mine'
                            ? `${live.length} studying · ${members.length} members`
                            : group.description || 'Public study room'}
                        </span>
                      </span>
                      {live.length > 0 && (
                        <span className="flex shrink-0 -space-x-2">
                          {live.slice(0, 3).map(id => (
                            <UserAvatar
                              key={id}
                              src={avatarFor(id)}
                              name={nameFor(id)}
                              className="h-6 w-6 ring-2 ring-background"
                            />
                          ))}
                          {live.length > 3 && (
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[9.5px] font-semibold ring-2 ring-background">
                              +{live.length - 3}
                            </span>
                          )}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </motion.li>
                ),
              )}
            </motion.ul>
          </AnimatePresence>
        </section>

        {/* ---- People studying live ---- */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[15px] font-semibold tracking-tight">People studying live</h2>
            <button onClick={() => navigate('/social')} className="press text-[12px] font-medium text-primary">
              View all
            </button>
          </div>

          {livePeople.length === 0 ? (
            <EmptyRow
              icon
              text="Nobody else is studying yet — you're setting the pace."
              action="Find people"
              onClick={() => navigate('/social')}
            />
          ) : (
            <ul className="grid grid-cols-2 gap-2.5">
              <AnimatePresence initial={false}>
                {livePeople.map(({ id, seconds }, i) => (
                  <motion.li
                    key={id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(i * 0.03, 0.18) }}
                  >
                    <button
                      onClick={() => navigate(`/u/${id}`)}
                      className="press flex w-full flex-col items-start gap-2 rounded-[22px] border border-border/50 bg-card/70 p-3 text-left backdrop-blur"
                    >
                      <span className="flex w-full items-center gap-2">
                        <UserAvatar src={avatarFor(id)} name={nameFor(id)} live className="h-9 w-9" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{nameFor(id)}</span>
                      </span>
                      <span className="w-full truncate text-[11.5px] text-muted-foreground">
                        {presence[id]?.topic || presence[id]?.mode || 'Studying'}
                      </span>
                      <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
                        {fmtClock(seconds)}
                      </span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>
    </motion.div>
  );
}

function EmptyRow({
  text, action, onClick, icon,
}: { text: string; action?: string; onClick?: () => void; icon?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] border border-dashed border-border/70 bg-secondary/25 px-4 py-4">
      {icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-primary">
          <Users className="h-4 w-4 text-primary-foreground" />
        </span>
      )}
      <p className="min-w-0 flex-1 text-[12.5px] text-muted-foreground">{text}</p>
      {action && (
        <button onClick={onClick} className="press shrink-0 text-[12px] font-medium text-primary">
          {action}
        </button>
      )}
    </div>
  );
}
