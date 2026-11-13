import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";

type Row = { id: string; username: string | null; full_name: string | null; avatar_url: string | null; viewer_status: string | null };

export function FollowListSheet({ userId, kind, onClose, onChanged }: {
  userId: string; kind: "followers" | "following" | null; onClose: () => void; onChanged?: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!kind) return;
    setRows(null);
    supabase.rpc("get_follow_list", { _user_id: userId, _kind: kind }).then(({ data }) => setRows((data as Row[]) ?? []));
  }, [userId, kind]);

  const toggle = async (r: Row) => {
    if (!user) return;
    setBusyId(r.id);
    if (r.viewer_status) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", r.id);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: r.id });
    }
    const { data } = await supabase.from("follows").select("status").eq("follower_id", user.id).eq("following_id", r.id).maybeSingle();
    setRows(prev => prev?.map(x => (x.id === r.id ? { ...x, viewer_status: data?.status ?? null } : x)) ?? null);
    setBusyId(null);
    onChanged?.();
  };

  return (
    <Sheet open={!!kind} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-[24px]">
        <SheetHeader><SheetTitle>{kind === "followers" ? "Followers" : "Following"}</SheetTitle></SheetHeader>
        {rows === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No one here yet.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {rows.map(r => {
              const name = r.full_name || r.username || "Pilot";
              return (
                <li key={r.id} className="flex items-center gap-3 rounded-xl p-2">
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => { onClose(); navigate(`/u/${r.id}`); }}>
                    <UserAvatar src={r.avatar_url} name={name} className="h-10 w-10" />
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold">{r.username ? `@${r.username}` : name}</div>
                      {r.full_name && <div className="truncate text-[12px] text-muted-foreground">{r.full_name}</div>}
                    </div>
                  </button>
                  {user && r.id !== user.id && (
                    <Button size="sm" className="rounded-full" variant={r.viewer_status ? "secondary" : "default"}
                      disabled={busyId === r.id} onClick={() => toggle(r)}>
                      {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> :
                        r.viewer_status === "accepted" ? "Following" : r.viewer_status === "pending" ? "Requested" : "Follow"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
