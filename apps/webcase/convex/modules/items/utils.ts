/**
 * Validates that a string is a valid HTTP or HTTPS URL
 */
export function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

/**
 * Common tracking parameters to strip from URLs
 */
const TRACKING_PARAMS = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "fbclid",
    "gclid",
    "gclsrc",
    "dclid",
    "msclkid",
    "mc_eid",
    "ref",
    "ref_",
    "_ga",
    "_gl",
    "oly_enc_id",
    "oly_anon_id",
    "vero_id",
    "wickedid",
    "guccounter",
    "guce_referrer",
    "guce_referrer_sig",
    "__hstc",
    "__hssc",
    "__hsfp",
    "hsCtaTracking",
]);

/**
 * Normalizes a URL by:
 * - Removing tracking parameters
 * - Removing trailing slashes (except for root path)
 * - Converting to lowercase hostname
 * - Removing default ports
 * - Sorting remaining query params
 */
export function normalizeUrl(url: string): string {
    try {
        const parsed = new URL(url);

        // Lowercase the hostname
        parsed.hostname = parsed.hostname.toLowerCase();

        // Remove default ports
        if (
            (parsed.protocol === "https:" && parsed.port === "443") ||
            (parsed.protocol === "http:" && parsed.port === "80")
        ) {
            parsed.port = "";
        }

        // Remove tracking parameters and sort remaining ones
        const params = new URLSearchParams(parsed.search);
        const cleanParams = new URLSearchParams();

        const sortedKeys = Array.from(params.keys()).sort();
        for (const key of sortedKeys) {
            if (!TRACKING_PARAMS.has(key.toLowerCase())) {
                const value = params.get(key);
                if (value !== null) {
                    cleanParams.set(key, value);
                }
            }
        }

        parsed.search = cleanParams.toString();

        // Remove hash
        parsed.hash = "";

        // Get the URL string
        let result = parsed.toString();

        // Remove trailing slash unless it's the root path
        if (result.endsWith("/") && parsed.pathname !== "/") {
            result = result.slice(0, -1);
        }

        return result;
    } catch {
        // If parsing fails, return the original URL
        return url;
    }
}
