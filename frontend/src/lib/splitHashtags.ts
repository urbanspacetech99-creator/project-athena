/** Splits a caption into its body text and the hashtags found *anywhere* in it, so
 *  the two can render on separate lines instead of running together inline.
 *
 *  NB: HomeView needs different behaviour — everything from the first hashtag on is
 *  treated as the tag block — and keeps its own splitAtFirstHashtag. The two are not
 *  interchangeable; they return different shapes. */
export function splitHashtags(text: string) {
  const words = text.split(/(\s+)/);
  const caption: string[] = [];
  const tags: string[] = [];
  for (const w of words) {
    if (/^#\S+/.test(w.trim())) tags.push(w.trim());
    else caption.push(w);
  }
  return { caption: caption.join("").trim(), tags };
}
