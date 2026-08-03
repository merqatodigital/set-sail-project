// ---------------------------------------------------------------------------
// Marina Terrace — CMS Data Types
// ---------------------------------------------------------------------------
// This file defines the full content shape for the site. Everything rendered
// on the public site is driven by this data, which is persisted through the
// `src/lib/storage.ts` repository layer. That layer is intentionally written
// as an async "repository" so it can be swapped for real Supabase queries
// later without touching any UI code. See src/lib/storage.ts for details.
// ---------------------------------------------------------------------------

export type SectionKey =
  | "hero"
  | "features"
  | "workspace"
  | "kitchen"
  | "facilities"
  | "speed"
  | "rooms"
  | "focus"
  | "stay"
  | "pricing"
  | "testimonials"
  | "faqs"
  | "cta";

export interface SectionVisibility {
  key: SectionKey;
  label: string;
  visible: boolean;
  order: number;
}

export interface FeatureItem {
  id: string;
  icon: string; // lucide icon name
  title: string;
  description: string;
}

export interface HeroContent {
  eyebrow: string;
  headline: string;
  subtext: string;
  location: string;
  primaryButtonLabel: string;
  primaryButtonLink: string;
  secondaryButtonLabel: string;
  secondaryButtonLink: string;
  imageId: string;
}

export interface KitchenContent {
  eyebrow: string;
  title: string;
  paragraph: string;
  features: FeatureItem[];
  imageId: string;
}

export interface FocusContent {
  eyebrow: string;
  title: string;
  paragraph: string;
  features: FeatureItem[];
  imageId: string;
}

export interface StayContent {
  eyebrow: string;
  title: string;
  paragraph: string;
  features: FeatureItem[];
  galleryImageIds: string[];
}

export interface FacilityItem {
  id: string;
  icon: string;
  name: string;
  order: number;
  visible: boolean;
}

export interface RoomItem {
  id: string;
  name: string;
  capacity: string;
  size: string;
  view: string;
  description: string;
  price: string;
  imageKey: string;
  visible: boolean;
  order: number;
}

export interface FacilitiesContent {
  eyebrow: string;
  title: string;
  paragraph: string;
  items: FacilityItem[];
}

export interface SpeedContent {
  eyebrow: string;
  title: string;
  paragraph: string;
  // Baseline values shown as the "typical" reading. If liveTest is enabled,
  // the section will run a browser-based download test on load and animate
  // the gauge to the measured value; otherwise it animates to these numbers.
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  provider: string; // e.g. "Starlink Business"
  location: string; // e.g. "Poblacion, San Vicente"
  liveTest: boolean; // if true, run an actual browser download test
  lastMeasuredAt: string; // ISO — when the owner last ran a test

  // -------------------------------------------------------------------
  // Connection / ISP settings — these change over time (plan upgrades,
  // provider switches, added dishes, failover swaps) so every field here
  // is editable from the admin "Internet Speed" page.
  // -------------------------------------------------------------------
  planName: string; // e.g. "Starlink Business", "Starlink Roam"
  dishCount: number; // number of Starlink dishes/kits in the redundancy setup
  hasFailover: boolean; // show the failover badge on-site
  failoverProvider: string; // e.g. "Smart 5G", "Globe LTE"
  failoverType: string; // e.g. "5G", "4G/LTE", "Secondary Starlink"
  redundancyNote: string; // e.g. "Auto-switches in under 2 seconds"
  accountReference: string; // internal note — kit/account number, not shown publicly
  supportContact: string; // ISP support phone/email for the owner's reference
  providerNotes: string; // free-form admin notes about the current setup
}

export interface WorkspaceContent {
  eyebrow: string;
  title: string;
  paragraph: string;
  imageId: string;
  highlights: FeatureItem[];
}

export interface HomepageContent {
  sectionOrder: SectionVisibility[];
  hero: HeroContent;
  features: FeatureItem[];
  kitchen: KitchenContent;
  focus: FocusContent;
  stay: StayContent;
  facilities: FacilitiesContent;
  speed: SpeedContent;
  rooms: RoomItem[];
  ctaTitle: string;
  ctaSubtext: string;
  ctaButtonLabel: string;
}

