import { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsernameState] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(true);
  const isGuestRef = useRef(false);

  const fetchUsername = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        isGuestRef.current = false;
        setIsGuest(false);
        localStorage.removeItem('taskpilot_guest');
        fetchUsername(session.user.id);
      }
      setLoading(false);
    });

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
