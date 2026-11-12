// npmjs.com refuses Convex's servers (403), so a package's name and
// description come from the registry.

import { asRecord, hostOf, stringField, type Site } from './types'

const HOSTS = new Set(['npmjs.com', 'www.npmjs.com'])
// A package name, scoped or not, as npm allows it.
const PACKAGE_PATH =
  /^\/package\/((?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*)(?:\/|$)/i

export const npm: Site = {
  name: 'npm',
  match: (url) => {
    if (!HOSTS.has(hostOf(url))) {
      return null
    }
    let path = url.pathname
    try {
      path = decodeURIComponent(path)
    } catch {
      return null
    }
    const name = PACKAGE_PATH.exec(path)?.[1]
    if (!name || name.length > 214) {
      return null
    }

    return {
      domain: 'npmjs.com',
      provides: { description: true, image: false },
      resolve: async (getJson) => {
        const body = asRecord(
          await getJson(
            `https://registry.npmjs.org/${encodeURIComponent(name.toLowerCase())}/latest`,
          ),
        )
        const title = stringField(body, 'name')
        if (!title) {
          return null
        }

        return { title, description: stringField(body, 'description') }
      },
    }
  },
}
