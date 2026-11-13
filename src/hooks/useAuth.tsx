import { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { readStartupSession } from '@/lib/startup-cache';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  username: string | null;
  /** True until the profile's username has been resolved (prevents a false "set your call sign" prompt). */
  usernameLoading: boolean;
  isGuest: boolean;
  setUsername: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  enterGuestMode: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  username: null,
  usernameLoading: true,
  isGuest: false,
  setUsername: async () => {},
  signOut: async () => {},
  enterGuestMode: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [startup] = useState(() => {
    const key = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
    const session = readStartupSession(key);
    let guest = false;
    let name = 'Guest';
    try {
      guest = !session && localStorage.getItem('taskpilot_guest') === 'true';
      name = localStorage.getItem('taskpilot_guest_username') || name;
    } catch { /* Storage may be unavailable. */ }
    return { session, guest, name };
  });
  const [user, setUser] = useState<User | null>(startup.session?.user ?? null);
  const [session, setSession] = useState<Session | null>(startup.session);
  const [loading, setLoading] = useState(!startup.session && !startup.guest);
  const [username, setUsernameState] = useState<string | null>(startup.guest ? startup.name : null);
  const [isGuest, setIsGuest] = useState(startup.guest);
  const [usernameLoading, setUsernameLoading] = useState(!startup.guest);
  const isGuestRef = useRef(startup.guest);
  const queryClient = useQueryClient();
  const socialCacheOwner = useRef(user?.id);
  useEffect(() => {
    const previous = socialCacheOwner.current;
    if (previous && previous !== user?.id) {
      void queryClient.cancelQueries({ queryKey: ['social', previous] });
      queryClient.removeQueries({ queryKey: ['social', previous] });
    }
    socialCacheOwner.current = user?.id;
  }, [user?.id, queryClient]);

  // Persist IANA timezone for closed-app reminders, including travel/resume.
  useEffect(() => {
    if (!user || isGuest) return;
    let saved: string | null = null;
    let pending = false;
    const sync = async () => {
      if (document.visibilityState === 'hidden' || pending) return;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!timezone || timezone === saved) return;
      pending = true;
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        const { error } = await supabase.from('profiles').update({ timezone }).eq('id', user.id);
        if (!error) saved = timezone;
      } finally { pending = false; }
    };
    const resume = () => { sync().catch(() => {}); };
    resume();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }, [user?.id, isGuest]);

  /**
   * Resolves the profile username. A failed request (offline, transient) must
   * NOT be treated as "no call sign" — otherwise the prompt pops up on refresh
   * for users who already have one. Retries once, then stays in loading state.
   */
  const fetchUsername = async (userId: string, attempt = 0) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      if (attempt < 2) {
        setTimeout(() => fetchUsername(userId, attempt + 1), 800 * (attempt + 1));
        return;
      }
      // Give up quietly: keep the prompt hidden rather than nagging the user.
      setUsernameLoading(true);
      return;
    }

    setUsernameState(data?.username ?? null);
    setUsernameLoading(false);
  };

  useEffect(() => {
    // Check for guest mode in localStorage
    const guestMode = localStorage.getItem('taskpilot_guest');
    if (guestMode === 'true') {
      isGuestRef.current = true;
      setIsGuest(true);
      setUsernameState(localStorage.getItem('taskpilot_guest_username') || 'Guest');
      setUsernameLoading(false);
      setLoading(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        isGuestRef.current = false;
        setIsGuest(false);
        localStorage.removeItem('taskpilot_guest');
        setTimeout(() => fetchUsername(session.user.id), 0);
      } else if (!isGuestRef.current) {
        setUsernameState(null);
        setUsernameLoading(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) { setLoading(false); return; }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        isGuestRef.current = false;
        setIsGuest(false);
        localStorage.removeItem('taskpilot_guest');
        fetchUsername(session.user.id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, []);

  const enterGuestMode = () => {
    localStorage.setItem('taskpilot_guest', 'true');
    localStorage.setItem('taskpilot_guest_username', 'Guest');
    isGuestRef.current = true;
    setIsGuest(true);
    setUsernameState('Guest');
    setUsernameLoading(false);
  };

  const setUsername = async (name: string) => {
    if (isGuest) {
      localStorage.setItem('taskpilot_guest_username', name);
      setUsernameState(name);
      return;
    }
    if (!user) return;
    const { error } = await supabase.from('profiles').upsert({ id: user.id, username: name });
    if (error) {
      throw new Error(
        error.code === '23505' ? 'That username is already taken.' : error.message
      );
    }
    setUsernameState(name);
  };

  const signOut = async () => {
    if (isGuest) {
      isGuestRef.current = false;
      setIsGuest(false);
      setUsernameState(null);
      localStorage.removeItem('taskpilot_guest');
      localStorage.removeItem('taskpilot_guest_username');
      localStorage.removeItem('taskpilot_guest_data');
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, username, usernameLoading, isGuest, setUsername, signOut, enterGuestMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
