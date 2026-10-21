import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// USER ADMIN FUNCTION SETTINGS: allow the portal browser to call this endpoint with its signed-in session.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const allowedModules = [
  "hardware_inventory", "non_asset_inventory", "hardware_dispatch", "support_tickets",
  "remote_desktop", "licenses", "network_voice", "toner_inventory", "toner_transactions",
  "spare_parts", "supplier_payments", "monthly_payments", "it_documents", "handover_records",
  "notification_settings", "handover_settings",
];

// RESPONSE AND SECRET HELPERS: use Supabase's server-only key, never the browser publishable key, for Auth admin work.
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function getSecretKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keyMap = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keyMap) {
    try {
      const parsed = JSON.parse(keyMap) as Record<string, string>;
      if (parsed.default) return parsed.default;
      const first = Object.values(parsed).find((value) => typeof value === "string" && value.length > 0);
      if (first) return first;
    } catch {
      // Fall through to the configuration error below.
    }
  }
  return "";
}

function validUsername(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}

function makePermissions(access: unknown) {
  const source = access && typeof access === "object" && !Array.isArray(access)
    ? access as Record<string, unknown>
    : {};
  const result: Record<string, { view: boolean; edit: boolean }> = {};
  for (const module of allowedModules) {
    if (source[module] === "view") result[module] = { view: true, edit: false };
    if (source[module] === "edit") result[module] = { view: true, edit: true };
  }
  return result;
}

function portalEmail(username: string) {
  // Supabase Auth requires an email-shaped login; portal-created users enter only their username in the UI.
  return `${username}@portal.hpl.invalid`;
}

// AUTHORIZED USER ROUTES: verify the caller is an administrator, then create or update a portal login and profile.
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Use POST for this request." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = getSecretKey();
  if (!supabaseUrl || !secretKey) return json({ error: "Supabase server configuration is incomplete." }, 500);

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token || token === authorization) return json({ error: "Please sign in again, then retry." }, 401);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerData.user) return json({ error: "Your sign-in has expired. Please sign in again." }, 401);

  const { data: callerProfile, error: profileError } = await admin
    .from("portal_profiles")
    .select("is_admin")
    .eq("id", callerData.user.id)
    .maybeSingle();
  if (profileError || !callerProfile?.is_admin) return json({ error: "Only a portal administrator can manage staff users." }, 403);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid request data." }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON request." }, 400);
  }

  const action = body.action;
  if (action !== "create" && action !== "update") return json({ error: "Unknown user action." }, 400);
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (!validUsername(username)) return json({ error: "Use a username with 3–32 lowercase letters, numbers, dots, underscores or hyphens." }, 400);
  if (!fullName || fullName.length > 120) return json({ error: "Enter a full name up to 120 characters." }, 400);

  const permissions = makePermissions(body.access);

  // CREATE: add a confirmed Auth user, then attach a non-admin portal profile with selected module access.
  if (action === "create") {
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8 || password.length > 128) return json({ error: "Password must be 8–128 characters." }, 400);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: portalEmail(username),
      password,
      email_confirm: true,
      user_metadata: { username, full_name: fullName, portal_account: true },
    });
    if (createError || !created.user) return json({ error: createError?.message || "Could not create the login account." }, 400);

    const { error: insertError } = await admin.from("portal_profiles").insert({
      id: created.user.id,
      username,
      full_name: fullName,
      is_admin: false,
      permissions,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: insertError.code === "23505" ? "That username is already in use." : insertError.message }, 400);
    }
    return json({ ok: true, username });
  }

  // UPDATE: change an existing staff profile; keep administrator status unchanged.
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return json({ error: "The selected user ID is invalid." }, 400);
  }
  const { data: existing, error: existingError } = await admin
    .from("portal_profiles")
    .select("id,username,full_name,permissions,is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (existingError || !existing) return json({ error: "Could not find that portal user." }, 404);

  const { error: updateError } = await admin.from("portal_profiles").update({
    username,
    full_name: fullName,
    permissions,
  }).eq("id", userId);
  if (updateError) return json({ error: updateError.code === "23505" ? "That username is already in use." : updateError.message }, 400);

  const { data: targetAuth, error: targetAuthError } = await admin.auth.admin.getUserById(userId);
  let authUpdateError: Error | null = targetAuthError || null;
  if (!authUpdateError && !targetAuth?.user) authUpdateError = new Error("Could not find the login account.");
  if (!authUpdateError && targetAuth?.user) {
    const isManagedLogin = targetAuth.user.user_metadata?.portal_account === true;
    const result = await admin.auth.admin.updateUserById(userId, {
      ...(isManagedLogin ? { email: portalEmail(username), email_confirm: true } : {}),
      user_metadata: { ...targetAuth.user.user_metadata, username, full_name: fullName, ...(isManagedLogin ? { portal_account: true } : {}) },
    });
    authUpdateError = result.error;
  }
  if (authUpdateError) {
    await admin.from("portal_profiles").update({
      username: existing.username,
      full_name: existing.full_name,
      permissions: existing.permissions,
    }).eq("id", userId);
    return json({ error: "Profile changes were rolled back because the login name could not be updated: " + authUpdateError.message }, 400);
  }

  return json({ ok: true, username });
});
