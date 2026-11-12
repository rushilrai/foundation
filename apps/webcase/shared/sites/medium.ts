// Medium articles carry their title in the slug:
// medium.com/<@user or publication>/<slug>-<id>, <name>.medium.com/<slug>-<id>
// and <publication host>/<slug>-<id>. Only with the trailing post id, so
// profiles, tags and /about keep host and path.

import { decodePath, hostOf, pathSegments, type UrlRule } from './types'

// Medium publications on their own domains that keep Medium's article
// URLs (/<slug>-<hex id>). Only domains checked to still serve them: their
// /feed lists articles in that shape. betterprogramming.pub (moved to
// medium.com/better-programming), towardsdatascience.com and
// medium.freecodecamp.org (left Medium) are not.
const MEDIUM_PUBLICATION_HOSTS: ReadonlySet<string> = new Set([
  'blog.devgenius.io',
  'levelup.gitconnected.com',
  'javascript.plainenglish.io',
  'python.plainenglish.io',
  'uxdesign.cc',
  'itnext.io',
  'proandroiddev.com',
])

// Medium's post id, the end of every article slug: 10 to 12 hex digits.
// Requiring a digit keeps a long word made of a–f out.
const MEDIUM_POST_ID = /^(?=[a-z]*\d)[0-9a-f]{10,12}$/

const bareHost = (url: URL): string => hostOf(url).replace(/^www\./, '')

// An article slug, "what-flutter-apps-are-missing-3a896f9f4c09" → "What
// flutter apps are missing"; null for anything without the post id.
const mediumSlugTitle = (segment: string): string | null => {
  const tokens = decodePath(segment).split('-').filter(Boolean)
  if (tokens.length < 2 || !MEDIUM_POST_ID.test(tokens[tokens.length - 1])) {
    return null
  }

  const text = tokens.slice(0, -1).join(' ')
  return /\p{L}/u.test(text)
    ? `${text.charAt(0).toUpperCase()}${text.slice(1)}`
    : null
}

export const medium: UrlRule = {
  name: 'Medium',
  match: (url) => {
    const host = bareHost(url)
    return (
      host === 'medium.com' ||
      host.endsWith('.medium.com') ||
      MEDIUM_PUBLICATION_HOSTS.has(host)
    )
  },
  title: (url) => {
    const segments = pathSegments(url)
    const onMedium = bareHost(url) === 'medium.com'
    return segments.length === (onMedium ? 2 : 1)
      ? mediumSlugTitle(segments[segments.length - 1])
      : null
  },
}
