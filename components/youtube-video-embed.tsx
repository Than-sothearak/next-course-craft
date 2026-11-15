import { getYouTubeEmbedUrl } from "@/lib/media/youtube";

export function YouTubeVideoEmbed({
  url,
  title = "YouTube video",
  className,
}: {
  url: string;
  title?: string;
  className?: string;
}) {
  const embedUrl = getYouTubeEmbedUrl(url);
  if (!embedUrl) return null;

  return (
    <div className={`relative w-full overflow-hidden ${className ?? ""}`.trim()}>
      <iframe
        data-youtube-video-embed
        src={embedUrl}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 size-full border-0"
      />
    </div>
  );
}
