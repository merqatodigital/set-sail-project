import type { CmsData } from "@/types/cms";
import { buildDefaultData, buildDefaultOperations, PRESEEDED_MEDIA_URLS } from "./defaultData";
import { supabase, isSupabaseConnected } from "./supabase";

// ---------------------------------------------------------------------------
// Repository layer — Flawless Supabase & Lovable Cloud integration
// ---------------------------------------------------------------------------
// Reads/writes are dual-synchronized:
//   1. Offline/fallback mode → writes to localStorage (instant paint on render).
//   2. Online/Supabase mode  → asynchronously pushes to Supabase Cloud on change,
//      and lazily synchronizes the cloud database on initial mount.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "marina-terrace-cms-v1";
const DB_ROW_KEY = "marina_terrace_payload";

/**
 * Synchronous, cache-only read — no network. Used to paint the site
 * instantly from whatever was cached on a previous visit while `loadCms()`
 * revalidates in the background, instead of blocking every page load
 * behind a network round-trip.
 */
export function loadCmsCached(): CmsData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrateAndMerge(JSON.parse(raw) as Partial<CmsData>);
  } catch {
    return null;
  }
}

/**
 * Cache writes are best-effort: inline image data can exceed the browser's
 * storage quota, and a thrown QuotaExceededError must never break a save or
 * take the page down.
 */
function writeCache(data: CmsData) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Local cache write skipped (storage quota).", err);
  }
}

