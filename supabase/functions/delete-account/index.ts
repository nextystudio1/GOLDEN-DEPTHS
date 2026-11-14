import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return json({ error: "Sign in is required before deleting an account." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  let secretKey: string | undefined;
  try {
    const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (secretKeysRaw) {
      const secretKeys = JSON.parse(secretKeysRaw);
      secretKey = secretKeys.default;
    }
  } catch {
    // Fall back to the legacy server-only key below.
  }
  secretKey ||= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !secretKey) {
    console.error("Account deletion is not configured: server key is unavailable.");
    return json({ error: "Account deletion is temporarily unavailable." }, 503);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authorization.slice("Bearer ".length);
  const { data, error: userError } = await admin.auth.getUser(token);
  if (userError || !data.user) {
    return json({ error: "Your session has expired. Sign in again and retry." }, 401);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error("Account deletion failed:", deleteError.message);
    return json({ error: "The account could not be deleted. Please try again later." }, 500);
  }

  return json({ ok: true });
});
