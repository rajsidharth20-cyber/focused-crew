import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfileOverview } from "@/hooks/use-follows";
import { useSocialImage } from "@/lib/social-media";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Flame, Loader2, Lock, MessageCircle, UserCheck, UserPlus } from "lucide-react";

const fmtMins = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`);

function PostThumb({ path }: { path: string | null }) {
  const url = useSocialImage(path);
  return (
    <div className="aspect-square overflow-hidden rounded-lg bg-secondary/50">
      {url && <img src={url} alt="Post" className="h-full w-full object-cover" loading="lazy" />}
    </div>
  );
}

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, busy, follow, unfollow } = useProfileOverview(userId);
  const [posts, setPosts] = useState<{ id: string; image_url: string | null; caption: string | null }[]>([]);

  useEffect(() => {
    if (!userId || !data?.can_see) return;
    supabase
      .from("posts")
      .select("id, image_url, caption")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data: rows }) => setPosts(rows ?? []));
  }, [userId, data?.can_see]);

  const name = data?.full_name || data?.username || "Pilot";

  return (
    <div
      className="app-surface min-h-screen"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-background/75 px-3 py-3 backdrop-blur-xl">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-[15px] font-semibold">{data?.username ? `@${data.username}` : "Profile"}</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !data ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Profile not found.</p>
      ) : (
        <main className="mx-auto max-w-2xl space-y-5 px-4 pb-24">
          <section className="flex items-center gap-4">
            <UserAvatar src={data.avatar_url} name={name} className="h-20 w-20" fallbackClassName="text-2xl" />
            <div className="grid flex-1 grid-cols-3 gap-1 text-center">
              {[
                { label: "Posts", value: data.posts_count },
                { label: "Followers", value: data.followers_count },
                { label: "Following", value: data.following_count },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-[16px] font-bold tabular-nums leading-none">{s.value}</div>
                  <div className="mt-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold leading-tight">{name}</h2>
            {data.is_private && (
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" /> Private account
              </span>
            )}
            {data.bio && <p className="mt-1.5 text-[13px] text-muted-foreground">{data.bio}</p>}
          </section>

          {!data.is_self && user && (
            <section className="flex gap-2">
              <Button
                className="flex-1 rounded-full"
                variant={data.follow_status ? "secondary" : "default"}
                disabled={busy}
                onClick={() => (data.follow_status ? unfollow() : follow())}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : data.follow_status === "accepted" ? (
                  <UserCheck className="mr-2 h-4 w-4" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {data.follow_status === "accepted"
                  ? "Following"
                  : data.follow_status === "pending"
                  ? "Requested"
                  : "Follow"}
              </Button>
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => navigate(`/chat/${data.id}`)}>
                <MessageCircle className="mr-2 h-4 w-4" /> Message
              </Button>
            </section>
          )}

          {!data.can_see ? (
            <section className="rounded-[24px] border border-dashed border-border/60 p-8 text-center">
              <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-[13px] font-medium">This account is private</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">Follow to see their study stats and posts.</p>
            </section>
          ) : (
            <>
              <section className="grid grid-cols-3 gap-2">
                <StatCard icon={Clock} label="Total" value={fmtMins(data.total_minutes ?? 0)} />
                <StatCard icon={Flame} label="This week" value={fmtMins(data.week_minutes ?? 0)} />
                <StatCard icon={UserCheck} label="Sessions" value={String(data.sessions_count ?? 0)} />
              </section>

              {(data.top_subjects?.length ?? 0) > 0 && (
                <section className="rounded-[24px] border border-border/50 bg-card/60 p-4">
                  <h3 className="font-display text-[12px] font-bold uppercase tracking-widest text-primary/80">
                    Top subjects · 30 days
                  </h3>
                  <div className="mt-3 space-y-2">
                    {data.top_subjects!.map(s => (
                      <div key={s.name} className="flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: s.color || "hsl(var(--primary))" }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
                        <span className="text-[12px] tabular-nums text-muted-foreground">{fmtMins(Number(s.minutes))}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="mb-2 font-display text-[12px] font-bold uppercase tracking-widest text-primary/80">Posts</h3>
                {posts.length === 0 ? (
                  <p className="py-6 text-center text-[12.5px] text-muted-foreground">No posts yet.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {posts.map(p => (
                      <PostThumb key={p.id} path={p.image_url} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <div className="mt-1.5 text-[14px] font-bold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
