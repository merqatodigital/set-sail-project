import type { CmsData } from "@/types/cms";

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

// Placeholder "media" entries. Real photography will replace these later —
// each has a descriptive label so the owner knows exactly what to upload.
// Pre-seeded default images that ship with the site. These are placed in
// /public/images so they load with zero configuration; owners can replace
// any of them from the admin Media Library.
export const PRESEEDED_MEDIA_URLS: Record<string, string> = {
  img_hero: "/images/hero-rooftop.jpg",
  img_workspace: "/images/rooftop-workspace.jpg",
  img_bedroom: "/images/room-uno-main.jpg",
  img_living: "/images/room-uno-details.jpg",
  img_bathroom: "/images/room-uno-bed.jpg",
  img_balcony: "/images/room-due-main.jpg",
  img_community: "/images/room-tre-main.jpg",
  img_due_minibar: "/images/room-due-minibar.jpg",
};

export const PLACEHOLDER_MEDIA = [
  { id: "img_hero", label: "Hero Image", folder: "Homepage" },
  { id: "img_workspace", label: "Rooftop Workspace", folder: "Workspace" },
  { id: "img_ocean", label: "Ocean View", folder: "Workspace" },
  { id: "img_kitchen", label: "Guest Kitchen", folder: "Kitchen" },
  { id: "img_sunset", label: "Sunset Workspace", folder: "Workspace" },
  { id: "img_bedroom", label: "Bedroom", folder: "Stay" },
  { id: "img_living", label: "Living Room", folder: "Stay" },
  { id: "img_bathroom", label: "Bathroom", folder: "Stay" },
  { id: "img_balcony", label: "Balcony", folder: "Stay" },
  { id: "img_community", label: "Community", folder: "Homepage" },
  { id: "img_testimonial_1", label: "Guest Portrait — Aria", folder: "Testimonials" },
  { id: "img_testimonial_2", label: "Guest Portrait — Noah", folder: "Testimonials" },
  { id: "img_testimonial_3", label: "Guest Portrait — Lien", folder: "Testimonials" },
  { id: "img_blog_1", label: "Blog — Digital Nomad Guide", folder: "Blog" },
  { id: "img_blog_2", label: "Blog — Palawan Travel", folder: "Blog" },
  { id: "img_blog_3", label: "Blog — Remote Work Tips", folder: "Blog" },
  { id: "img_og", label: "Open Graph Cover", folder: "SEO" },
];

export function buildDefaultMedia(): CmsData["media"] {
  return PLACEHOLDER_MEDIA.map((m) => ({
    id: m.id,
    name: m.label,
    url: PRESEEDED_MEDIA_URLS[m.id] || "",
    type: "image" as const,
    folder: m.folder,
    createdAt: new Date().toISOString(),
    size: 0,
    label: m.label,
  }));
}

