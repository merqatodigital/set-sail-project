// Authentication context resolved server-side.
// Every protected route receives this after middleware runs.

export interface AuthContext {
  /** Whether the request is authenticated. */
  authenticated: boolean;
  /** Supabase auth user ID (uuid). */
  userId: string | null;
  /** Resolved tenant ID from tenant_members table. */
  tenantId: string | null;
  /** User's role within the tenant: 'owner' | 'admin' | 'staff'. */
  role: string | null;
}
