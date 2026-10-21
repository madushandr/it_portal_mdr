import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "content-disposition, content-type",
};
const allowedModules = new Set([
  "hardware_inventory","non_asset_inventory","hardware_dispatch","support_tickets","remote_desktop",
  "licenses","network_voice","toner_inventory","toner_transactions","spare_parts","supplier_payments",
  "monthly_payments","it_documents","handover_records","notification_settings","handover_settings",
]);
const maxBytes = 20 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "image/jpeg","image/png","image/gif","image/webp","image/heic",
  "application/pdf","text/plain","text/csv",
  "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
async function getGoogleAccessToken() {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Personal Google Drive OAuth secrets are not configured in Supabase.");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const tokenData = await response.json();
  if (!response.ok || !tokenData.access_token) {
    throw new Error("Google could not refresh the personal Drive token: " + (tokenData.error_description || tokenData.error || response.status));
  }
  return tokenData.access_token as string;
}
function can(profile: Record<string, unknown>, module: string, action: "view" | "edit") {
  if (profile.is_admin === true) return true;
  const permissions = profile.permissions && typeof profile.permissions === "object" ? profile.permissions as Record<string, Record<string, unknown>> : {};
  return permissions[module]?.[action] === true;
}
function safeFilename(name: string) {
  return name.replace(/[\\/\r\n"]/g, "_").slice(0, 180) || "download";
}
async function driveCall(url: string, token: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: "Bearer " + token },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error("Google Drive returned " + response.status + (detail ? ": " + detail.slice(0, 500) : ""));
  }
  return response;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST for Drive actions." }, 405);
  try {
    const authorization = req.headers.get("Authorization") || "";
    const bearer = authorization.match(/^Bearer\s+(.+)$/i);
    if (!bearer) return json({ error: "Sign in to the portal first." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    let publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    if (!publishableKey) {
      try {
        const keyMap = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
        publishableKey = keyMap.default;
      } catch (_) {
        publishableKey = "";
      }
    }
    if (!supabaseUrl || !publishableKey) return json({ error: "Supabase function settings are incomplete." }, 500);
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const authResult = await userClient.auth.getUser(bearer[1]);
    const user = authResult.data.user;
    if (authResult.error || !user) return json({ error: "Your portal session has expired. Sign in again." }, 401);
    const profileResult = await userClient.from("portal_profiles")
      .select("id,username,full_name,is_admin,permissions")
      .eq("id", user.id).maybeSingle();
    if (profileResult.error || !profileResult.data) return json({ error: "This account has no portal profile." }, 403);
    const profile = profileResult.data as Record<string, unknown>;

    const contentType = req.headers.get("content-type") || "";
    let action = "";
    let module = "";
    let recordId = "";
    let file: File | null = null;
    let fileId = "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      action = String(form.get("action") || "");
      module = String(form.get("module") || "");
      recordId = String(form.get("recordId") || "");
      const candidate = form.get("file");
      if (candidate instanceof File) file = candidate;
    } else {
      const body = await req.json();
      action = String(body.action || "");
      fileId = String(body.fileId || "");
    }

    if (action === "upload") {
      if (!file || !recordId || !allowedModules.has(module)) return json({ error: "A valid module, record and file are required." }, 400);
      if (!can(profile, module, "edit") || !can(profile, module, "view")) return json({ error: "You do not have permission to attach files to this module." }, 403);
      if (file.size <= 0 || file.size > maxBytes) return json({ error: "File must be smaller than 20 MB." }, 413);
      if (!allowedMimeTypes.has(file.type)) return json({ error: "This file type is not allowed. Use an image, PDF, Word, Excel, CSV or text file." }, 415);
      const recordResult = await userClient.from("portal_records").select("id").eq("id", recordId).eq("module", module).maybeSingle();
      if (recordResult.error || !recordResult.data) return json({ error: "The record was not found or is not accessible." }, 404);
      const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");
      if (!folderId) return json({ error: "The Google Drive destination folder is not configured." }, 500);

      const token = await getGoogleAccessToken();
      const filename = safeFilename(file.name);
      const mimeType = file.type || "application/octet-stream";
      const start = await driveCall(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size",
        token,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": mimeType,
            "X-Upload-Content-Length": String(file.size),
          },
          body: JSON.stringify({ name: filename, mimeType, parents: [folderId] }),
        },
      );
      const uploadUrl = start.headers.get("Location");
      if (!uploadUrl) return json({ error: "Google Drive did not return an upload session." }, 502);
      const uploaded = await driveCall(uploadUrl, token, { method: "PUT", headers: { "Content-Type": mimeType }, body: file });
      const driveFile = await uploaded.json();
      const metadata = await userClient.from("portal_files").insert({
        record_id: recordId,
        module,
        drive_file_id: driveFile.id,
        original_name: filename,
        mime_type: mimeType,
        size_bytes: file.size,
        created_by: user.id,
      }).select("id,original_name,size_bytes").single();
      if (metadata.error) {
        await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(driveFile.id), {
          method: "DELETE",
          headers: { Authorization: "Bearer " + token },
        });
        return json({ error: "The file uploaded, but the portal could not save its record: " + metadata.error.message }, 500);
      }
      return json({ success: true, file: metadata.data });
    }

    if (action === "download" || action === "delete") {
      if (!fileId) return json({ error: "A file ID is required." }, 400);
      const lookup = await userClient.from("portal_files")
        .select("id,module,drive_file_id,original_name,mime_type,size_bytes,record_id")
        .eq("id", fileId).maybeSingle();
      if (lookup.error || !lookup.data) return json({ error: "File not found or you do not have access." }, 404);
      const item = lookup.data;
      const permission = action === "download" ? "view" : "edit";
      if (!can(profile, item.module, permission)) return json({ error: "You do not have permission to access this file." }, 403);
      const token = await getGoogleAccessToken();
      const driveUrl = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(item.drive_file_id);
      if (action === "delete") {
        const deleted = await fetch(driveUrl, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
        if (!deleted.ok && deleted.status !== 404) {
          const detail = await deleted.text();
          return json({ error: "Google Drive could not delete the file: " + detail.slice(0, 300) }, 502);
        }
        const removed = await userClient.from("portal_files").delete().eq("id", item.id);
        if (removed.error) return json({ error: "Drive file deleted, but portal metadata could not be removed: " + removed.error.message }, 500);
        return json({ success: true });
      }
      const downloaded = await driveCall(driveUrl + "&alt=media", token, { method: "GET" });
      return new Response(downloaded.body, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": item.mime_type || "application/octet-stream",
          "Content-Disposition": 'attachment; filename="' + safeFilename(item.original_name) + '"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    return json({ error: "Unknown action. Use upload, download or delete." }, 400);
  } catch (error) {
    console.error("personal-drive-files error:", error instanceof Error ? error.message : String(error));
    return json({ error: error instanceof Error ? error.message : "Unexpected Drive service error." }, 500);
  }
});
