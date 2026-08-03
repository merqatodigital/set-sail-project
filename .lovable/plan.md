# Fix TALA chat error, voice lag, and the stuck loading spinner

Three regressions came back with the last sync. All three are confirmed in the current code. No design or copy changes.

## 1. TALA chat backend is broken (why you see the error in the chat bubble)

In the TALA chat function there is a line missing its `const` keyword:

```text
supabase/functions/tala-chat/index.ts (inside runDailyOpsTool)
  alerts: string[] = [];      ->  const alerts: string[] = [];
```

That single line is a parse error, so the whole function fails to load and every guest/owner message returns a 5xx. Fix: add the missing keyword, redeploy `tala-chat`, then send a real test message and confirm a reply comes back (this also clears the 503 errors in the logs).

Also verify the `TALA_TOOL_SCHEMAS is not defined` message in your screenshot: the import exists in the current code, so the most likely cause is that you were on the previously published bundle. After the redeploy I'll reload the chat and confirm the message is gone; if it still appears I'll trace the import chain in `talaTools.ts` and fix it.

## 2. TALA voice laggy and robotic again

The earlier responsiveness fixes were reverted. Restore them exactly as before:

- Bring the Kokoro wait cap back down (45s of silence -> ~8s) so the natural voice doesn't stall and the browser ("robotic") voice isn't used as often.
- Restore the pipelined synthesis so the next chunk is generated while the current one plays, instead of one network round-trip per chunk.
- Restore the `active` option and pass `active: open` from the widget, so the ~80 MB voice model only downloads when someone actually opens the chat, not on every page load.
- Restore `rec.stop()` on the first final speech result so there's no ~1.5s trailing pause before the turn is sent.
- Restore the lazy/Suspense boundary around the TALA widget in `PublicLayout.tsx` so the widget bundle doesn't load on first paint.

Voice quality stays on the `q8` model — the low quants are what made it sound robotic, so that does not change.

## 3. Site can get stuck on "Loading Marina Terrace…"

`CmsProvider` currently starts with no data and blocks the entire site behind the spinner until the database responds, and the database fetch has no timeout. Fix:

- Restore the synchronous cached read so returning visitors paint instantly from local content, then refresh from the database in the background.
- Restore the 6s timeout on the `cms_data` fetch so a stalled request falls back to cached/default content instead of spinning forever.
- Keep the spinner only for the genuine first-load-with-no-cache case.

## Also (quiet fix)

Saving content is hitting the browser storage quota (`marina-terrace-cms-v1 exceeded the quota`) because images are stored inline in the cached copy. I'll make the local cache tolerate that instead of throwing an unhandled error, so admin saves never break the page.

## Verification before I report done

- Redeploy `tala-chat` and send a live message; confirm a reply, not an error.
- Load the site with a cold and a warm cache and confirm no indefinite spinner.
- Open TALA, confirm the natural voice speaks quickly and the model isn't fetched before the chat is opened.
