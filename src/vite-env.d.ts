/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  /** Cloudflare TallaAgent Worker base URL — the ONLY TALA runtime. */
  readonly VITE_TALA_WORKER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
