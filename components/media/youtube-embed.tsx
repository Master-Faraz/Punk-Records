'use client'

/**
 * Extracts YouTube video ID from various YouTube URL formats
 */
export function getYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null
  const cleanUrl = url.trim()

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

interface YouTubeEmbedProps {
  url: string
  title?: string
}

export function YouTubeEmbed({ url, title = 'YouTube video' }: YouTubeEmbedProps) {
  const videoId = getYouTubeVideoId(url)
  if (!videoId) return null

  return (
    <div className="relative my-4 w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-lg aspect-video">
      <iframe
        className="absolute inset-0 h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
      />
    </div>
  )
}
