// Instagram, the network part (the URL-only part is
// shared/sites/instagram.ts). A page titled with the login wall is not
// the content, so it counts as unread and the URL's title stands in
// ("@fatlulus on Instagram" for a profile). Posts and reels, which
// Instagram serves crawlers in full, are read from their page as usual.

import {
  INSTAGRAM_LOGIN_TITLES,
  isInstagramUrl,
} from '../../../../shared/sites/instagram'
import type { Site } from './types'

export const instagram: Site = {
  name: 'Instagram',
  match: (url) =>
    isInstagramUrl(url)
      ? {
          domain: 'instagram.com',
          provides: { description: false, image: false },
          cleanPage: (metadata) =>
            metadata.title &&
            INSTAGRAM_LOGIN_TITLES.includes(metadata.title.trim())
              ? null
              : metadata,
        }
      : null,
}
