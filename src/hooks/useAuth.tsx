import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
interface AuthValue { session: Session | null; user: User | null; loading: boolean; isAdmin: boolean; refreshRole: () => Promise<void>; }
const AuthContext = createContext<AuthValue>({ session: null, user: null, loading: false, isAdmin: false, refreshRole: async () => {} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [isAdmin, setIsAdmin] = useState(false);
  const refreshRole = async () => {
    if (!supabase) { setIsAdmin(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsAdmin(false); return; }
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    setIsAdmin(data?.role === 'admin');
  };
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setLoading(false); void refreshRole(); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next); setLoading(false);
      window.setTimeout(() => { void refreshRole(); }, 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  const value = useMemo(() => ({ session, user: session?.user ?? null, loading, isAdmin, refreshRole }), [session, loading, isAdmin]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);