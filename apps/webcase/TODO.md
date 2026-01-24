# TODO: Auth Flow & User Sync

## Sign-in Flow

### Routes to Create

1. **`/` (landing page)**
   - Public route
   - Shows app description + "Sign In" CTA
   - If user is authenticated → redirect to `/home`

2. **`/sign-in`**
   - Public route
   - Renders Clerk's `<SignIn />` component
   - After sign-in → redirect to `/home`

3. **`/home`**
   - Protected route (requires authentication)
   - Main dashboard for authenticated users

### Implementation Notes

- Use Clerk's prebuilt components: `<SignIn />`, `<SignedIn>`, `<SignedOut>`, `<RedirectToSignIn>`
- Protect `/home` route using `beforeLoad` with `auth()` check
- Landing page can use `<SignedIn>` / `<SignedOut>` for conditional rendering

---

## User Sync via Webhooks

### Setup Required

1. **Create Convex HTTP endpoint** at `convex/http.ts`
   - Handle `POST /clerk-webhook`
   - Verify webhook signature using `svix`
   - Process events: `user.created`, `user.updated`, `user.deleted`

2. **Install dependency**
   ```bash
   npm install svix
   ```

3. **Add webhook secret to env**
   ```
   CLERK_WEBHOOK_SECRET=whsec_xxx
   ```

4. **Configure Clerk Dashboard**
   - Go to Webhooks → Add Endpoint
   - URL: `https://<convex-deployment>.convex.site/clerk-webhook`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy signing secret to env

### Webhook Handler Pseudocode

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { Webhook } from "svix";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: async (ctx, req) => {
    // 1. Verify signature with svix
    // 2. Parse event type
    // 3. Call internal mutation to sync user
  },
});
```

### Events to Handle

| Event | Action |
|-------|--------|
| `user.created` | Insert new user into `users` table |
| `user.updated` | Update existing user |
| `user.deleted` | Delete user from `users` table |
