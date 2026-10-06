// Tag each response with the feed it came from.
// The loop fetches one feed per run, so run N belongs to feed N in the list.
// Tagging here means every record — and every error — is credited to the right feed.
const feeds = $('__LIST__').all();
const feed = feeds[$runIndex]?.json;
if (!feed) throw new Error(`No feed at position ${$runIndex} in __LIST__`);
return $input.all().map((i) => ({ json: { ...i.json, _feed: feed } }));
