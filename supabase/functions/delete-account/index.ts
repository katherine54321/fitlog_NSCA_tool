import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function response(body: BodyInit | null, init: ResponseInit = {}) {
  return new Response(body, { ...init, headers: { ...corsHeaders, ...init.headers } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return response("ok");
  if (request.method !== "POST") return response("Method not allowed", { status: 405 });

  const authorization = request.headers.get("Authorization");
  if (!authorization) return response("Unauthorized", { status: 401 });

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return response("Unauthorized", { status: 401 });

  const adminClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await adminClient.auth.admin.deleteUser(user.id, true);
  if (error) return response("Unable to delete account", { status: 500 });

  return Response.json({ deleted: true }, { headers: corsHeaders });
});
