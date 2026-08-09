/**
 * Strip a model's internal chain-of-thought from generated owner-facing text
 * (briefings, replies) so only the final answer is persisted/displayed.
 *
 * The free reasoning model sometimes emits its monologue into the output. The
 * marker phrases below never appear in a legitimate owner briefing, so dropping
 * them is safe. We also trim everything before the first Markdown heading,
 * since the real briefing begins there and the preamble is narration.
 */
export function sanitizeBriefing(raw: string): string {
  const cotMarkers = [
    "we need to",
    "the instruction",
    "we should comply",
    "let me think",
    "we'll produce",
    "as an ai",
    "chain of thought",
    "reasoning trace",
    "we can use markdown",
    "to be safe, we can",
    "let's interpret",
    "that's for normal",
    "however the user",
    "but the user asks",
  ];
  const lines = raw.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const low = line.toLowerCase().trim();
    if (cotMarkers.some((m) => low.includes(m))) continue;
    kept.push(line);
  }
  let out = kept.join("\n").trim();
  const firstHeading = out.search(/^#{1,6}\s/m);
  if (firstHeading > 0) out = out.slice(firstHeading).trim();
  return out;
}
