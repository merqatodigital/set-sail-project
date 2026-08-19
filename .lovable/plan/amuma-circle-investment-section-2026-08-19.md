# AMUMA Circle — Investment Section

Add the AMUMA digital-nomad investment tier as a full investor page plus a homepage teaser, using the existing Marina Terrace UI language (cream `#FAF6EF`, gold `#C6A15B`, serif headings, `Reveal` animations, `SectionEyebrow`). No redesign, no new visual system.

## 1. New page: `/investment`

Nav link "Investment" added directly after "Field Notes" (desktop + mobile menus), and a matching footer link. Lazy-loaded like the other secondary routes.

Page sections, in order, all rendered from structured data (no invented copy, no invented numbers):

1. Hero — AMUMA meaning, membership-based boutique collection, San Vicente first chapter, two existing resorts named (Marina Terrace and BAIA), primary CTA "Apply to the Founding Circle".
2. Executive summary
3. The AMUMA Circle membership model (co-creation rights, revenue participation, 60/40 split)
4. Pebbles lifestyle currency + per-night Pebble table (suites/villas, low/mid/high)
5. Hidden Destinations strategy (Philippines and Southeast Asia pipelines)
6. Investment tiers table (Nova / Aurora / Orion / Polaris) with 20 Nova Founding Circle spots called out
7. Revenue model + indicative external nightly rates table
8. Projected returns + Nova worked example
9. The AMUMA flywheel (6 steps)
10. Five experience pillars
11. First chapter: AMUMA San Vicente + Circle Unit allocation table (4,400 total, 1,600 proof-of-work, 2,800 member)
12. Roadmap 2026–2035 timeline
13. Founding team (Giacomo Gervasutti, Irina Feleo, Joaquin Esquivias)
14. Member Portal webapp capabilities
15. Market analysis and competitive positioning
16. Operational plan and staffing
17. Financial plan — assumptions, projected income statement, projected cash flow, use of funds (4 tables)
18. Member returns and investment structure
19. The Founding Circle offer + application form
20. Risk factors and mitigations table
21. Legal, IP, governance, securities restrictions and forward-looking-statement notice
22. Closing contact block (hello@amuma.ph, +63 917 000 0000)

Tables render as responsive cards on mobile and as real tables from `sm:` up, so nothing overflows on a phone.

SEO: page title, description, canonical and OG tags specific to AMUMA Circle.

## 2. Homepage teaser

A compact "Investment" section added to the homepage section list (registered in the section-order system so it can be reordered/hidden from the admin Homepage editor like every other section). It shows the AMUMA one-liner, the four tiers as compact cards, the 17–20% projected ROI line, and two CTAs: "View the business plan" → `/investment`, and "Talk to TALA about AMUMA" → opens TALA with an AMUMA investor intent.

## 3. Founding Circle applications → database

New table `amuma_applications`: first name, last name, email, phone, country of residence, tier of interest, how they heard about AMUMA, optional message, status, created_at. RLS enabled with an insert-only public policy (anyone may apply, nobody may read publicly) plus admin/service read, and explicit GRANTs. The public form and TALA both write through the same insert path.

A read-only "AMUMA Applications" list is added to the admin area (existing admin table styling) so applications are reviewable, consistent with the current open-demo admin access.

## 4. TALA gets the full plan

- The complete business plan is loaded into TALA's knowledge base as a set of `tala_knowledge` entries (executive summary, membership model, Pebbles, tiers, returns, destinations, roadmap, team, portal, market, operations, financials, risks, legal) so she can answer investor questions on both the site and in the worker prompt.
- Because the knowledge pipeline strips currency figures to protect room pricing, AMUMA financial figures are supplied through a dedicated investment context block in the prompt builder rather than the price-stripped path — so tier amounts, Pebble costs, ROI and projections stay accurate.
- A new investor intent lets any AMUMA CTA open TALA pre-seeded with tier context, and TALA can collect and submit a Founding Circle application in chat.
- Guardrails: TALA presents projections as conservative estimates, never guarantees returns, and repeats the "not registered as securities / not offered to U.S. persons" restriction when asked about buying in.

## Technical notes

- Content lives in one typed data module (`src/lib/amumaData.ts`) consumed by both the page and the TALA context builder, so numbers exist in exactly one place.
- Route registered in `src/App.tsx` alongside the other lazy public routes; page under `src/pages/Investment.tsx` with section components under `src/components/amuma/`.
- Homepage teaser added as a new `SectionKey` with a default entry in the section-order defaults so existing saved CMS data still renders (missing keys fall back to the default order).
- Application insert goes through the existing Supabase client path used by the rest of the public site.
- No changes to booking, pricing, portal, or voice code.