export interface PricingFeatureLine {
  id: string;
  text: string;
}

export interface PricingPackage {
  id: string;
  name: string;
  price: string;
  period: string;
  icon: string;
  description: string;
  features: PricingFeatureLine[];
  buttonLabel: string;
  featured: boolean;
  order: number;
}

export interface PackageItem {
  id: string;
  name: string;
  price: number;        // 1-person price (PHP)
  priceTwo: number;     // 2-person price (PHP)
  period: string;       // "7 days"
  icon: string;         // lucide icon name
  description: string;
  features: PricingFeatureLine[];
  includedTourIds: string[];
  includeMotorbike: boolean;
  includeAirportTransfer: boolean;
  dailyCoffeeCount: number;
  dailyMealCount: number;
  buttonLabel: string;
  featured: boolean;
  order: number;
}

export interface GalleryImage {
  id: string;
  mediaId: string;
  caption: string;
  order: number;
}

export interface VideoItem {
  id: string;
  title: string;
  type: "youtube" | "vimeo" | "upload";
  url: string;
  order: number;
}

export type BlogStatus = "draft" | "published" | "scheduled";

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string; // rich HTML
  featuredImageId: string;
  images: string[];
  categoryIds: string[];
  tags: string[];
  status: BlogStatus;
  publishAt: string; // ISO date
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
  updatedAt: string;
}

export interface Testimonial {
  id: string;
  name: string;
  country: string;
  occupation: string;
  rating: number;
  quote: string;
  imageId: string;
  order: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  order: number;
}

export interface ContactInfo {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  googleMapsLink: string;
  businessHours: string;
  social: {
    instagram: string;
    facebook: string;
    tiktok: string;
    youtube: string;
  };
}

export interface SeoSettings {
  siteTitle: string;
  homeTitle: string;
  homeDescription: string;
  keywords: string;
  ogImageId: string;
}

// ---------------------------------------------------------------------------
// WhatsApp Settings — central source of truth for every WhatsApp button on
// the site. Includes future-ready fields for chatbot integration (Twilio /
// WhatsApp Business Cloud API). Today only the number + labels are wired in;
// the chatbot section is stored but presented as "Coming Soon" in the UI.
// ---------------------------------------------------------------------------
export interface WhatsAppNumber {
  id: string;
  label: string; // e.g. "Bookings", "General", "Kitchen"
  number: string; // display, with country code, e.g. "+63 967 206 2327"
  isPrimary: boolean;
}

export interface WhatsAppSettings {
  numbers: WhatsAppNumber[];
  defaultMessage: string; // pre-filled when a visitor opens WhatsApp
  bookingMessage: string; // used from pricing buttons — {package} token
  showFloatingButton: boolean; // toggle the site-wide floating WhatsApp
  showInNavbar: boolean; // toggle WhatsApp CTA in the top nav
  businessHoursNote: string; // e.g. "Rooftop replies 8am–8pm PHT"
  // Future chatbot integration (stored but not yet active)
  chatbot: {
    enabled: boolean;
    provider: "none" | "twilio" | "whatsapp-cloud" | "custom";
    apiKey: string;
    webhookUrl: string;
    autoReplyMessage: string;
  };
}

// ---------------------------------------------------------------------------
// Theme / Appearance — every visual token the owner can customize from admin.
// Defaults match the current hardcoded palette exactly, so enabling this
// feature causes zero visual change until the owner edits a value.
// ---------------------------------------------------------------------------
export interface ThemeSettings {
  fonts: {
    serif: string; // heading font, e.g. "Fraunces"
    sans: string; // body font, e.g. "Inter"
  };
  colors: {
    accent: string; // gold — buttons, icons, highlights
    accentHover: string; // darker gold — button hover
    background: string; // page cream background
    surface: string; // white card surface
    text: string; // primary charcoal text
    darkBg: string; // dark CTA/footer background
    darkAlt: string; // secondary dark surface (footer bottom)
    darkText: string; // light text used on dark backgrounds
  };
  buttons: {
    radius: "full" | "lg" | "md" | "sm";
    scale: number; // 0.85 – 1.25, multiplier for button padding
  };
  ui: {
    animations: boolean; // master toggle for motion animations
    sectionSpacing: "compact" | "normal" | "spacious";
  };
}