export async function loadCms(): Promise<CmsData> {
  try {
    // 1. If Supabase is connected, attempt to pull latest cloud data first
    if (isSupabaseConnected() && supabase) {
      const { data, error } = await (supabase as any)
        .from("cms_data")
        .select("value")
        .eq("key", DB_ROW_KEY)
        // Cap the request at 6s — on a flaky mobile connection an un-timed
        // query could hang indefinitely and leave the whole site stuck on
        // the "Loading Marina Terrace…" spinner.
        .abortSignal(AbortSignal.timeout(6000))
        .maybeSingle();

      if (!error && data) {
        const row = data as any;
        if (row && row.value) {
          const parsed = row.value as Partial<CmsData>;
          const merged = migrateAndMerge(parsed);
          // Sync local cache with latest cloud truth
          writeCache(merged);
          return merged;
        }
      }
    }

    // 2. Fallback to localStorage cache
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = buildDefaultData();
      await saveCms(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<CmsData>;
    return migrateAndMerge(parsed);
  } catch (err) {
    console.error("Failed to load CMS data, resetting to defaults", err);
    const fresh = buildDefaultData();
    await saveCms(fresh);
    return fresh;
  }
}

// Merges saved data with the current default schema so returning users
// automatically receive new sections/fields introduced by future updates,
// without losing any content they've already customized.
function migrateAndMerge(parsed: Partial<CmsData>): CmsData {
  const defaults = buildDefaultData();
  const merged: CmsData = { ...defaults, ...parsed } as CmsData;

  // Deep-merge homepage so new top-level keys (facilities, focus, etc.) appear
  if (parsed.homepage) {
    merged.homepage = {
      ...defaults.homepage,
      ...parsed.homepage,
      hero: { ...defaults.homepage.hero, ...(parsed.homepage.hero || {}) },
      kitchen: { ...defaults.homepage.kitchen, ...(parsed.homepage.kitchen || {}) },
      focus: { ...defaults.homepage.focus, ...(parsed.homepage.focus || {}) },
      stay: { ...defaults.homepage.stay, ...(parsed.homepage.stay || {}) },
      facilities: (parsed.homepage as any).facilities
        ? {
            ...defaults.homepage.facilities,
            ...(parsed.homepage as any).facilities,
            // Ensure every legacy item has the new `visible` flag
            items: ((parsed.homepage as any).facilities.items || []).map((it: any) => ({
              visible: true,
              ...it,
            })),
          }
        : defaults.homepage.facilities,
      speed: {
        ...defaults.homepage.speed,
        ...((parsed.homepage as any).speed || {}),
      },
      rooms: (parsed.homepage as any).rooms || defaults.homepage.rooms,
    };

    // Guarantee every new connection-setting field exists even if the saved
    // `speed` object predates this schema addition (partial spread above
    // already handles most of this, but keeps intent explicit & documented).

    // Ensure sectionOrder always contains every current SectionKey
    const currentKeys = defaults.homepage.sectionOrder.map((s) => s.key);
    const savedOrder = parsed.homepage.sectionOrder || [];
    const missing = defaults.homepage.sectionOrder.filter(
      (def) => !savedOrder.some((s) => s.key === def.key),
    );
    merged.homepage.sectionOrder = [
      ...savedOrder.filter((s) => currentKeys.includes(s.key)),
      ...missing,
    ].map((s, i) => ({ ...s, order: i }));
  }

  // Backfill preseeded image URLs onto any media entries that still have
  // an empty URL — this lets returning users automatically pick up new
  // default hero/section images without wiping their custom content.
  if (Array.isArray(merged.media)) {
    merged.media = merged.media.map((m) =>
      !m.url && PRESEEDED_MEDIA_URLS[m.id] ? { ...m, url: PRESEEDED_MEDIA_URLS[m.id] } : m,
    );
  }

  // Merge packages: keep saved packages, add any new defaults that are missing
  if (Array.isArray(merged.packages)) {
    const savedPkgNames = merged.packages.map((p: any) => p.name);
    const missingPkgs = defaults.packages.filter((p) => !savedPkgNames.includes(p.name));
    if (missingPkgs.length > 0) {
      merged.packages = [...merged.packages, ...missingPkgs];
    }
  }

  // Ensure operations block exists (added later in the schema)
  const defaultOps = buildDefaultOperations();
  const savedOps = (parsed as any).operations || {};
  merged.operations = {
    guests: savedOps.guests || defaultOps.guests,
    bookings: savedOps.bookings || defaultOps.bookings,
    tours: savedOps.tours || defaultOps.tours,
    tourBookings: savedOps.tourBookings || defaultOps.tourBookings,
    staff: savedOps.staff || defaultOps.staff,
    shifts: savedOps.shifts || defaultOps.shifts,
    payRecords: savedOps.payRecords || defaultOps.payRecords,
    payments: savedOps.payments || defaultOps.payments,
    motorbikes: savedOps.motorbikes || defaultOps.motorbikes,
    motorbikeRentals: savedOps.motorbikeRentals || defaultOps.motorbikeRentals,
    menuItems: savedOps.menuItems || defaultOps.menuItems,
    foodOrders: savedOps.foodOrders || defaultOps.foodOrders,
    guestMessages: savedOps.guestMessages || defaultOps.guestMessages,
  };

  // Deep-merge settings so new fields (whatsapp, etc.) appear
  if (parsed.settings) {
    merged.settings = {
      ...defaults.settings,
      ...parsed.settings,
      contact: {
        ...defaults.settings.contact,
        ...(parsed.settings.contact || {}),
        social: {
          ...defaults.settings.contact.social,
          ...((parsed.settings.contact as any)?.social || {}),
        },
      },
      seo: { ...defaults.settings.seo, ...(parsed.settings.seo || {}) },
      whatsapp: {
        ...defaults.settings.whatsapp,
        ...((parsed.settings as any).whatsapp || {}),
        chatbot: {
          ...defaults.settings.whatsapp.chatbot,
          ...((parsed.settings as any).whatsapp?.chatbot || {}),
        },
      },
      theme: {
        ...defaults.settings.theme,
        ...((parsed.settings as any).theme || {}),
        fonts: {
          ...defaults.settings.theme.fonts,
          ...((parsed.settings as any).theme?.fonts || {}),
        },
        colors: {
          ...defaults.settings.theme.colors,
          ...((parsed.settings as any).theme?.colors || {}),
        },
        buttons: {
          ...defaults.settings.theme.buttons,
          ...((parsed.settings as any).theme?.buttons || {}),
        },
        ui: { ...defaults.settings.theme.ui, ...((parsed.settings as any).theme?.ui || {}) },
      },
      tala: {
        ...defaults.settings.tala,
        ...((parsed.settings as any).tala || {}),
      },
      financial: {
        ...defaults.settings.financial,
        ...((parsed.settings as any).financial || {}),
      },
    };
  }

  return merged;
}

export async function saveCms(data: CmsData): Promise<void> {
  // 1. Sync local storage cache instantly (ensures layout stays in sync in the browser)
  writeCache(data);

  // 2. If Supabase is connected, asynchronously upload the data payload to the cloud
  if (isSupabaseConnected() && supabase) {
    try {
      await (supabase as any).from("cms_data").upsert({
        key: DB_ROW_KEY,
        value: data,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to sync CMS update to Supabase Cloud:", err);
    }
  }
}

export async function resetCms(): Promise<CmsData> {
  const fresh = buildDefaultData();
  await saveCms(fresh);
  return fresh;
}

// ---------------------------------------------------------------------------
// Auth (temporary passkey)
// ---------------------------------------------------------------------------
// This is intentionally simple: a passkey stored in localStorage compared on
// the client. It exists so the owner can access /admin today without any
// backend. To upgrade to Supabase Auth later:
//   1. Replace `checkPasskey` with `supabase.auth.signInWithPassword(...)`
//   2. Replace `isAdminAuthed` with a Supabase session check
//   3. Keep the same `AuthContext` shape so no UI changes are required.
// ---------------------------------------------------------------------------

const PASSKEY_STORAGE_KEY = "marina-terrace-admin-passkey";
const SESSION_KEY = "marina-terrace-admin-session";
const ATTEMPT_KEY = "marina-terrace-admin-attempts";
const LOCKOUT_KEY = "marina-terrace-admin-lockout-until";
export const DEFAULT_PASSKEY = "5309";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export function getStoredPasskey(): string {
  return window.localStorage.getItem(PASSKEY_STORAGE_KEY) || DEFAULT_PASSKEY;
}

export function setStoredPasskey(passkey: string) {
  window.localStorage.setItem(PASSKEY_STORAGE_KEY, passkey);
}

export function getRemainingLockoutMs(): number {
  const until = Number(window.localStorage.getItem(LOCKOUT_KEY) || 0);
  return Math.max(0, until - Date.now());
}

export function clearAuthLockout() {
  window.localStorage.removeItem(ATTEMPT_KEY);
  window.localStorage.removeItem(LOCKOUT_KEY);
}

export function registerFailedAttempt(): number {
  const nextAttempts = Number(window.localStorage.getItem(ATTEMPT_KEY) || 0) + 1;
  window.localStorage.setItem(ATTEMPT_KEY, String(nextAttempts));
  if (nextAttempts >= MAX_ATTEMPTS) {
    window.localStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
    window.localStorage.setItem(ATTEMPT_KEY, "0");
    return LOCKOUT_MS;
  }
  return 0;
}

export function checkPasskey(input: string): boolean {
  return input.trim() === getStoredPasskey();
}

export function setAdminSession(active: boolean) {
  if (active) window.sessionStorage.setItem(SESSION_KEY, "1");
  else window.sessionStorage.removeItem(SESSION_KEY);
}

export function isAdminAuthed(): boolean {
  return window.sessionStorage.getItem(SESSION_KEY) === "1";
}
