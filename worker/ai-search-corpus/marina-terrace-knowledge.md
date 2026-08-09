# Marina Terrace Resort — AI Search Knowledge Corpus

This file is the source corpus for the Cloudflare AI Search index
`marina-terrace-knowledge`. Each section is a self-contained knowledge
passage. Upload it to the index via the Cloudflare dashboard or the AI Search
ingestion API. Tag each passage with `audience` (guest|owner) and `category`
so role filtering works (guests only see `audience: guest` passages).

Do NOT include secrets, credentials, financial records, private guest data, or
admin-only operational records in this corpus.

---

## category: transport | audience: guest
## How do I get to Marina Terrace from El Nido?
Marina Terrace is in San Vicente, Palawan. From El Nido, the most common route
is a van or private transfer along the northern Palawan coastal road
(approximately 3.5–4 hours depending on road conditions and stops). Guests can
book a shared van through the front desk, or arrange a private transfer. The
resort can coordinate pickup from El Nido town proper or El Nido Airport (ENI).
For multi-stop trips, allow extra time during peak season. The resort
recommends confirming pickup the day before arrival.

## category: transport | audience: guest
## How do I get here from Puerto Princesa?
From Puerto Princesa International Airport (PPS), Marina Terrace is roughly a
4.5–5.5 hour drive north. Options: private transfer arranged by the resort,
rental car, or a van/bus to San Vicente then a short transfer. The resort can
book a private van for a flat rate; request it at least 48 hours before arrival.

## category: starlink | audience: guest
## What happens if the Starlink connection goes down?
Marina Terrace provides Starlink internet as the primary connection. If the
primary Starlink link fails (weather, obstruction, or outage), the resort
fails over to a secondary cellular backup (4G/5G pocket WiFi) for essential
connectivity. Expect reduced bandwidth during failover. Staff monitor the
Starlink dashboard; if the outage persists beyond 30 minutes, the front desk
notifies guests and prioritizes connectivity for payments and essential
communications. Guests should download offline maps/content in advance. Do not
attempt to reset or reposition the Starlink dish — only authorized staff may
service it.

## category: starlink | audience: owner
## STARLINK FAILURE SOP (owner/staff)
1. Check the Starlink app/dashboard for obstruction, thermal, or dishy offline
   state. Note the time of failure.
2. Confirm the secondary cellular backup (4G/5G pocket WiFi) is broadcasting and
   reachable. Switch guest-facing services to backup.
3. If Starlink is obstructed (storm/debris), visually inspect from a safe
   distance; do NOT climb or manually reposition the dish.
4. Power-cycle the Starlink power injector only after confirming with the
   technical point of contact.
5. Log the incident in the operations log with start time, cause if known, and
   recovery time. Notify owner if outage exceeds 1 hour.
6. Prioritize connectivity for payment terminals and owner communications.

## category: kitchen | audience: guest
## What are the kitchen / house rules?
The shared kitchen is available to long-stay and villa guests during posted
hours. Rules: clean as you go, label and date perishable items in the shared
fridge, no raw meat left uncovered, dispose of waste in the designated bins,
and keep noise low after 10 PM. Cooking equipment must be returned clean. The
resort provides basic cookware; guests supply their own groceries. Report any
equipment fault to the front desk rather than attempting repairs.

## category: kitchen | audience: owner
## KITCHEN OPERATIONS SOP (owner/staff)
Daily: sanitize surfaces, check fridge temperatures (target 1–4°C), rotate
stock by date, and confirm pest-control measures. Weekly: deep clean, audit
smallware, and discard expired items. Any guest-reported equipment fault is
logged and escalated to maintenance. Keep a posted cleaning roster.

## category: house-rules | audience: guest
## Check-in and check-out
Standard check-in is 14:00 and check-out is 11:00. Early check-in / late
check-out is subject to availability and must be confirmed with the front desk.
Quiet hours are 22:00–07:00. Visitors must be registered at the front desk.
Pets are allowed only in designated villas with prior approval.

## category: maintenance | audience: guest
## What is the procedure for a maintenance issue?
Report any maintenance issue (plumbing, power, AC, Wi-Fi, fixtures) to the
front desk in person, by message, or via the guest request tool. Include the
location/room and a short description. Routine issues are addressed within the
same day; urgent safety issues (water leak, power loss, lock failure) are
prioritized and handled immediately. Do not attempt DIY repairs on resort
equipment.

## category: maintenance | audience: owner
## MAINTENANCE RESPONSE SOP (owner/staff)
Triage by severity: (1) Safety/urgent — water, electrical, lock, gas — immediate
response and isolation; (2) Comfort — AC, Wi-Fi, fixtures — same day; (3)
Cosmetic — next scheduled maintenance window. Log every request with time,
location, action, and resolution. Recurring failures trigger a preventive
maintenance review.

## category: pre-arrival | audience: owner
## Staff SOP: before tomorrow's arrivals
The day before arrivals: (1) Confirm room/villa readiness and housekeeping
sign-off. (2) Verify expected arrival times and transport pickups. (3) Pre-stage
welcome materials and any special requests (crib, late checkout, dietary needs).
(4) Check Starlink + backup connectivity. (5) Brief the morning shift on VIP or
high-touch guests. (6) Ensure payment/pre-authorization status is known for
owner follow-up. Run the Morning Brief workflow for the consolidated view.

## category: wifi | audience: guest
## WiFi and connectivity guidance
Primary internet is Starlink (resort SSID provided at check-in). A secondary
cellular pocket-WiFi is available as backup. For video calls, use the backup
during Starlink outages. Bandwidth is shared; avoid large downloads during peak
hours. Connection in remote areas can be variable — plan accordingly.
