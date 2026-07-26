import type { CmsData } from "@/types/cms";
import {
  buildDefaultData,
  buildDefaultOperations,
  buildFieldNotes,
  FIELD_NOTES_CATEGORIES,
  PRESEEDED_MEDIA_URLS,
} from "./defaultData";
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

export async function loadCms(): Promise<CmsData> {
  try {
    // 1. If Supabase is connected, attempt to pull latest cloud data first
    if (isSupabaseConnected() && supabase) {
      const { data, error } = await (supabase as any)
        .from("cms_data")
        .select("value")
        .eq("key", DB_ROW_KEY)
        .maybeSingle();

      if (!error && data) {
        const row = data as any;
        if (row && row.value) {
          const parsed = row.value as Partial<CmsData>;
          const merged = migrateAndMerge(parsed);
          // Sync local cache with latest cloud truth
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
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

  // Add the permanent Field Notes guide library once, without overwriting
  // any owner-authored articles or categories already in the CMS.
  const savedCategories = Array.isArray(parsed.blogCategories) ? parsed.blogCategories : [];
  merged.blogCategories = [
    ...savedCategories,
    ...FIELD_NOTES_CATEGORIES.filter(
      (category) => !savedCategories.some((saved) => saved.slug === category.slug),
    ),
  ];

  const categoryIdBySlug = new Map(
    merged.blogCategories.map((category) => [category.slug, category.id]),
  );
  const fieldNotes = buildFieldNotes().map((post) => ({
    ...post,
    categoryIds: post.categoryIds.map((categoryId) => {
      const category = FIELD_NOTES_CATEGORIES.find((item) => item.id === categoryId);
      return category ? categoryIdBySlug.get(category.slug) || categoryId : categoryId;
    }),
  }));
  const savedPosts = Array.isArray(parsed.blogPosts) ? parsed.blogPosts : [];
  merged.blogPosts = [
    ...savedPosts,
    ...fieldNotes.filter((post) => !savedPosts.some((saved) => saved.slug === post.slug)),
  ];

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
    };
  }

  return merged;
}

export async function saveCms(data: CmsData): Promise<void> {
  // 1. Sync local storage cache instantly (ensures layout stays in sync in the browser)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

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
// Auth now lives entirely in src/context/AuthContext.tsx via real Supabase
// Auth (supabase.auth.*). The previous client-side passkey (compared in the
// browser, with a public default committed to this repo) has been removed —
// see the admin_auth_and_rls_lockdown migration for the corresponding
// Postgres-side lockdown.
// ---------------------------------------------------------------------------
