import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

// INPUT: read the downloaded Desktop OAuth client JSON; it is used locally and must stay private.
const clientJsonPath = process.argv[2];
if (!clientJsonPath) {
  console.error("Usage: node migration/connect-personal-drive.mjs <path-to-downloaded-oauth-client-json>");
  process.exit(1);
}

const clientJson = JSON.parse(await readFile(clientJsonPath, "utf8"));
const client = clientJson.installed;
if (!client?.client_id || !client?.client_secret) {
  console.error("Use the JSON file for a Google OAuth Desktop app client.");
  process.exit(1);
}

// PKCE AND STATE: protect the local OAuth callback from forged or intercepted authorization responses.
const state = randomBytes(32).toString("base64url");
const verifier = randomBytes(48).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");

let callbackResolve;
let callbackReject;
const callbackResult = new Promise((resolve, reject) => {
  callbackResolve = resolve;
  callbackReject = reject;
});

// LOCAL CALLBACK SERVER: receive Google's one-time authorization code on this computer.
const server = createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
  if (requestUrl.pathname !== "/") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  if (requestUrl.searchParams.get("state") !== state) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("OAuth state check failed. Close this page and run the setup again.");
    callbackReject(new Error("Google OAuth state check failed."));
    return;
  }
  const error = requestUrl.searchParams.get("error");
  if (error) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Google Drive permission was not granted. You can close this page.");
    callbackReject(new Error("Google OAuth was cancelled: " + error));
    return;
  }
  const code = requestUrl.searchParams.get("code");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Google did not return an authorization code. You can close this page.");
    callbackReject(new Error("Google did not return an authorization code."));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end("<!doctype html><html><body><h2>Google Drive connected</h2><p>Return to PowerShell to finish setup. You can close this tab.</p></body></html>");
  callbackResolve(code);
});

server.listen(0, "127.0.0.1");
await new Promise((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not start the local OAuth callback.");
const redirectUri = "http://127.0.0.1:" + address.port;

// GOOGLE CONSENT: request permission only for Drive files created by this portal app.
const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authorizationUrl.search = new URLSearchParams({
  client_id: client.client_id,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/drive.file",
  access_type: "offline",
  prompt: "consent",
  include_granted_scopes: "true",
  state,
  code_challenge: challenge,
  code_challenge_method: "S256",
}).toString();

console.log("A browser window will open. Sign in to the personal Google account that should own portal uploads.");
console.log("If it does not open, copy this URL into your browser:");
console.log(authorizationUrl.toString());

// OPEN BROWSER: start the account authorization page automatically when possible.
try {
  if (process.platform === "win32") {
    const browser = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", authorizationUrl.toString()], { detached: true, stdio: "ignore" });
    browser.once("error", () => {});
    browser.unref();
  } else if (process.platform === "darwin") {
    const browser = spawn("open", [authorizationUrl.toString()], { detached: true, stdio: "ignore" });
    browser.once("error", () => {});
    browser.unref();
  } else {
    const browser = spawn("xdg-open", [authorizationUrl.toString()], { detached: true, stdio: "ignore" });
    browser.once("error", () => {});
    browser.unref();
  }
} catch {
  // The URL is printed above if a browser cannot be opened automatically.
}

// TOKEN EXCHANGE: trade the callback code for a refresh token for the Supabase Drive Function.
const timeout = setTimeout(() => callbackReject(new Error("OAuth timed out. Run this command again and finish Google sign-in within five minutes.")), 5 * 60 * 1000);
try {
  const code = await callbackResult;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: client.client_id,
      client_secret: client.client_secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error("Google token exchange failed: " + (tokenData.error_description || tokenData.error || tokenResponse.status));
  }
  if (!tokenData.refresh_token) {
    throw new Error("Google did not return a refresh token. Revoke this app in your Google Account permissions, then run this setup again.");
  }

  // DESTINATION FOLDER: create the private folder and print the values to save as Supabase Function secrets.
  const folderResponse = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + tokenData.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "HPL IT Portal Files",
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const folderData = await folderResponse.json();
  if (!folderResponse.ok || !folderData.id) {
    throw new Error("Google authorized the account, but could not create the portal folder: " + (folderData.error?.message || folderResponse.status));
  }

  console.log("");
  console.log("Setup complete. Add these values in Supabase Dashboard > Edge Functions > Secrets:");
  console.log("GOOGLE_OAUTH_CLIENT_ID=" + client.client_id);
  console.log("GOOGLE_OAUTH_CLIENT_SECRET=" + client.client_secret);
  console.log("GOOGLE_OAUTH_REFRESH_TOKEN=" + tokenData.refresh_token);
  console.log("GOOGLE_DRIVE_FOLDER_ID=" + folderData.id);
  console.log("");
  console.log("Keep these values private. The folder was created in the selected personal Google Drive.");
} finally {
  clearTimeout(timeout);
  server.close();
}
