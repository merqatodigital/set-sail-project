# Fix TALA Knowledge Base: delete mock data, wire knowledge + live data into the agent

## What I found (verified)

- **3 mock "Phase 1 Test Fact" entries** exist in the knowledge table (Palawan Sunset drink, blue rice, Tikboy the clam). They can't be deleted from admin because the database has **no permission rule for editing or deleting knowledge entries** — only reading and adding are allowed. That's also why bulk upload behaves badly: inserts work, but any fix-up (edit/delete) silently fails.
- **The agent never sees the knowledge base.** Admin fetches the entries to display them, but nothing adds them to TALA's prompt — so pasting data does nothing for the agent.
- **TALA's brain is partly hardcoded.** Her prompt is built from a baked-in script plus the old CMS blob, not from the live database tables where rooms, tours, and motorbikes actually live (`rooms`, `tours_catalog`, `motorbikes`).

## The plan

### 1. Database migration (one approval)
- Add missing **edit** and **delete** permissions on the knowledge table (matching the site's current open-access posture).
- **Delete the 3 Phase 1 mock entries** in the same migration.

### 2. Feed the knowledge base to TALA instantly
- In the TALA widget (and the admin "Test TALA Live" panels), load enabled knowledge entries and append them to the system prompt on every chat send. Saving an entry in admin = the agent knows it on the next message. Prices stay auto-stripped as they are today.

### 3. Connect TALA to the live data tables
- Extend the prompt builder so rooms, tours, and motorbike rentals are read from the live database tables (with the existing CMS data as fallback), so when you change a room rate or tour in admin, TALA says the new thing without anyone touching code.

### 4. Make the Knowledge Base admin user-friendly
- **Quick Add box at the top**: paste any text (one fact per paragraph), click "Add to TALA" — it auto-creates enabled entries with sensible labels. No CSV needed for quick facts.
- Keep CSV bulk upload, but show per-row errors clearly and surface real database errors instead of failing silently.

### Files touched
- One migration (permissions + mock-data cleanup)
- `src/components/tala/TalaWidget.tsx`, `src/components/tala/talaPersona.ts` — knowledge + live data into the prompt
- `src/admin/pages/TalaKnowledgeManager.tsx` — Quick Add UX + error surfacing
- `src/admin/pages/TalaManager.tsx` / `TalaOps.tsx` — pass knowledge into the test panel prompts

### Verification
- Add a fact via Quick Add, ask TALA about it in the widget, confirm she answers with it.
- Confirm the 3 mock facts are gone and TALA no longer mentions Tikboy/blue rice.
- Edit a room rate in admin, ask TALA the rate, confirm the new number.