// ---------------------------------------------------------------------------
// TALA — AI voice concierge settings. Only the MODEL CHOICE lives here
// (public, non-secret — this whole CmsData payload is readable by anyone who
// loads the site). The actual OpenRouter API key is never stored in the CMS;
// it stays server-side as a Supabase Edge Function secret. This record is
// just what the admin picked and a timestamp the widget can use to confirm
// the choice reached the live site.
// ---------------------------------------------------------------------------
export interface TalaSettings {
  enabled: boolean;
  /** OpenRouter model id, e.g. "deepseek/deepseek-chat-v3-0324:free". Empty = use built-in free-model fallback chain. */
  modelId: string;
  /** Human-readable label shown in admin, captured at selection time. */
  modelLabel: string;
  /** Whether the selected model is one of OpenRouter's free-tier models. */
  isFreeModel: boolean;
  /**
   * OpenRouter API key, entered directly in admin for fast iteration while
   * building. Stored the same way the WhatsApp chatbot's apiKey field is
   * (see WhatsAppSettings.chatbot.apiKey below) — plain text in CMS data,
   * which every site visitor's browser can read. Fine for a building/testing
   * key you don't mind rotating; move to the Supabase Edge Function secret
   * (never exposed) before treating this as production-final.
   */
  apiKey: string;
  /** Kokoro voice id (e.g. "af_heart") used as the site-wide default for every visitor. */
  voiceId: string;
  /**
   * Which engine actually speaks. "kokoro" = free, in-browser (default).
   * "openrouter" = hosted TTS model via OpenRouter (same apiKey above,
   * no separate account) — real cost, but no local-model download lag.
   */
  voiceProvider: "kokoro" | "openrouter";
  /** OpenRouter TTS model id, e.g. "mistralai/voxtral-mini-tts-2603". Only used when voiceProvider is "openrouter". */
  ttsModelId: string;
  /** Human-readable label shown in admin, captured at selection time. */
  ttsModelLabel: string;
  /** Voice id for the chosen TTS model — each model defines its own set (e.g. OpenAI: "nova", Voxtral: "en_paul_happy"). */
  ttsVoiceId: string;
  /** ISO timestamp of the last time an admin changed this — drives the "synced" indicator. */
  updatedAt: string;
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  logoText: string;
  accentColor: string;
  darkModeDefault: boolean;
  contact: ContactInfo;
  seo: SeoSettings;
  whatsapp: WhatsAppSettings;
  theme: ThemeSettings;
  tala: TalaSettings;
}

export interface MediaItem {
  id: string;
  name: string;
  url: string; // data URL, uploaded file URL, or external video URL (YouTube/Vimeo)
  type: "image" | "video";
  folder: string;
  createdAt: string;
  size: number;
  label?: string; // used for placeholder labelling e.g. "Hero Image"
  provider?: "youtube" | "vimeo" | "upload"; // only relevant when type === "video"
}

// ===========================================================================
// OPERATIONS BACK-OFFICE
// ===========================================================================
// All operational business data — bookings, tours, staff, payments, rentals.
// Every module reads/writes exclusively through the CmsContext so a future
// Supabase migration only needs to change src/lib/storage.ts.
// ===========================================================================

export type BookingStatus = "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";
export type PaymentMethod = "cash" | "gcash" | "bank_transfer" | "card" | "paypal" | "other";
export type BookingSource =
  | "whatsapp"
  | "direct"
  | "airbnb"
  | "agoda"
  | "booking.com"
  | "walk_in"
  | "referral"
  | "other";

export interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  notes: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  reference: string; // human-readable, e.g. MT-2026-001
  guestId: string;
  guestName: string; // denormalized for fast display
  roomType: string; // "Day Pass" | "Weekly Sprint" | "Deep Work Month" | custom
  checkIn: string; // ISO date
  checkOut: string; // ISO date
  guests: number;
  amount: number; // total PHP
  paidAmount: number;
  status: BookingStatus;
  source: BookingSource;
  notes: string;
  packageId?: string; // linked PackageItem id, or empty
  createdAt: string;
}

