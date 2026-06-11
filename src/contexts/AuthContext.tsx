import React from 'react';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { type User, type Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { profileService } from '@/services/profile.service';
import { useAppStore } from '@/contexts/store';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshSession: () => Promise<boolean>; // ← new: force session refresh
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAuthenticated: false,
  refreshSession: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { setProfile, setFamily, setFamilyMembers } = useAppStore();
  // Prevent duplicate loadUserData calls
  const loadingUser = useRef(false);

  useEffect(() => {
    // Get initial session from storage
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // React to sign-in / sign-out / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserData(session.user.id);
        } else {
          setProfile(null);
          setFamily(null);
          setFamilyMembers([]);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUserData(userId: string) {
    if (loadingUser.current) return;
    loadingUser.current = true;
    try {
      const profile = await profileService.getProfile(userId);
      setProfile(profile);
      if (profile.family_id) {
        const [family, members] = await Promise.all([
          profileService.getFamily(profile.family_id),
          profileService.getFamilyMembers(profile.family_id),
        ]);
        setFamily(family);
        setFamilyMembers(members);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
      loadingUser.current = false;
    }
  }

  // Called after biometric success to force AuthContext to recognise the session
  async function refreshSession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error || !session) {
        // refreshSession failed — try getSession (token may still be valid)
        const { data: { session: existing } } = await supabase.auth.getSession();
        if (existing) {
          setSession(existing);
          setUser(existing.user);
          await loadUserData(existing.user.id);
          return true;
        }
        return false;
      }
      setSession(session);
      setUser(session.user);
      await loadUserData(session.user.id);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isAuthenticated: !!session,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
