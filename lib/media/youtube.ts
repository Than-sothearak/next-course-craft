const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const videoIdPattern = /^[\w-]{11}$/;

function getStartTime(url: URL) {
  const value = url.searchParams.get("start") ?? url.searchParams.get("t");
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);

  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!match || !match[0]) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

/** Convert supported YouTube share URLs into a privacy-enhanced embed URL. */
export function getYouTubeEmbedUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    !youtubeHosts.has(url.hostname.toLowerCase())
  ) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  let videoId: string | null = null;
  const hostname = url.hostname.toLowerCase();

  if (hostname === "youtu.be" || hostname === "www.youtu.be") {
    videoId = segments[0] ?? null;
  } else if (segments[0] === "watch") {
    videoId = url.searchParams.get("v");
  } else if (["embed", "shorts", "live", "v"].includes(segments[0] ?? "")) {
    videoId = segments[1] ?? null;
  }

  if (!videoId || !videoIdPattern.test(videoId)) return null;

  const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  const startTime = getStartTime(url);
  if (startTime && Number.isSafeInteger(startTime)) {
    embedUrl.searchParams.set("start", String(startTime));
  }
  return embedUrl.toString();
}
