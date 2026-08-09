import { useState } from 'react';
import { PenSquare, Users } from 'lucide-react';
import { BottomNav } from '@/components/shell/BottomNav';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { StoryBar } from '@/components/social/StoryBar';
import { PostCard } from '@/components/social/PostCard';
import { ComposeDialog } from '@/components/social/ComposeDialog';
import { FriendsDialog } from '@/components/social/FriendsDialog';
import { useFeed } from '@/hooks/use-feed';
import { useFriends } from '@/hooks/use-friends';

export default function Feed() {
  const {
    loading,
    posts,
    storyGroups,
    profiles,
    likes,
    commentCounts,
    createPost,
    deletePost,
    toggleLike,
    createStory,
    deleteStory,
  } = useFeed();
  const { incoming } = useFriends();
  const [compose, setCompose] = useState<null | 'post' | 'story'>(null);
  const [friendsOpen, setFriendsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <h1 className="text-[17px] font-bold tracking-tight flex-1">Feed</h1>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Friends"
            onClick={() => setFriendsOpen(true)}
          >
            <Users className="w-5 h-5" />
            {incoming.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold grid place-items-center">
                {incoming.length > 9 ? '9+' : incoming.length}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon" aria-label="New post" onClick={() => setCompose('post')}>
            <PenSquare className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto pb-28">
        <StoryBar
          groups={storyGroups}
          profiles={profiles}
          onAdd={() => setCompose('story')}
          onDeleteStory={deleteStory}
        />

        <div className="px-4 space-y-3.5">
          {loading ? (
            <div className="h-40 rounded-3xl bg-muted/50 animate-pulse" />
          ) : posts.length === 0 ? (
            <EmptyState
              icon={PenSquare}
              title="Nothing here yet"
              hint="Add friends and share your study wins — only your friends can see them."
            />
          ) : (
            posts.map(p => (
              <PostCard
                key={p.id}
                post={p}
                author={profiles[p.user_id]}
                likedBy={likes[p.id] ?? []}
                commentCount={commentCounts[p.id] ?? 0}
                onToggleLike={() => toggleLike(p.id)}
                onDelete={() => deletePost(p.id)}
              />
            ))
          )}
        </div>
      </main>

      <ComposeDialog
        open={compose !== null}
        mode={compose ?? 'post'}
        onOpenChange={v => setCompose(v ? compose : null)}
        onCreatePost={createPost}
        onCreateStory={createStory}
      />
      <FriendsDialog open={friendsOpen} onOpenChange={setFriendsOpen} />
      <BottomNav />
    </div>
  );
}
