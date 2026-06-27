import { internal } from 'convex/_generated/api'
import { httpAction } from 'convex/_generated/server'

import { validateClerkUserWebhookRequest } from './utils'

export const handleClerkUserWebhook = httpAction(async (ctx, request) => {
  const event = await validateClerkUserWebhookRequest(request)

  if (!event) {
    return new Response('Invalid webhook request', { status: 400 })
  }

  console.log('Clerk user webhook event', event.type)

  switch (event.type) {
    case 'user.created':
    case 'user.updated': {
      const { id, email_addresses, first_name, last_name, image_url } =
        event.data

      const upsertResult = await ctx.runMutation(
        internal.modules.user.mutations.upsertFromClerk,
        {
          externalId: id,
          email: email_addresses[0].email_address,
          firstName: first_name ?? '',
          lastName: last_name ?? '',
          imageUrl: image_url ?? null,
        },
      )

      if ('error' in upsertResult) {
        console.error('Error upserting user', upsertResult.error)

        return new Response('Internal error', { status: 500 })
      }

      console.log('User upserted', { userId: upsertResult.userId })
      break
    }

    case 'user.deleted': {
      const { id: externalId } = event.data

      if (!externalId) {
        console.warn('user.deleted event missing id')
        return new Response('OK', { status: 200 })
      }

      const deleteResult = await ctx.runMutation(
        internal.modules.user.mutations.markAsDeleted,
        {
          externalId,
        },
      )

      if ('error' in deleteResult) {
        console.error('Error marking user as deleted', deleteResult.error)

        return new Response('Internal error', { status: 500 })
      }

      if (deleteResult.alreadyDeleted) {
        console.log('User already deleted', { externalId })
      } else {
        console.log('User marked as deleted', { externalId })
      }
      break
    }

    default:
      console.log('Ignored Clerk webhook event type', event.type)
  }

  return new Response('OK', { status: 200 })
})
