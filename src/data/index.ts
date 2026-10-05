import type { Backend } from './backend';
import { DemoBackend } from './demoBackend';
import { SupabaseBackend } from './supabaseBackend';

// If the Supabase keys are set (in a .env file, see docs/SETUP.md) the app uses the real,
// shared database. Otherwise it runs in demo mode with sample data on this device.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function createBackend(): Backend {
  if (url && key) return new SupabaseBackend(url, key);
  return new DemoBackend();
}
