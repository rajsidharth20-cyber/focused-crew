import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X, Heart, Eye } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/hooks/useAuth';
import { socialName, type SocialProfile } from '@/hooks/use-friends';
import type { Story } from '@/hooks/use-feed';
import { useStoryEngagement, type StoryView } from '@/hooks/use-story-engagement';
import { fetchProfiles } from '@/hooks/use-study-groups';
import { timeAgo, useSocialImage } from '@/lib/social-media';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface Group {
  userId: string;
  items: Story[];
}

function StoryMedia({ story }: { story: Story }) {
  const url = useSocialImage(story.image_url);
  if (story.image_url) {
    return url ? (
      <img src={url} alt={story.caption ?? 'Story'} className="max-h-[70vh] w-full object-contain" />
    ) : (
      <div className="h-[60vh] w-full bg-muted/20 animate-pulse rounded-2xl" />
    );
  }
  return (
    <div className="min-h-[50vh] w-full grid place-items-center p-8 bg-primary/15 rounded-3xl">
      <p className="text-xl font-semibold text-center leading-snug">{story.caption}</p>
    </div>
  );
}

/** Instagram-style "seen by" sheet: who viewed the story and who liked it. */
function StoryInsightsSheet({
  open,
  onOpenChange,
  views,
  likes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  views: StoryView[];
  likes: StoryView[];
}) {
  const [profiles, setProfiles] = useState<Record<string, SocialProfile>>({});
  const likedIds = useMemo(() => new Set(likes.map(l => l.user_id)), [likes]);
  const ids = useMemo(
    () => Array.from(new Set([...views.map(v => v.user_id), ...likes.map(l => l.user_id)])),
    [views, likes]
  );

  useEffect(() => {
    if (!open || ids.length === 0) return;
    fetchProfiles(ids).then(map => setProfiles(map as Record<string, SocialProfile>));
  }, [open, ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const seen = [...views].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const extraLikers = likes.filter(l => !views.some(v => v.user_id === l.user_id));
    return [...seen, ...extraLikers];
  }, [views, likes]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[70vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base">
            {views.length} view{views.length === 1 ? '' : 's'} · {likes.length} like{likes.length === 1 ? '' : 's'}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-1">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No one has seen this story yet.</p>
          )}
          {rows.map(r => (
            <div key={r.user_id} className="flex items-center gap-3 py-2">
              <UserAvatar
                src={profiles[r.user_id]?.avatar_url}
                name={socialName(profiles[r.user_id])}
                className="w-9 h-9"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate">{socialName(profiles[r.user_id])}</p>
                <p className="text-[11px] text-muted-foreground">{timeAgo(r.created_at)}</p>
              </div>
              {likedIds.has(r.user_id) && <Heart className="w-4 h-4 fill-primary text-primary" />}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StoryViewer({
  group,
  profile,
  onClose,
  onDelete,
}: {
  group: Group;
  profile?: SocialProfile;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const { user } = useAuth();
  const [i, setI] = useState(0);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const storyIds = useMemo(() => group.items.map(s => s.id), [group.items]);
  const { views, likes, markViewed, toggleLike } = useStoryEngagement(storyIds);
  const story = group.items[i];

  useEffect(() => {
    setI(0);
  }, [group.userId]);

  useEffect(() => {
    if (story) markViewed(story.id);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!story) return null;

  const isMine = story.user_id === user?.id;
  const storyViews = views[story.id] ?? [];
  const storyLikes = likes[story.id] ?? [];
  const iLiked = storyLikes.some(l => l.user_id === user?.id);

  const next = () => (i + 1 < group.items.length ? setI(i + 1) : onClose());
  const prev = () => (i > 0 ? setI(i - 1) : onClose());

  return (
    <div className="fixed inset-0 z-50 bg-background/98 backdrop-blur-xl flex flex-col">
      <div className="flex gap-1 px-3 pt-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        {group.items.map((_, idx) => (
          <span
            key={idx}
            className={`h-1 flex-1 rounded-full ${idx <= i ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>
      <header className="flex items-center gap-2.5 px-4 py-3">
        <UserAvatar src={profile?.avatar_url} name={socialName(profile)} className="w-8 h-8" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold truncate">{socialName(profile)}</p>
          <p className="text-[11px] text-muted-foreground">{timeAgo(story.created_at)}</p>
        </div>
        {isMine && (
          <button onClick={() => { onDelete(story.id); onClose(); }} aria-label="Delete story" className="text-muted-foreground p-2">
            <Trash2 className="w-4.5 h-4.5" />
          </button>
        )}
        <button onClick={onClose} aria-label="Close story" className="p-2">
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 relative flex items-center px-3">
        <StoryMedia story={story} />
        <button onClick={prev} aria-label="Previous" className="absolute inset-y-0 left-0 w-1/3" />
        <button onClick={next} aria-label="Next" className="absolute inset-y-0 right-0 w-2/3" />
      </div>

      {story.image_url && story.caption && (
        <p className="px-6 pt-3 text-center text-[14px]">{story.caption}</p>
      )}

      <footer
        className="relative z-10 flex items-center gap-3 px-5 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        {isMine ? (
          <button
            onClick={() => setInsightsOpen(true)}
            className="press inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground"
          >
            <Eye className="w-4.5 h-4.5" />
            {storyViews.length === 0
              ? 'No views yet'
              : `Seen by ${storyViews.length}`}
            {storyLikes.length > 0 && (
              <span className="inline-flex items-center gap-1 text-primary">
                <Heart className="w-4 h-4 fill-primary" />
                {storyLikes.length}
              </span>
            )}
          </button>
        ) : (
          <span className="text-[12px] text-muted-foreground flex-1">
            {storyLikes.length > 0 && `${storyLikes.length} like${storyLikes.length === 1 ? '' : 's'}`}
          </span>
        )}
        <button
          onClick={() => toggleLike(story.id)}
          aria-label={iLiked ? 'Unlike story' : 'Like story'}
          aria-pressed={iLiked}
          className="press ml-auto p-2 rounded-full"
        >
          <Heart className={`w-6 h-6 transition ${iLiked ? 'fill-primary text-primary scale-110' : 'text-muted-foreground'}`} />
        </button>
      </footer>

      <StoryInsightsSheet
        open={insightsOpen}
        onOpenChange={setInsightsOpen}
        views={storyViews}
        likes={storyLikes}
      />
    </div>
  );
}


interface Props {
  groups: Group[];
  profiles: Record<string, SocialProfile>;
  onAdd: () => void;
  onDeleteStory: (id: string) => void;
}

export function StoryBar({ groups, profiles, onAdd, onDeleteStory }: Props) {
  const { user } = useAuth();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <>
      <div className="flex gap-3.5 overflow-x-auto px-4 py-3 no-scrollbar">
        <button onClick={onAdd} className="flex flex-col items-center gap-1.5 shrink-0 w-[62px]">
          <span className="relative">
            <UserAvatar src={null} name={'You'} className="w-14 h-14 opacity-70" />
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary text-primary-foreground grid place-items-center border-2 border-background">
              <Plus className="w-3 h-3" />
            </span>
          </span>
          <span className="text-[10.5px] font-medium truncate w-full text-center">Your story</span>
        </button>

        {groups.map((g, idx) => (
          <button
            key={g.userId}
            onClick={() => setOpenIdx(idx)}
            className="flex flex-col items-center gap-1.5 shrink-0 w-[62px]"
          >
            <span className="p-[2px] rounded-full bg-gradient-to-tr from-primary to-primary/40">
              <UserAvatar
                src={profiles[g.userId]?.avatar_url}
                name={socialName(profiles[g.userId])}
                className="w-[52px] h-[52px] border-2 border-background"
              />
            </span>
            <span className="text-[10.5px] font-medium truncate w-full text-center">
              {g.userId === user?.id ? 'You' : socialName(profiles[g.userId])}
            </span>
          </button>
        ))}
      </div>

      {openIdx !== null && groups[openIdx] && (
        <StoryViewer
          group={groups[openIdx]}
          profile={profiles[groups[openIdx].userId]}
          onClose={() => setOpenIdx(null)}
          onDelete={onDeleteStory}
        />
      )}
    </>
  );
}
