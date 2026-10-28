import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "https://esm.sh/jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function response(body: BodyInit | null, init: ResponseInit = {}) {
  return new Response(body, { ...init, headers: { ...corsHeaders, ...init.headers } });
}

async function revokeAppleAuthorization(code: string, appleSubject: string): Promise<boolean> {
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const privateKeyPem = Deno.env.get("APPLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const clientId = Deno.env.get("APPLE_CLIENT_ID");
  if (!code || !appleSubject || !teamId || !keyId || !privateKeyPem || !clientId) return false;

  try {
    const key = await importPKCS8(privateKeyPem, "ES256");
    const clientSecret = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: keyId })
      .setIssuer(teamId)
      .setSubject(clientId)
      .setAudience("https://appleid.apple.com")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);
    const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code" }),
    });
    if (!tokenResponse.ok) return false;
    const tokens = await tokenResponse.json();
    if (!tokens.refresh_token || !tokens.id_token) return false;
    const payload = JSON.parse(atob(tokens.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.aud !== clientId || payload.sub !== appleSubject) return false;
    const revokeResponse = await fetch("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, token: tokens.refresh_token, token_type_hint: "refresh_token" }),
    });
    return revokeResponse.ok;
  } catch {
    return false;
  }
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

  const appleIdentity = user.identities?.find((identity) => identity.provider === "apple");
  const hasAppleIdentity = Boolean(appleIdentity || user.app_metadata?.providers?.includes("apple"));
  const appleSubject = appleIdentity?.provider_id || appleIdentity?.identity_data?.sub || "";
  const body = await request.json().catch(() => ({}));
  const code = typeof body.appleAuthorizationCode === "string" && body.appleAuthorizationCode.length <= 4096
    ? body.appleAuthorizationCode : "";
  const appleRevoked = hasAppleIdentity && code ? await revokeAppleAuthorization(code, appleSubject) : false;

  const adminClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  // Permanently remove the auth user so the database foreign keys declared
  // with ON DELETE CASCADE also remove the user's FitMine data.
  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) return response("Unable to delete account", { status: 500 });

  return Response.json({ deleted: true, appleRevocationRequired: hasAppleIdentity && !appleRevoked }, { headers: corsHeaders });
});
