import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../../config/env.js";

let clientInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return (
    typeof config.supabase.url === "string" &&
    config.supabase.url.trim().length > 0 &&
    typeof config.supabase.serviceRoleKey === "string" &&
    config.supabase.serviceRoleKey.trim().length > 0 &&
    process.env.FORCE_LOCAL_STORAGE !== "true"
  );
}

export function getSupabaseClient(): SupabaseClient {
  if (clientInstance) return clientInstance;

  const supabaseUrl = config.supabase.url;
  const supabaseServiceKey = config.supabase.serviceRoleKey;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase is not configured. Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "");
  clientInstance = createClient(cleanUrl, supabaseServiceKey, {
    global:{fetch:(input,init)=>{
      const timeout=AbortSignal.timeout(Math.max(1000,Number(process.env.SUPABASE_REQUEST_TIMEOUT_MS)||120000));
      return fetch(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,timeout]):timeout});
    }},
    auth: {
      persistSession: false,
    },
  });

  return clientInstance;
}
