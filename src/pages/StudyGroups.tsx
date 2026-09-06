import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  createGroup,
  findGroupByCode,
  joinGroup,
  searchPublicGroups,
  useMyGroups,
  type StudyGroup,
} from '@/hooks/use-study-groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Globe, KeyRound, Loader2, Lock, Plus, Search, Users } from 'lucide-react';
import { toast } from 'sonner';

type GroupsTab = 'mine' | 'more';

export default function StudyGroups({ embedded = false }: { embedded?: boolean }) {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const { groups, loading, refresh } = useMyGroups();

  const [tab, setTab] = useState<GroupsTab>('mine');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<StudyGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [code, setCode] = useState('');

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const runSearch = useCallback(async (value: string) => {
    setSearching(true);
    setResults(await searchPublicGroups(value));
    setSearching(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    const id = setTimeout(() => runSearch(term), 250);
    return () => clearTimeout(id);
  }, [term, user, runSearch]);

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    const { data, error } = await createGroup(user.id, name.trim(), description, isPublic);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpen(false);
    setName('');
    setDescription('');
    await refresh();
    toast.success('Group created');
    if (data) navigate(`/groups/${data.id}`);
  };

  const handleJoin = async (group: StudyGroup) => {
    if (!user) return;
    const { error } = await joinGroup(group.id, user.id);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'You are already a member' : error.message);
      return;
    }
    await refresh();
    toast.success(`Joined ${group.name}`);
    navigate(`/groups/${group.id}`);
  };

  const handleJoinByCode = async () => {
    if (!code.trim()) return;
    const group = await findGroupByCode(code);
    if (!group) {
      toast.error('No group found with that code');
      return;
    }
    setCode('');
    handleJoin(group);
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

  const myIds = new Set(groups.map(g => g.id));
  const otherGroups = results.filter(g => !myIds.has(g.id));

  const createDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full">
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create a study group</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Group name" />
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this group about?"
            rows={3}
          />
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
            <Label htmlFor="is-public" className="text-sm">
              Public group
              <span className="block text-xs text-muted-foreground font-normal">
                Anyone can find and join it
              </span>
            </Label>
            <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving || !name.trim()} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const tabs: { id: GroupsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'mine', label: 'My groups', icon: Users },
    { id: 'more', label: 'More groups', icon: Globe },
  ];

  return (
    <div
      className={embedded ? 'flex flex-col flex-1 min-h-0' : 'min-h-screen bg-background flex flex-col'}
      style={embedded ? undefined : { paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <header className="px-3 pt-2 pb-2 border-b border-border/60 sticky top-0 bg-background/90 backdrop-blur z-10 space-y-2">
        <div className="flex items-center gap-2">
          {!embedded && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <h1 className="text-sm font-semibold flex-1">Study Groups</h1>
          {createDialog}
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-muted/50">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center justify-center gap-1.5 h-9 rounded-xl text-[12.5px] font-semibold transition-colors ${
                  active ? 'text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="groups-tab"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="absolute inset-0 rounded-xl bg-primary"
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <Icon className="w-4 h-4" />
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 overflow-y-auto p-4"
        >
          {tab === 'mine' ? (
            <div className="space-y-2">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : groups.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                    <Users className="w-7 h-7" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-[240px]">
                    You have not joined any group yet. Find one in <span className="font-semibold text-foreground">More groups</span> or create your own.
                  </p>
                  <Button variant="secondary" size="sm" className="rounded-full" onClick={() => setTab('more')}>
                    <Globe className="w-4 h-4 mr-1.5" /> Discover groups
                  </Button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {groups.map(g => (
                    <li key={g.id}>
                      <Link
                        to={`/groups/${g.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-3 hover:bg-muted/60 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{g.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {g.description || (g.is_public ? 'Public group' : 'Private group')}
                          </p>
                        </div>
                        {g.is_public ? (
                          <Globe className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <section className="space-y-2">
                <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> Join with a code
                </h2>
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 4F9A2B"
                    className="uppercase tracking-widest"
                  />
                  <Button variant="secondary" onClick={handleJoinByCode} disabled={!code.trim()}>
                    Join
                  </Button>
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Discover public groups
                </h2>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={term}
                    onChange={e => setTerm(e.target.value)}
                    placeholder="Search groups"
                    className="pl-9"
                  />
                </div>
                {searching ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : otherGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    {results.length > 0 ? 'You have joined every group here.' : 'No public groups found.'}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {otherGroups.map(g => (
                      <li
                        key={g.id}
                        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{g.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {g.description || 'Public group'}
                          </p>
                        </div>
                        <Button size="sm" onClick={() => handleJoin(g)}>
                          Join
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