export interface Tour {
  id: string;
  name: string;
  description: string;
  duration: string; // "8 hours", "half day"
  price: number; // per person PHP
  capacity: number; // max guests per departure
  inclusions: string[]; // ["Lunch", "Snorkel gear", "Boat"]
  active: boolean;
  order: number;
}

export interface TourBooking {
  id: string;
  reference: string;
  tourId: string;
  tourName: string; // denormalized
  guestName: string;
  guestPhone: string;
  date: string; // ISO date of tour
  guests: number;
  amount: number;
  paidAmount: number;
  status: "confirmed" | "completed" | "cancelled";
  notes: string;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string; // "Front Desk", "Housekeeping", "Kitchen"…
  phone: string;
  email: string;
  payType: "hourly" | "daily" | "monthly";
  payRate: number; // PHP per unit
  active: boolean;
  hiredAt: string; // ISO date
  notes: string;
}

export interface Shift {
  id: string;
  staffId: string;
  date: string; // ISO date
  startTime: string; // "08:00"
  endTime: string; // "17:00"
  hoursWorked: number; // computed but stored for edits
  notes: string;
}

export interface PayRecord {
  id: string;
  staffId: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  hours: number;
  amount: number; // gross PHP
  paid: boolean;
  paidAt: string; // ISO or empty
  method: PaymentMethod;
  notes: string;
}

export interface Payment {
  id: string;
  reference: string;
  date: string; // ISO date
  category: "booking" | "tour" | "rental" | "food" | "other" | "expense";
  direction: "in" | "out"; // in = revenue, out = expense
  amount: number;
  method: PaymentMethod;
  relatedId: string; // booking/tour/rental id, or empty
  description: string;
  notes: string;
}

export interface Motorbike {
  id: string;
  name: string; // "Honda Click 125 #1"
  plate: string;
  model: string;
  dailyRate: number; // PHP/day
  active: boolean;
  status: "available" | "rented" | "maintenance";
  notes: string;
}

export interface MotorbikeRental {
  id: string;
  reference: string;
  bikeId: string;
  bikeName: string; // denormalized
  guestName: string;
  guestPhone: string;
  startDate: string; // ISO
  endDate: string; // ISO
  days: number;
  amount: number;
  paidAmount: number;
  deposit: number;
  status: "active" | "returned" | "cancelled";
  notes: string;
  createdAt: string;
}

export type MenuCategory = "breakfast" | "lunch" | "dinner" | "drinks";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: MenuCategory;
  price: number; // PHP
  foodCost: number; // PHP — cost of ingredients per portion
  inventoryCount: number; // portions available (0 = sold out)
  active: boolean;
  order: number;
}

export interface FoodOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  foodCost: number; // snapshot at order time
}

export type FoodOrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";

export interface FoodOrder {
  id: string;
  reference: string;
  guestName: string;
  guestPhone: string;
  items: FoodOrderItem[];
  total: number;
  totalCost: number; // sum of foodCost * quantity
  status: FoodOrderStatus;
  notes: string;
  createdAt: string;
  confirmedAt: string;
  preparingAt: string;
  readyAt: string;
  deliveredAt: string;
  cancelledAt: string;
}

export interface Operations {
  guests: Guest[];
  bookings: Booking[];
  tours: Tour[];
  tourBookings: TourBooking[];
  staff: StaffMember[];
  shifts: Shift[];
  payRecords: PayRecord[];
  payments: Payment[];
  motorbikes: Motorbike[];
  motorbikeRentals: MotorbikeRental[];
  menuItems: MenuItem[];
  foodOrders: FoodOrder[];
  guestMessages: GuestMessage[];
}

export interface GuestMessage {
  id: string;
  guestName: string;
  guestPhone: string;
  message: string;
  reply: string;
  status: "unread" | "read" | "replied";
  createdAt: string;
  repliedAt: string;
}

export interface CmsData {
  homepage: HomepageContent;
  workspace: WorkspaceContent;
  pricing: PricingPackage[];
  packages: PackageItem[];
  gallery: GalleryImage[];
  videos: VideoItem[];
  blogPosts: BlogPost[];
  blogCategories: BlogCategory[];
  testimonials: Testimonial[];
  faqs: Faq[];
  settings: SiteSettings;
  media: MediaItem[];
  operations: Operations;
}
