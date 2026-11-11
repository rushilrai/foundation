// Limits shared by the browser and Convex. The server enforces them
// (trimming or rejecting); screens use them for maxLength and hints.

// A saved link's URL, after normalisation.
export const MAX_URL_LENGTH = 2048
export const MAX_TITLE_LENGTH = 300
export const MAX_DESCRIPTION_LENGTH = 500
export const MAX_DOMAIN_LENGTH = 253
export const MAX_IMAGE_URL_LENGTH = 2048
// An `ask` question, after whitespace is collapsed.
export const MAX_QUESTION_LENGTH = 500
// Rows per `importMany` call; send a large export in batches of this size.
export const MAX_IMPORT_BATCH = 100

// Imported links are enriched one every IMPORT_SPACING_MS, so a large
// import doesn't burst page fetches and model calls.
export const IMPORT_SPACING_MS = 1_500
// Links one user may import per day (the `importLinks` rate limit). A
// larger export imports over several days: running it again skips the
// links already in.
export const DAILY_IMPORT_LIMIT = 1_000
// Links one library may hold. Home, tag statistics and `ask` read the
// whole library at once, so it must stay well inside Convex's read limits.
export const MAX_LINKS_PER_USER = 5_000
// A pending summary this far past its due time is stuck and may be retried.
export const SUMMARY_STUCK_AFTER_MS = 10 * 60_000

// A new account's password, checked by the sign-up form and by Better Auth.
export const MIN_PASSWORD_LENGTH = 8
