// The URL-only parts of the site rules (see types.ts), consulted before
// anything is read; a link no rule matches is left to the base workflow.
// To add one, write shared/sites/<site>.ts and list it here. The network
// parts are listed in convex/lib/metadata/sites/index.ts.

import { googleMaps } from './googleMaps'
import { instagram } from './instagram'
import { medium } from './medium'
import { redirectWrappers } from './redirectWrappers'
import type { UrlRule } from './types'

// First match wins: wrappers come first, because google.com/url is a
// wrapper and not a Maps page.
const URL_RULES: ReadonlyArray<UrlRule> = [
  redirectWrappers,
  googleMaps,
  medium,
  instagram,
]

export const urlRuleFor = (url: URL): UrlRule | null =>
  URL_RULES.find((rule) => rule.match(url)) ?? null
