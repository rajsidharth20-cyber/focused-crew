import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, MoreHorizontal, Trash2 } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { socialName, type SocialProfile } from '@/hooks/use-friends';
import { usePostComments, type Post } from '@/hooks/use-feed';
import { timeAgo, useSocialImage } from '@/lib/social-media';

function PostImage({ path }: { path: string }) {
  const url = useSocialImage(path);
  if (!url) return <div className="w-full aspect-[4/5] rounded-2xl bg-muted animate-pulse" />;
  return (
    <img
      src={url}
      alt="Study post"
      loading="lazy"
      className="w-full max-h-[70vh] object-cover rounded-2xl border border-border/50"
    />
  );
}

function CommentsDialog({
  post,
  open,
  onOpenChange,
}: {
  post: Post;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const { comments, profiles, add, remove } = usePostComments(open ? post.id : null);
  const [text, setText] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
        </DialogHeader>
        <ul className="max-h-72 overflow-y-auto space-y-3">
          {comments.length === 0 && (
            <li className="text-sm text-muted-foreground py-4 text-center">No comments yet.</li>
          )}
          {comments.map(c => (
            <li key={c.id} className="flex gap-2.5">
              <UserAvatar
                src={profiles[c.user_id]?.avatar_url}
                name={socialName(profiles[c.user_id])}
                className="w-7 h-7"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold">
                  {socialName(profiles[c.user_id])}
                  <span className="ml-2 font-normal text-muted-foreground">{timeAgo(c.created_at)}</span>
                </p>
                <p className="text-[13px] break-words">{c.content}</p>
              </div>
              {(c.user_id === user?.id || post.user_id === user?.id) && (
                <button
                  onClick={() => remove(c.id)}
                  aria-label="Delete comment"
                  className="text-muted-foreground shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          onSubmit={e => {
            e.preventDefault();
            add(text);
            setText('');
          }}
          className="flex gap-2"
        >
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a comment"
            aria-label="Comment"
          />
          <Button type="submit" disabled={!text.trim()}>
            Post
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface Props {
  post: Post;
  author?: SocialProfile;
  likedBy: string[];
  commentCount: number;
  onToggleLike: () => void;
  onDelete: () => void;
}

export function PostCard({ post, author, likedBy, commentCount, onToggleLike, onDelete }: Props) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const liked = !!user && likedBy.includes(user.id);

  return (
    <article className="rounded-3xl border border-border/50 bg-card p-3.5 space-y-3">
      <header className="flex items-center gap-2.5">
        <Link to={`/u/${post.user_id}`}>
          <UserAvatar src={author?.avatar_url} name={socialName(author)} className="w-9 h-9" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/u/${post.user_id}`} className="text-[13.5px] font-semibold truncate block">
            {socialName(author)}
          </Link>
          <p className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</p>
        </div>
        {post.user_id === user?.id && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Post options">
                <MoreHorizontal className="w-4.5 h-4.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {post.image_url && <PostImage path={post.image_url} />}

      {post.caption && (
        <p
          className={
            post.image_url
              ? 'text-[13.5px] leading-relaxed'
              : 'text-[15px] leading-relaxed font-medium py-2'
          }
        >
          {post.caption}
        </p>
      )}

      <footer className="flex items-center gap-4 pt-0.5">
        <button
          onClick={onToggleLike}
          aria-label={liked ? 'Unlike' : 'Like'}
          className={`flex items-center gap-1.5 text-[12.5px] font-semibold transition-colors ${
            liked ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Heart className={`w-4.5 h-4.5 ${liked ? 'fill-current' : ''}`} />
          {likedBy.length > 0 && likedBy.length}
        </button>
        <button
          onClick={() => setShowComments(true)}
          aria-label="Comments"
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground"
        >
          <MessageCircle className="w-4.5 h-4.5" />
          {commentCount > 0 && commentCount}
        </button>
      </footer>

      <CommentsDialog post={post} open={showComments} onOpenChange={setShowComments} />
    </article>
  );
}
