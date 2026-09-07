import { createClient } from "@supabase/supabase-js";

const env = import.meta.env ?? {};
const url = (env.VITE_SUPABASE_URL ?? "").trim();
const key = (
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();

function validConfiguration() {
  try {
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))
      return false;
    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !["", "/"].includes(parsed.pathname)
    )
      return false;
    if (/example|your-project|your_supabase/i.test(parsed.hostname))
      return false;
    if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)) return true;
    // Only the public anon JWT belongs in a browser. Never accept service-role keys.
    const pieces = key.split(".");
    if (
      pieces.length !== 3 ||
      !pieces.every((piece) => /^[A-Za-z0-9_-]+$/.test(piece))
    )
      return false;
    const payload = JSON.parse(
      atob(pieces[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return (
      payload.role === "anon" &&
      (!payload.exp || payload.exp * 1000 > Date.now())
    );
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = validConfiguration();
export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
