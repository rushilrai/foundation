import { Webhook } from 'svix'
import type { WebhookEvent } from '@clerk/tanstack-react-start/webhooks'

export async function validateClerkUserWebhookRequest(
  req: Request,
): Promise<WebhookEvent | null> {
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('Missing svix headers', {
      svixId,
      svixTimestamp,
      svixSignature,
    })
    return null
  }

  const webhookSecret = process.env.CLERK_USER_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('CLERK_USER_WEBHOOK_SECRET is not configured')
    return null
  }

  const payloadString = await req.text()

  const wh = new Webhook(webhookSecret)

  try {
    return wh.verify(payloadString, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent
  } catch (error) {
    console.error('Error verifying webhook signature', error)
    return null
  }
}
