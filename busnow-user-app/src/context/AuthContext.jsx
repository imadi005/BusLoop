import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getStaffProfile = async (userId) => {
    const { data, error } = await supabase
      .from('staff')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  };

  const fetchProfile = async (userId) => {
    try {
      const staffProfile = await getStaffProfile(userId);
      if (staffProfile) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('role', 'passenger')
        .maybeSingle();
      setProfile(data || null);
    } catch (err) {
      console.warn('[AuthContext] Profile fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const staffProfile = data.user ? await getStaffProfile(data.user.id) : null;
    if (staffProfile) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      throw new Error('This is a staff account. Please sign in from the staff app.');
    }

    if (data.user) await fetchProfile(data.user.id);
    return data;
  };

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;

    // Safety-net: DB trigger handle_new_user() creates the row automatically.
    // We also attempt a manual upsert in case of any timing/trigger issues.
    if (data.user) {
      try {
        await supabase.from('users').upsert(
          { id: data.user.id, email, full_name: fullName, role: 'passenger' },
          { onConflict: 'id', ignoreDuplicates: false }
        );
      } catch (e) {
        console.warn('[AuthContext] Safety-net upsert:', e?.message);
      }
    }
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id).select().single();
    if (error) throw error;
    setProfile(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
