// PUBLIC WEBSITE CONFIG: values the browser needs to connect to this Supabase project.
// The Project URL points to the API; the publishable key is safe for browser use when database RLS is enabled.
// Never put a Supabase secret/service-role key, Google OAuth secret, refresh token, or client JSON here.
window.PORTAL_CONFIG = {
  // Supabase Project URL from Project Settings > API.
  supabaseUrl: "https://vjfgzeaoapudtazlwlat.supabase.co",
  // Supabase publishable key (older projects may label this anon/public).
  publishableKey: "sb_publishable_ymYle-IDXWOC3M5vsI-7GQ_9h7JhdMw",
  // Maximum attachment size accepted by the portal UI; the Drive Function also enforces its own limit.
  maxFileBytes: 20 * 1024 * 1024
};
