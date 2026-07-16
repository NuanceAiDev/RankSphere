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

    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          if (isMounted) setUser(session.user);
          
          // Fetch profile data
          const { data, error } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', session.user.id)
            .single();

          if (error) {
            console.error("Profile fetch error:", error.message);
            if (isMounted) setRole('viewer'); // Fallback
          } else if (data && isMounted) {
            setRole(data.role);
            setName(data.full_name);
          }
        } else {
          if (isMounted) {
            setUser(null);
            setRole(null);
            setName(null);
          }
        }
      } catch (err) {
        console.error("Critical Auth Error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // 1. Run initial check
    initializeAuth();

    // 2. Set up listener for future login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // When auth state changes, re-run the initialization to fetch new roles
      initializeAuth();
    });

    // 3. Cleanup function
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Block children until we know the auth state — prevents the flash of
  // protected content before the session check resolves.
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 gap-4">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 dark:text-zinc-400">Loading Authentication...</p>
      </div>
    );
  }

  console.log("Auth State:", { loading, role });

  return (
    <AuthContext.Provider value={{ user, role, name, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
