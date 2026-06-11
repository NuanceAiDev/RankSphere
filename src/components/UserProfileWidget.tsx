import React, { useState, useRef, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

/** Derive 1-2 uppercase initials from a full name, falling back to email first char. */
function getInitials(name: string | null, email: string | null | undefined): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

const RoleBadge = ({ role }: { role: string | null }) =>
  role === 'admin' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 uppercase tracking-wider whitespace-nowrap">
      Admin
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 dark:bg-zinc-500/10 dark:text-zinc-400 dark:border-zinc-500/20 uppercase tracking-wider whitespace-nowrap">
      Viewer
    </span>
  );

export function UserProfileWidget() {
  const { user, role, name } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange in AuthContext clears state → ProtectedRoute redirects to /login
  };

  // Close dropdown when clicking anywhere outside the widget
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = name?.trim() || user?.email?.split('@')[0] || 'User';
  const initials = getInitials(name, user?.email);

  return (
    <div ref={containerRef} className="absolute top-6 right-8 z-50">

      {/* ── Minimised pill ─────────────────────────────────────────── */}
      <div
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-full px-4 py-2 shadow-lg shadow-black/5 cursor-pointer select-none"
      >
        {/* Initials avatar */}
        <div className="flex items-center justify-center font-bold text-sm h-9 w-9 rounded-full text-white bg-gradient-to-br from-blue-500 to-blue-600 shadow-inner flex-shrink-0">
          {initials}
        </div>

        {/* Welcome name */}
        <span className="text-sm font-medium text-gray-800 dark:text-zinc-100 whitespace-nowrap">
          {displayName}
        </span>

        {/* Role badge — perfectly vertically centred next to name */}
        <RoleBadge role={role} />
      </div>

      {/* ── Expanded dropdown ──────────────────────────────────────── */}
      {isOpen && (
        <div className="absolute top-12 right-0 mt-2 w-72 p-6 bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-2xl shadow-black/10 transition-all">

          {/* User header */}
          <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-4">
            My Account
          </p>

          <div className="flex items-center gap-4">
            {/* Scaled-up avatar */}
            <div className="flex items-center justify-center font-bold text-base h-12 w-12 rounded-full text-white bg-gradient-to-br from-blue-500 to-blue-600 shadow-inner flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">
                {name?.trim() || displayName}
              </p>
              <p className="text-sm text-gray-500 dark:text-zinc-500 truncate mt-0.5">
                {user?.email}
              </p>
              <div className="mt-2">
                <RoleBadge role={role} />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-100 dark:bg-zinc-800 my-5" />

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
