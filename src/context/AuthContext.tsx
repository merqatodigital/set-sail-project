import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConnected } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Real Supabase Auth. Replaces the previous client-side passkey (a value
// compared in the browser, with a public default committed to this repo —
// Postgres never saw it, so every admin write reached Supabase as the same
// `anon` role as any site visitor). Now:
//   - login() is supabase.auth.signInWithPassword
//   - isAuthed reflects a real session + an `admin` row in user_roles
//   - RLS policies (see the admin_auth_and_rls_lockdown migration) check
//     has_role(auth.uid(), 'admin') directly in Postgres
// See TALA.md for how to create the first admin user.
// ---------------------------------------------------------------------------

interface AuthContextValue {
  isAuthed: boolean;
  /** Temporary read-only demo access for partners/investors (no Supabase session). */
  isGuest: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  guestLogin: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function sessionIsAdmin(session: Session | null): Promise<boolean> {
  if (!session?.user) return false;
  if (!isSupabaseConnected() || !supabase) return false;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("role", "admin")
    .maybeSingle();
  return !error && !!data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [isGuest, setIsGuest] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("mt_admin_guest") === "1",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConnected() || !supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data }: { data: { session: Session | null } }) => {
      const admin = await sessionIsAdmin(data.session);
      if (!cancelled) {
        setIsAuthed(admin);
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        const admin = await sessionIsAdmin(session);
        if (!cancelled) setIsAuthed(admin);
      },
    );

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConnected() || !supabase) {
      setError("Supabase is not connected.");
      return false;
    }
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !data.session) {
      setError("Incorrect email or password.");
      return false;
    }
    const admin = await sessionIsAdmin(data.session);
    if (!admin) {
      await supabase.auth.signOut();
      setError("This account does not have admin access.");
      return false;
    }
    setIsAuthed(true);
    return true;
  }, []);

  const logout = useCallback(async () => {
    if (isSupabaseConnected() && supabase) {
      await supabase.auth.signOut();
    }
    if (typeof window !== "undefined") sessionStorage.removeItem("mt_admin_guest");
    setIsGuest(false);
    setIsAuthed(false);
  }, []);

  const guestLogin = useCallback(() => {
    if (typeof window !== "undefined") sessionStorage.setItem("mt_admin_guest", "1");
    setError(null);
    setIsGuest(true);
  }, []);

  const value = useMemo(
    () => ({ isAuthed: isAuthed || isGuest, isGuest, loading, error, login, guestLogin, logout }),
    [isAuthed, isGuest, loading, error, login, guestLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
