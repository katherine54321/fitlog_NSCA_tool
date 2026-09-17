/*
 * Public runtime configuration. The Supabase anon key is designed for client
 * use; never put service_role, Apple private keys, or other secrets here.
 * Copy values from `.env.example` during deployment.
 */
window.FITLOG_RUNTIME = {
  supabaseUrl: "https://erttmsqngteoyngohaln.supabase.co",
  supabaseAnonKey: "sb_publishable_sHnUcT4GSJW7TAN2ofA1Xg_svKAqDWP",
  // Keep magic-link sign-in on whichever HTTPS host is serving this PWA.
  authRedirectUrl: "",
};