export function buildDefaultData(): CmsData {
  return {
    homepage: {
      sectionOrder: [
        { key: "hero", label: "Hero", visible: true, order: 0 },
        { key: "features", label: "Feature Strip", visible: true, order: 1 },
        { key: "workspace", label: "Workspace", visible: true, order: 2 },
        { key: "kitchen", label: "Community Kitchen", visible: true, order: 3 },
        { key: "focus", label: "Analog Focus", visible: true, order: 4 },
        { key: "stay", label: "Long Stay", visible: false, order: 5 },
        { key: "facilities", label: "Facilities", visible: true, order: 6 },
        { key: "speed", label: "Internet Speed", visible: true, order: 7 },
        { key: "rooms", label: "Other Rooms", visible: true, order: 8 },
        { key: "pricing", label: "Pricing", visible: true, order: 9 },
        { key: "testimonials", label: "Testimonials", visible: true, order: 10 },
        { key: "faqs", label: "FAQs", visible: true, order: 11 },
        { key: "cta", label: "Closing CTA", visible: true, order: 12 },
      ],
      hero: {
        eyebrow: "Poblacion, San Vicente, Palawan",
        headline: "Your Ocean-View Office in Palawan.",
        subtext:
          "Deep work, Starlink internet, an open-air rooftop workspace, premium guest kitchen, boutique long-stay suites and an inspiring community — designed specifically for remote workers.",
        location: "Poblacion, San Vicente, Palawan",
        primaryButtonLabel: "Check Availability on WhatsApp",
        primaryButtonLink: "https://wa.me/639672062327",
        secondaryButtonLabel: "Book a Workspace Day Pass",
        secondaryButtonLink: "#pricing",
        imageId: "img_hero",
      },
      features: [
        {
          id: uid("feat"),
          icon: "Wifi",
          title: "Redundant Starlink Internet",
          description:
            "Primary Starlink connection with 4G/5G failover — never lose your connection mid-call.",
        },
        {
          id: uid("feat"),
          icon: "Plug",
          title: "Power at Every Seat",
          description:
            "Integrated charging across the rooftop, plus backup generators for outages.",
        },
        {
          id: uid("feat"),
          icon: "Sun",
          title: "Glare-Free Workspace",
          description:
            "Canvas shading blocks harsh sun. Seats positioned for breeze and screen visibility.",
        },
        {
          id: uid("feat"),
          icon: "Volume1",
          title: "Quiet Deep Work Environment",
          description: "A calm, considerate community that protects focus during working hours.",
        },
      ],
      kitchen: {
        eyebrow: "The Anti-Restaurant",
        title: "Your Premium Community Kitchen",
        paragraph:
          "Eating out three times a day gets old fast. Cook fresh seafood from the port, use a fully equipped shared kitchen, and never worry about cleanup — our local team handles dishes and resets so you can get back to living well.",
        features: [
          {
            id: uid("kf"),
            icon: "Fish",
            title: "Cook From the Port",
            description:
              "Walk down to Poblacion port for the morning's fresh catch, then grill it upstairs before sunset.",
          },
          {
            id: uid("kf"),
            icon: "Soup",
            title: "Use the Shared Pantry",
            description:
              "Premium oils, real spices, and daily staples — no need to buy full bottles.",
          },
          {
            id: uid("kf"),
            icon: "Sparkles",
            title: "Skip the Clean-Up",
            description:
              "Cook without the sink duty. Our local team handles dishes and resets the kitchen.",
          },
        ],
        imageId: "img_kitchen",
      },
      focus: {
        eyebrow: "The Vibe",
        title: "Analog Focus. Real Connections.",
        paragraph:
          "Productive mornings. Focused afternoons. Sunset sessions that close the laptop when the light changes. Community dinners and meaningful conversations with developers, writers, founders and creators actually getting work done.",
        features: [
          {
            id: uid("ff"),
            icon: "SunMedium",
            title: "Daytime Productivity",
            description:
              "Quiet mornings, focused afternoons — a community built around getting real work done.",
          },
          {
            id: uid("ff"),
            icon: "Sunset",
            title: "The 5:00 PM Reset",
            description:
              "Close the laptop when the light changes. Sunset breeze, a record on the turntable.",
          },
        ],
        imageId: "img_sunset",
      },
      stay: {
        eyebrow: "Stay",
        title: "Stay a Week. Stay a Month. Live Here.",
        paragraph:
          "Your workspace is only as good as your recovery. Our boutique long-stay apartments feature separate living areas, ensuite bathrooms, air-conditioning and tropical modern design — optimized for long-term comfort.",
        features: [
          {
            id: uid("sf"),
            icon: "Sofa",
            title: "Separate Living Areas",
            description:
              "Sofas, desks and space to think. Take private calls away from the rooftop.",
          },
          {
            id: uid("sf"),
            icon: "Leaf",
            title: "Tropical Modern Design",
            description:
              "Local wood floors, clean white finishes, large windows with natural light.",
          },
          {
            id: uid("sf"),
            icon: "Luggage",
            title: "Practical Long-Stay Comfort",
            description:
              "Ensuite bathrooms, quiet air conditioning, and storage space for longer stays.",
          },
        ],
        galleryImageIds: [
          "img_bedroom",
          "img_living",
          "img_bathroom",
          "img_balcony",
          "img_community",
        ],
      },
      speed: {
        eyebrow: "Real Performance",
        title: "Actual Internet Speed. Right Now.",
        paragraph:
          "We run a redundant Starlink Business connection with 4G/5G failover. No 'up to' claims — this is a live measurement of what you'll actually get on the rooftop.",
        downloadMbps: 187,
        uploadMbps: 24,
        pingMs: 38,
        provider: "Starlink Business",
        location: "Poblacion, San Vicente, Palawan",
        liveTest: true,
        lastMeasuredAt: new Date().toISOString(),
        planName: "Starlink Business",
        dishCount: 2,
        hasFailover: true,
        failoverProvider: "Smart 5G",
        failoverType: "5G / 4G LTE",
        redundancyNote: "Auto-switches to failover in under 2 seconds during outages.",
        accountReference: "",
        supportContact: "",
        providerNotes: "",
      },
      rooms: [
        {
          id: uid("rm"),
          name: "Superior Room UNO",
          capacity: "2 Adults",
          size: "24sqm",
          view: "City",
          description:
            "The largest room, with sofa and coffee table, large screen TV, air conditioning, large bright windows, and an elegant and welcoming style.",
          price: "$42",
          imageKey: "/images/room-uno-main.jpg",
          visible: true,
          order: 0,
        },
        {
          id: uid("rm"),
          name: "Standard Room DUE",
          capacity: "2 Adults",
          size: "20sqm",
          view: "Ocean",
          description:
            "Double bedroom with king size bed, TV, air conditioning, large bright windows, and an elegant and welcoming style. Private bathroom. Non-smoking room. Immediate confirmation.",
          price: "$32",
          imageKey: "/images/room-due-main.jpg",
          visible: true,
          order: 1,
        },
        {
          id: uid("rm"),
          name: "Basic Room TRE",
          capacity: "2 Adults",
          size: "15sqm",
          view: "No View",
          description:
            "Compact and budget-friendly room featuring sturdy wooden bunk beds, perfect for close friends.",
          price: "$24",
          imageKey: "/images/room-tre-main.jpg",
          visible: true,
          order: 2,
        },
        {
          id: uid("rm"),
          name: "Single Room QUATTRO",
          capacity: "2 Adults",
          size: "10sqm",
          view: "Skyline",
          description:
            "Minimalist and perfectly quiet corner single room designed specifically for deep focus and solo travelers.",
          price: "$20",
          imageKey: "/images/room-quattro-main.jpg",
          visible: true,
          order: 3,
        },
      ],
      facilities: {
        eyebrow: "In Every Suite",
        title: "Facilities",
        paragraph:
          "Every long-stay suite comes fully equipped for comfortable living and productive remote work. Nothing to think about, nothing to buy.",
        items: [
          {
            id: uid("fac"),
            icon: "Wifi",
            name: "High-speed in-room WiFi",
            order: 0,
            visible: true,
          },
          { id: uid("fac"), icon: "Wine", name: "Mini bar", order: 1, visible: true },
          { id: uid("fac"), icon: "Coffee", name: "Kettle", order: 2, visible: true },
          { id: uid("fac"), icon: "Snowflake", name: "Air conditioning", order: 3, visible: true },
          { id: uid("fac"), icon: "Tv", name: "TV", order: 4, visible: true },
          { id: uid("fac"), icon: "ShowerHead", name: "Hot shower", order: 5, visible: true },
          { id: uid("fac"), icon: "Bath", name: "Private bathroom", order: 6, visible: true },
          {
            id: uid("fac"),
            icon: "BedDouble",
            name: "Bed linen, towels & desk",
            order: 7,
            visible: true,
          },
        ],
      },
      ctaTitle: "Ready to Change Your View?",
      ctaSubtext:
        "Spaces are limited to protect the quiet, high-bandwidth environment for every working resident.",
      ctaButtonLabel: "Apply for an Extended Stay / Book Now",
    },
    workspace: {
      eyebrow: "Workspace",
      title: "An Open-Air Rooftop, Built for Deep Work",
      paragraph:
        "Panoramic ocean views, shaded seating, and an atmosphere engineered for concentration. Marina Terrace's rooftop workspace was designed from the ground up for people who take their craft seriously.",
      imageId: "img_workspace",
      highlights: [
        {
          id: uid("wh"),
          icon: "Waves",
          title: "Ocean View",
          description: "Every seat faces the water. Watch bancas drift by while you work.",
        },
        {
          id: uid("wh"),
          icon: "Wifi",
          title: "Starlink + Failover",
          description: "Redundant connectivity engineered for video calls and large uploads.",
        },
        {
          id: uid("wh"),
          icon: "Clock",
          title: "Open Early, Open Late",
          description: "Rooftop access from sunrise sessions to late-night sprints.",
        },
      ],
    },
    pricing: [
      {
        id: uid("price"),
        name: "Day Pass",
        price: "₱1,040",
        period: "/day",
        icon: "User",
        description:
          "For visitors & locals who need high-speed Wi-Fi and rooftop desk access for the day.",
        features: [
          { id: uid("pf"), text: "High-speed Wi-Fi" },
          { id: uid("pf"), text: "Rooftop desk access" },
          { id: uid("pf"), text: "Kitchen utilities included" },
        ],
        buttonLabel: "Book Day Pass",
        featured: false,
        order: 0,
      },
      {
        id: uid("price"),
        name: "Weekly Sprint",
        price: "₱15,470",
        period: "/week",
        icon: "CalendarDays",
        description:
          "For short-term builders. 7 nights in a private suite with unrestricted rooftop access.",
        features: [
          { id: uid("pf"), text: "7 nights in a private suite" },
          { id: uid("pf"), text: "24/7 rooftop workspace access" },
          { id: uid("pf"), text: "Daily coffee included" },
        ],
        buttonLabel: "Book Weekly Stay",
        featured: true,
        order: 1,
      },
      {
        id: uid("price"),
        name: "Deep Work Month",
        price: "₱44,200",
        period: "/month",
        icon: "Laptop",
        description:
          "For long-term digital nomads. A discounted 30-night stay with priority desk zone.",
        features: [
          { id: uid("pf"), text: "30-night discounted stay" },
          { id: uid("pf"), text: "Priority desk zone" },
          { id: uid("pf"), text: "Weekly laundry & welcome wine" },
        ],
        buttonLabel: "Book Monthly Stay",
        featured: false,
        order: 2,
      },
    ],
    gallery: [
      { id: uid("gal"), mediaId: "img_workspace", caption: "Rooftop Workspace", order: 0 },
      { id: uid("gal"), mediaId: "img_ocean", caption: "Ocean View", order: 1 },
      { id: uid("gal"), mediaId: "img_kitchen", caption: "Guest Kitchen", order: 2 },
      { id: uid("gal"), mediaId: "img_bedroom", caption: "Bedroom", order: 3 },
      { id: uid("gal"), mediaId: "img_living", caption: "Living Room", order: 4 },
      { id: uid("gal"), mediaId: "img_bathroom", caption: "Bathroom", order: 5 },
      { id: uid("gal"), mediaId: "img_balcony", caption: "Balcony", order: 6 },
      { id: uid("gal"), mediaId: "img_community", caption: "Community", order: 7 },
      { id: uid("gal"), mediaId: "img_sunset", caption: "Sunset Workspace", order: 8 },
    ],
    videos: [
      {
        id: uid("vid"),
        title: "A Day at Marina Terrace",
        type: "youtube",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        order: 0,
      },
    ],
    blogCategories: [
      { id: uid("cat"), name: "Remote Work", slug: "remote-work" },
      { id: uid("cat"), name: "Palawan Travel", slug: "palawan-travel" },
      { id: uid("cat"), name: "Community", slug: "community" },
    ],
    blogPosts: [
      {
        id: uid("post"),
        title: "The Digital Nomad's Guide to San Vicente, Palawan",
        slug: "digital-nomads-guide-san-vicente-palawan",
        excerpt:
          "Everything you need to know before landing in one of the Philippines' most underrated coastal towns for remote work.",
        content:
          "<p>San Vicente is quietly becoming one of the best-kept secrets for remote workers in Southeast Asia. With Long Beach on one side and a working fishing port on the other, Poblacion offers a rare mix of stillness and stimulation.</p><p>Here's what you need to know before you book your flight — from the best time to visit, to how to get reliable internet, to where to eat fresh seafood every night of the week.</p><h3>Getting There</h3><p>Fly into Puerto Princesa, then take a 3.5 hour van ride north along a newly paved highway.</p><h3>Where to Work</h3><p>Marina Terrace's rooftop workspace is built specifically for people who need dependable internet and a calm environment.</p>",
        featuredImageId: "img_blog_2",
        images: ["img_blog_2"],
        categoryIds: [],
        tags: ["travel", "palawan", "guide"],
        status: "published",
        publishAt: new Date().toISOString(),
        seoTitle: "The Digital Nomad's Guide to San Vicente, Palawan",
        seoDescription:
          "Everything you need to know before landing in San Vicente, Palawan as a remote worker.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: uid("post"),
        title: "5 Ways We Designed Marina Terrace for Deep Work",
        slug: "designed-for-deep-work",
        excerpt: "A behind-the-scenes look at the decisions behind our rooftop workspace.",
        content:
          "<p>From canvas shading to seat orientation, every decision on our rooftop was made with focus in mind. Here's a behind-the-scenes look at how we built it.</p>",
        featuredImageId: "img_blog_3",
        images: ["img_blog_3"],
        categoryIds: [],
        tags: ["workspace", "design"],
        status: "published",
        publishAt: new Date().toISOString(),
        seoTitle: "5 Ways We Designed Marina Terrace for Deep Work",
        seoDescription:
          "A behind-the-scenes look at the decisions behind our rooftop coworking space.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    testimonials: [
      {
        id: uid("test"),
        name: "Aria Voss",
        country: "Germany",
        occupation: "Product Designer",
        rating: 5,
        quote:
          "The most productive month of my career happened on this rooftop. The internet never dropped once — even during a client demo.",
        imageId: "img_testimonial_1",
        order: 0,
      },
      {
        id: uid("test"),
        name: "Noah Bennett",
        country: "Canada",
        occupation: "Founder, SaaS Startup",
        rating: 5,
        quote:
          "I extended my stay twice. Between sunrise work sessions and sunset dinners with other founders, it's hard to leave.",
        imageId: "img_testimonial_2",
        order: 1,
      },
      {
        id: uid("test"),
        name: "Lien Tran",
        country: "Vietnam",
        occupation: "Freelance Writer",
        rating: 5,
        quote:
          "Quiet when I needed to write, social when I needed a break. The kitchen alone is worth the trip.",
        imageId: "img_testimonial_3",
        order: 2,
      },
    ],
    faqs: [
      {
        id: uid("faq"),
        question: "How fast is the internet, really?",
        answer:
          "We run a primary Starlink connection with automatic 4G/5G failover, plus wired backup at every desk. Speeds average 80–150 Mbps.",
        order: 0,
      },
      {
        id: uid("faq"),
        question: "Do you offer discounts for longer stays?",
        answer:
          "Yes — the Deep Work Month package offers the best nightly rate, and we can tailor multi-month stays on request via WhatsApp.",
        order: 1,
      },
      {
        id: uid("faq"),
        question: "Is the rooftop open to non-guests?",
        answer:
          "Yes, our Day Pass is available to visitors and locals who want rooftop desk access and kitchen utilities for the day.",
        order: 2,
      },
      {
        id: uid("faq"),
        question: "What's included in the guest kitchen?",
        answer:
          "A fully equipped shared kitchen with a premium pantry, cookware, and daily cleanup handled by our local team.",
        order: 3,
      },
      {
        id: uid("faq"),
        question: "How do I get to San Vicente?",
        answer:
          "Fly into Puerto Princesa, then it's roughly a 3.5 hour van ride along a newly paved highway to Poblacion, San Vicente.",
        order: 4,
      },
    ],
    settings: {
      siteName: "Marina Terrace",
      tagline: "Your Ocean-View Office in Palawan",
      logoText: "MARINA TERRACE",
      accentColor: "#C6A15B",
      darkModeDefault: false,
      contact: {
        phone: "+63 967 206 2327",
        whatsapp: "+63 967 206 2327",
        email: "the.maskedbirds@gmail.com",
        address: "Poblacion, San Vicente, Palawan, Philippines",
        googleMapsLink: "https://maps.google.com/?q=San+Vicente,+Palawan",
        businessHours: "Rooftop open daily · 6:00 AM – 11:00 PM",
        social: {
          instagram: "https://instagram.com",
          facebook: "https://facebook.com",
          tiktok: "https://tiktok.com",
          youtube: "https://youtube.com",
        },
      },
      seo: {
        siteTitle: "Marina Terrace — Rooftop Coworking & Long Stays in Palawan",
        homeTitle: "Marina Terrace | Your Ocean-View Office in Palawan",
        homeDescription:
          "A rooftop coworking space and boutique long-stay destination for digital nomads in San Vicente, Palawan. Starlink internet, guest kitchen, and long-stay suites.",
        keywords:
          "coworking palawan, digital nomad philippines, san vicente palawan, remote work palawan, long stay palawan",
        ogImageId: "img_og",
      },
      theme: {
        fonts: {
          serif: "Cormorant Garamond",
          sans: "Plus Jakarta Sans",
        },
        colors: {
          accent: "#C6A15B",
          accentHover: "#B8924B",
          background: "#FAF6EF",
          surface: "#FFFFFF",
          text: "#26221C",
          darkBg: "#1B1812",
          darkAlt: "#141210",
          darkText: "#F5EFE2",
        },
        buttons: {
          radius: "full",
          scale: 1,
        },
        ui: {
          animations: true,
          sectionSpacing: "normal",
        },
      },
      whatsapp: {
        numbers: [
          {
            id: uid("wa"),
            label: "Bookings & General",
            number: "+63 967 206 2327",
            isPrimary: true,
          },
        ],
        defaultMessage: "Hi Marina Terrace! I'd like to know more about staying with you.",
        bookingMessage:
          "Hi! I'd like to book the {package} package. Could you confirm availability?",
        showFloatingButton: true,
        showInNavbar: true,
        businessHoursNote: "We reply within a few hours during 8:00 AM – 8:00 PM PHT.",
        chatbot: {
          enabled: false,
          provider: "none",
          apiKey: "",
          webhookUrl: "",
          autoReplyMessage: "Salamat! A member of our team will get back to you shortly.",
        },
      },
      tala: {
        enabled: true,
        modelId: "",
        modelLabel: "",
        isFreeModel: true,
        apiKey: "",
        voiceId: "af_heart",
        voiceProvider: "kokoro",
        ttsModelId: "",
        ttsModelLabel: "",
        ttsVoiceId: "",
        updatedAt: "",
      },
    },
    media: buildDefaultMedia(),
    operations: buildDefaultOperations(),
  };
}

// ---------------------------------------------------------------------------
// Sample operations data — provides an instantly-usable back-office demo
// (a few sample staff, tours, bikes) without any real financial data.
// ---------------------------------------------------------------------------
export function buildDefaultOperations(): import("@/types/cms").Operations {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  return {
    guests: [],
    bookings: [],
    tours: [
      {
        id: uid("tour"),
        name: "Long Beach Island Hopping",
        description: "Full-day boat trip: 3 islands, snorkeling, beach lunch, coral gardens.",
        duration: "8 hours",
        price: 2500,
        capacity: 10,
        inclusions: ["Boat & crew", "Buffet lunch", "Snorkel gear", "Bottled water"],
        active: true,
        order: 0,
      },
      {
        id: uid("tour"),
        name: "Port Barton Day Trip",
        description: "Scenic drive south + swim with turtles & starfish sandbar.",
        duration: "10 hours",
        price: 3200,
        capacity: 8,
        inclusions: ["Van transfer", "Boat", "Lunch", "Guide"],
        active: true,
        order: 1,
      },
      {
        id: uid("tour"),
        name: "Sunset Cruise",
        description: "Private banca sunset cruise around the bay with drinks.",
        duration: "2 hours",
        price: 1500,
        capacity: 6,
        inclusions: ["Boat", "2 drinks per guest", "Snacks"],
        active: true,
        order: 2,
      },
    ],
    tourBookings: [],
    staff: [
      {
        id: uid("staff"),
        name: "Maria Santos",
        role: "Front Desk",
        phone: "+63 917 000 0001",
        email: "",
        payType: "daily",
        payRate: 800,
        active: true,
        hiredAt: iso(addDays(today, -60)),
        notes: "",
      },
      {
        id: uid("staff"),
        name: "Junnel Reyes",
        role: "Kitchen",
        phone: "+63 917 000 0002",
        email: "",
        payType: "daily",
        payRate: 700,
        active: true,
        hiredAt: iso(addDays(today, -90)),
        notes: "",
      },
      {
        id: uid("staff"),
        name: "Ana Cruz",
        role: "Housekeeping",
        phone: "+63 917 000 0003",
        email: "",
        payType: "daily",
        payRate: 650,
        active: true,
        hiredAt: iso(addDays(today, -30)),
        notes: "",
      },
    ],
    shifts: [],
    payRecords: [],
    payments: [],
    motorbikes: [
      {
        id: uid("bike"),
        name: "Honda Click 125 #1",
        plate: "ABC-1234",
        model: "Honda Click 125i",
        dailyRate: 500,
        active: true,
        status: "available",
        notes: "",
      },
      {
        id: uid("bike"),
        name: "Yamaha Mio #1",
        plate: "DEF-5678",
        model: "Yamaha Mio Sporty",
        dailyRate: 450,
        active: true,
        status: "available",
        notes: "",
      },
    ],
    motorbikeRentals: [],
  };
}
