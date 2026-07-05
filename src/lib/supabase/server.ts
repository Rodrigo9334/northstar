import { createClient } from "@supabase/supabase-js";

export function getSupabaseAuthContext(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");

  if (!supabaseUrl || !supabasePublishableKey || !accessToken) {
    return null;
  }

  return {
    accessToken,
    supabase: createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    })
  };
}
