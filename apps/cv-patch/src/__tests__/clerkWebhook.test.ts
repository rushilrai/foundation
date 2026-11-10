import { Webhook } from 'svix'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { validateClerkUserWebhookRequest } from '../../convex/modules/user/utils'

const SECRET = 'whsec_' + Buffer.from('test-signing-secret').toString('base64')

const event = {
  type: 'user.created',
  object: 'event',
  data: { id: 'user_123', email_addresses: [] },
}

function signedRequest(body: string, signedBody = body) {
  const id = 'msg_123'
  const timestamp = new Date()
  const signature = new Webhook(SECRET).sign(id, timestamp, signedBody)
  return new Request('https://example.com/clerk-users-webhook', {
    method: 'POST',
    body,
    headers: {
      'svix-id': id,
      'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'svix-signature': signature,
    },
  })
}

describe('validateClerkUserWebhookRequest', () => {
  let previousSecret: string | undefined

  beforeEach(() => {
    previousSecret = process.env.CLERK_USER_WEBHOOK_SECRET
    process.env.CLERK_USER_WEBHOOK_SECRET = SECRET
  })

  afterEach(() => {
    process.env.CLERK_USER_WEBHOOK_SECRET = previousSecret
  })

  it('returns the parsed event for a correctly signed payload', async () => {
    const result = await validateClerkUserWebhookRequest(
      signedRequest(JSON.stringify(event)),
    )
    expect(result).toEqual(event)
  })

  it('rejects a payload that does not match its signature', async () => {
    const tampered = JSON.stringify({ ...event, type: 'user.deleted' })
    const result = await validateClerkUserWebhookRequest(
      signedRequest(tampered, JSON.stringify(event)),
    )
    expect(result).toBeNull()
  })

  it('rejects a request without svix headers', async () => {
    const result = await validateClerkUserWebhookRequest(
      new Request('https://example.com/clerk-users-webhook', {
        method: 'POST',
        body: JSON.stringify(event),
      }),
    )
    expect(result).toBeNull()
  })
})
