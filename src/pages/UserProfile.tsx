import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

const displayName = (p: Profile) => p.full_name || p.username || "Pilot";

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("id, username, full_name, bio, avatar_url")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setProfile((data as Profile) ?? null);
        setLoading(false);
      });
  }, [userId]);

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header className="flex items-center gap-2 px-3 py-3 border-b border-border/60">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">Profile</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : !profile ? (
        <p className="text-center text-sm text-muted-foreground py-16">Profile not found.</p>
      ) : (
        <div className="flex flex-col items-center gap-4 p-6">
          <Avatar className="w-24 h-24">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={displayName(profile)} />
            <AvatarFallback className="text-2xl">
              {displayName(profile).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-xl font-semibold">{displayName(profile)}</h2>
            {profile.username && (
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            )}
          </div>
          {profile.bio && (
            <p className="text-sm text-center text-muted-foreground max-w-sm">{profile.bio}</p>
          )}
          {user && user.id !== profile.id && (
            <Button className="rounded-full px-6" onClick={() => navigate(`/chat/${profile.id}`)}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
