// lib/supabase.js
import { createClient } from '@supabase/supabase-js';

// Singleton instance
let supabaseInstance = null;
let supabaseAdminInstance = null;

// Client-side Supabase client (for browser)
export function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'field-service-auth'
        }
      }
    );
  }
  return supabaseInstance;
}

// Admin client for API routes (server-side)
export function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
  }
  return supabaseAdminInstance;
}

// Default export for backward compatibility
export const supabase = getSupabase();