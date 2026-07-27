// Latest videos from the Complaint Boss YouTube channel.
//
// Read from the channel's public RSS feed — no API key, no quota, and no
// third-party dependency. Cached in memory so the homepage never waits on
// YouTube, and the last good result is kept as a fallback when the feed is
// slow or down: a stale video list is far better than an empty section.
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCc4xh9LkQcNFZIzJnv1fEiA';
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

const TTL = 30 * 60 * 1000;      // refresh at most twice an hour
const TIMEOUT = 6000;

let cache = { at: 0, videos: [] };
let inFlight = null;

function decode(s) {
  return String(s)
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parse(xml) {
  const out = [];
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  for (const e of entries) {
    const id = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = (e.match(/<title>([^<]+)<\/title>/) || [])[1];
    const published = (e.match(/<published>([^<]+)<\/published>/) || [])[1];
    if (!id) continue;
    out.push({
      id,
      title: decode(title || '').replace(/\s*\|\s*Complaint Boss\s*#?shorts?\s*$/i, '').trim(),
      published: published || '',
      url: `https://www.youtube.com/watch?v=${id}`,
      // Original-aspect thumbnail: vertical for Shorts, rather than the
      // pillarboxed 4:3 that hqdefault returns.
      thumb: `https://i.ytimg.com/vi/${id}/oardefault.jpg`
    });
  }
  return out;
}

async function refresh() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(FEED_URL, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
    const videos = parse(await res.text());
    if (videos.length) cache = { at: Date.now(), videos };
    return cache.videos;
  } finally {
    clearTimeout(timer);
  }
}

// Never throws: on failure the caller gets whatever was last cached.
async function getVideos(limit = 6) {
  const fresh = Date.now() - cache.at < TTL;
  if (!fresh && !inFlight) {
    inFlight = refresh()
      .catch((e) => { console.error('youtube feed failed:', e && e.message); return cache.videos; })
      .finally(() => { inFlight = null; });
  }
  // Serve the cache immediately if we have one; only block on a cold start.
  if (!cache.videos.length && inFlight) await inFlight;
  return cache.videos.slice(0, limit);
}

module.exports = { getVideos, CHANNEL_ID };
