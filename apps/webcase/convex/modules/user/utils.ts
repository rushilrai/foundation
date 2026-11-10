import { WebhookEvent } from '@clerk/tanstack-react-start/webhooks'
import { Webhook } from 'svix'

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
    // svix 2's verify() only checks the signature and returns nothing
    wh.verify(payloadString, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
    return JSON.parse(payloadString) as WebhookEvent
  } catch (error) {
    console.error('Error verifying webhook signature', error)
    return null
  }
}
