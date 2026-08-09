# Cloudflare AI Search — External Setup (required before live grounding)

The `searchResortKnowledge` tool is fully wired in code. Live retrieval requires
a Cloudflare AI Search index that you must create in the dashboard and populate
with the corpus. Nothing below is hardcoded in the Worker — all values come from
`wrangler` `vars`/`secret`.

## 1. Create the AI Search index
- Cloudflare dashboard → AI → AI Search → Create index.
- Name it exactly: `marina-terrace-knowledge` (matches `AI_SEARCH_INDEX` var).
- Note your Cloudflare **Account ID** (dash.cloudflare.com → right sidebar).

## 2. Upload the corpus
- Upload `worker/ai-search-corpus/marina-terrace-knowledge.md` to the index
  (dashboard "Add data" / ingestion API). Each `## category: ... | audience: ...`
  section becomes a retrievable passage. AI Search auto-splits long docs.
- Ensure passages carry `audience` (guest|owner) and `category` metadata so the
  role filter (`metadata_filter`) works. If your ingestion doesn't carry
  metadata automatically, set it during upload.

## 3. Create an API token
- dash.cloudflare.com → My Profile → API Tokens → Create Token.
- Permissions: **AI Search** → *AI Search: Edit* (or at least *Read*).
- Set the token as a secret (never commit it):
  `npx wrangler secret put AI_SEARCH_TOKEN --config worker/wrangler.staging.jsonc`

## 4. Set the non-secret config (already in wrangler.staging.jsonc vars)
- `AI_SEARCH_ACCOUNT_ID` = your Account ID (currently a `REPLACE_WITH_...`
  placeholder — set the real value).
- `AI_SEARCH_INDEX` = `marina-terrace-knowledge` (already set).

## 5. Redeploy
`npx wrangler deploy --config worker/wrangler.staging.jsonc`

After this, the grounding tests (El Nido guide, Starlink SOP, kitchen rules,
staff pre-arrival SOP) will retrieve real passages. Until then the tool
degrades gracefully: it reports "AI Search index not found" (404) or "not
configured" and TALA answers that it has no grounded information rather than
inventing policy.

## Role safety
- Guests: queries send `metadata_filter: { audience: "guest" }` so only
  guest-safe passages are returned.
- Owner/admin: no audience restriction (may see operational/SOP docs).
- Access control is enforced at the search layer (not only the LLM prompt).
