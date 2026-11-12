// YouTube's hosts, shared because the normaliser drops YouTube's share id
// (`?si=`) on them and the YouTube site rule (convex/lib/metadata/sites)
// matches videos on them.

export const YOUTUBE_HOSTS: ReadonlySet<string> = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
])

export const YOUTU_BE_HOST = 'youtu.be'
