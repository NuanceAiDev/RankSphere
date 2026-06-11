import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Mail, Lock, Loader2, Eye, EyeOff, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUpView, setIsSignUpView] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const clearMessages = () => {
    setError(null);
    setSignUpSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
      return;
    }
    clearMessages();
    setLoading(true);

    try {
      if (isSignUpView) {
        // Pass full_name in metadata — DB trigger reads new.raw_user_meta_data->>'full_name'
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) {
          setError(error.message);
        } else if (data.user && data.user.identities && data.user.identities.length === 0) {
          // Supabase User Enumeration Protection returns a fake success with an
          // empty identities array when the email is already registered.
          setError('This email is already registered. Please sign in.');
        } else {
          setSignUpSuccess(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message);
        } else {
          navigate('/');
        }
      }
    } catch (err: any) {
      setError(err?.message ?? 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchView = () => {
    setIsSignUpView((v) => !v);
    setFullName('');
    clearMessages();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 relative overflow-hidden">

      {/* Subtle ambient radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(59,130,246,0.07) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-md relative z-10">

        {/* Brand mark */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center mb-5 shadow-lg shadow-blue-600/25">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
            RankSphere
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            {isSignUpView ? 'Create your account' : 'Sign in to your dashboard'}
          </p>
        </div>

        {/* Glassmorphism card */}
        <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Full Name — sign-up only */}
            {isSignUpView && (
              <div className="space-y-1.5">
                <label htmlFor="signup-name" className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                  <input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignUpView ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error block */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Sign-up success block */}
            {signUpSuccess && (
              <div className="flex items-start gap-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs p-3 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">Check your inbox — a confirmation link has been sent.</span>
              </div>
            )}

            {/* Primary action */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all bg-zinc-100 text-zinc-950 hover:bg-zinc-200 shadow-lg shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSignUpView ? 'Create Account' : 'Sign In'}
            </button>

          </form>

          {/* View toggle */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={switchView}
              disabled={loading}
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              {isSignUpView ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-700 mt-8">
          RankSphere Agency Dashboard
        </p>
      </div>
    </div>
  );
}
