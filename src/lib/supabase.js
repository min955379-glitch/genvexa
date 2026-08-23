import { createClient } from '@supabase/supabase-js';

// The anon key is intentionally browser-safe. Prefer Vercel environment variables in production.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tcifoqbozmbridqffodr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjaWZvcWJvem1icmlkcWZmb2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NzEwMTcsImV4cCI6MjEwMzA0NzAxN30.TsuiPfpEWGP58ks_ZFXxmmQNERzHw0uODQazspIMD0I';

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    })
  : null;
