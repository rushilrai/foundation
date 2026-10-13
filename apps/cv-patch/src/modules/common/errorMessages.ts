import { MAX_HEADER_LINKS } from '@shared/resumeSchema'

// User-facing text for the `{ error: 'CODE' }` results Convex functions
// return. Unknown codes fall back to a generic message.
const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'You are signed out. Sign in again and retry.',
  FORBIDDEN: 'You do not have access to this resume.',
  USER_NOT_FOUND: 'Your account is still being set up. Try again shortly.',
  RESUME_NOT_FOUND: 'This resume no longer exists.',
  PATCH_NOT_FOUND: 'This variant no longer exists.',
  RESUME_NOT_READY: 'The resume is still being processed. Try again shortly.',
  RATE_LIMITED:
    'You have created too many variants recently. Try again in a few hours.',
  TOO_MANY_HEADER_LINKS: `A resume can have at most ${MAX_HEADER_LINKS} header links.`,
  SKILL_LINK_TEXT_MISSING:
    'Every skill link text must appear in its skill line (once per link). Fix or remove the link and save again.',
  UNSUPPORTED_FILE_TYPE: 'Only .docx files are supported.',
  UPLOAD_FAILED: 'The file could not be uploaded. Try again.',
  PATCHED_FILE_NOT_AVAILABLE: 'The DOCX is not ready yet.',
  PDF_NOT_AVAILABLE: 'The PDF is not ready yet.',
}

export function getErrorMessage(
  code: string,
  fallback = 'Something went wrong. Please try again.',
): string {
  return ERROR_MESSAGES[code] ?? fallback
}
