import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const StaffAuthContext = createContext(null);

export function StaffAuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Role is only trusted if it comes from the DB profile, NOT from user selection.
  // sessionStorage is used only as a hint for UX convenience.
  const [role, setRole]       = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setRole(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        if (data.is_terminated) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          setRole(null);
          sessionStorage.removeItem('staff_role');
          return;
        }
        setProfile(data);
        if (data.role) {
          setRole(data.role);
          sessionStorage.setItem('staff_role', data.role);
        } else {
          setRole(null);
          sessionStorage.removeItem('staff_role');
        }
      }
    } catch (err) {
      console.error('[StaffAuth] Profile fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('staff_role');
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  // selectRole is only for UI hints AFTER authentication - the real role check
  // always comes from the DB profile fetched in fetchProfile.
  const selectRole = (r) => {
    // Only set if DB hasn't given us a real role yet (e.g., still loading)
    if (!role) {
      sessionStorage.setItem('staff_role', r);
    }
  };

  return (
    <StaffAuthContext.Provider value={{ user, profile, loading, role, signIn, signOut, selectRole }}>
      {children}
    </StaffAuthContext.Provider>
  );
}

export const useStaffAuth = () => {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error('useStaffAuth must be inside StaffAuthProvider');
  return ctx;
};
