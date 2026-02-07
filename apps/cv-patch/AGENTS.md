# AGENTS.md - CV Patch

Agentic coding guidelines for the CV Patch application.

## Project Overview

CV Patch is a TanStack Start/React application for managing and patching resumes. It uses Convex as the backend, Clerk for authentication, and Tailwind CSS for styling.

## Build/Lint/Test Commands

```bash
# Development
pnpm dev              # Start dev server on port 3000

# Build
pnpm build            # Production build with Vite
pnpm preview          # Preview production build

# Testing
pnpm test             # Run all tests with Vitest
pnpm test -- resumeSchema.test.ts  # Run single test file
pnpm vitest run --reporter=verbose   # Run with verbose output

# Linting & Formatting
pnpm lint             # Run ESLint
pnpm format           # Run Prettier
pnpm check            # Format and fix linting issues
```

## Code Style Guidelines

### Formatting

- **Semicolons**: Disabled (`semi: false`)
- **Quotes**: Single quotes preferred
- **Trailing commas**: Required (`"all"`)
- Prettier handles formatting - run `npm run check` before committing

### TypeScript Configuration

- ES2022 target with DOM libraries
- JSX transform: `react-jsx`
- Module resolution: `bundler`
- Strict mode enabled
- Path aliases: `@/*` → `./src/*`, `@convex/*`, `@shared/*`

### Import Conventions

**Order (grouped with blank lines):**

1. External libraries (React, TanStack, etc.)
2. Internal generated types (`convex/_generated/*`)
3. Shared modules (`@shared/*`)
4. Components (`@/components/*`)
5. Local imports (`./helpers`, `./types`)

**Examples:**

```typescript
// React/external first
import { useState } from 'react'
import { Link } from '@tanstack/react-router'

// Convex generated types
import type { Doc } from '@convex/_generated/dataModel.js'
import { query } from '@convex/_generated/server'

// Shared schemas
import { ResumeDataSchema } from '@shared/resumeSchema'

// Components
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Local
import { getById } from './helpers'
```

### Naming Conventions

| Type             | Convention                  | Example                              |
| ---------------- | --------------------------- | ------------------------------------ |
| Components       | PascalCase                  | `ResumeCard.tsx`, `PatchPreview.tsx` |
| Hooks            | camelCase with `use` prefix | `useAuth()`                          |
| Functions        | camelCase                   | `getById()`, `handleSubmit()`        |
| Constants        | UPPER_SNAKE_CASE            | `CONVEX_URL`                         |
| Types/Interfaces | PascalCase                  | `ResumeCardProps`, `Doc<'resumes'>`  |
| Files            | camelCase/PascalCase        | `resumeSchema.ts`, `ResumeCard.tsx`  |
| Convex queries   | camelCase                   | `list`, `get`, `create`              |
| Convex mutations | camelCase                   | `create`, `update`, `remove`         |

### Component Patterns

**Functional components with explicit return types:**

```typescript
type ResumeCardProps = {
  resume: Doc<'resumes'>
}

export const ResumeCard = ({ resume }: ResumeCardProps) => {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      {/* ... */}
    </Card>
  )
}
```

**Props destructuring:** Always destructure props in the parameter list.

### Tailwind CSS Conventions

- Use `cn()` utility from `@/components/lib/utils` for conditional classes
- Prefer semantic color variables (`bg-primary`, `text-muted-foreground`)
- Use Tailwind v4 syntax (no arbitrary values when possible)
- Transitions: `transition-colors`, `transition-all` with hover states

### Convex Patterns

**Queries:**

```typescript
export const list = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ resumes: Array<Doc<'resumes'>> } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }
    // ...
  },
})
```

**Mutations:** Return `{ success: true }` or `{ error: 'ERROR_CODE' }` pattern.

**Error Handling:** Return error objects instead of throwing in Convex handlers.

### Error Handling

- **Convex**: Return `{ error: 'ERROR_CODE' }` objects, check with `"error" in result`
- **React**: Use error boundaries at route level
- **Console**: Log errors with descriptive messages: `console.error('Error creating resume', error)`

### File Organization

```
src/
  components/
    ui/           # shadcn/ui components
    lib/          # Utilities (cn, etc.)
    hooks/        # React hooks
  modules/
    resume/       # Feature modules
      components/
    patch/
      components/
    common/
  routes/         # TanStack Router routes
  __tests__/      # Test files
convex/
  modules/
    resume/       # Convex functions grouped by domain
      queries.ts
      mutations.ts
      actions.ts
      helpers.ts
shared/           # Shared schemas/types
```

### Testing

- Use Vitest with `@testing-library/react`
- Place tests in `src/__tests__/` or co-locate as `*.test.ts`
- Use `describe` and `it` blocks for organization
- Test file naming: `[module].test.ts`

### Environment Variables

- Frontend: `VITE_*` prefixed variables only
- Required: `VITE_CONVEX_URL`

### Pre-commit Checklist

1. Run `pnpm check` to format and fix lint issues
2. Run `pnpm test` to ensure tests pass
3. Verify TypeScript compiles (`pnpm tsc --noEmit`)

## Key Dependencies

- **Framework**: TanStack Start + React 19 + Vite
- **Backend**: Convex
- **Auth**: Clerk
- **Styling**: Tailwind CSS v4 + shadcn/ui (base-nova style)
- **Forms**: TanStack Form with Zod adapter
- **Testing**: Vitest + React Testing Library
- **Icons**: Tabler Icons
