import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  role: string | null;
  name: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, role: null, name: null, loading: true });

/** Fetch RBAC role + display name for a given user id from the profiles table. */
async function fetchProfile(userId: string): Promise<{ role: string | null; name: string | null }> {
  const { data } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', userId)
    .single();
  return {
    role: data?.role ?? null,
    name: data?.full_name ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Supabase is not configured (mock client), skip auth entirely
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Check for an existing session on mount, then fetch the profile
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const { role: userRole, name: userName } = await fetchProfile(currentUser.id);
        setRole(userRole);
        setName(userName);
      }
      setLoading(false);
    });

    // Keep auth state + role + name in sync across tabs and token refreshes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const { role: userRole, name: userName } = await fetchProfile(currentUser.id);
        setRole(userRole);
        setName(userName);
      } else {
        // User logged out — clear role and name
        setRole(null);
        setName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Block children until we know the auth state — prevents the flash of
  // protected content before the session check resolves.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, role, name, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
