/**
 * Voltrex Vault - Strict Origin Matching & Security Utility
 * Normalizes, canonicalizes, and verifies web origins according to RFC 6454 and W3C specifications.
 * Enforces subdomain separation, port isolation, and insecure HTTP restrictions.
 */

export interface ParsedOrigin {
  scheme: 'https' | 'http';
  hostname: string;
  port: string;
  origin: string;
}

/**
 * Extracts and canonicalizes an origin from any full URL string.
 * Strips default ports (:443 for https, :80 for http), handles punycode/IDN,
 * and converts hostnames to lowercase.
 */
export function getCanonicalOrigin(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const trimmed = rawUrl.trim();
    // If it has a URI scheme, ensure it is http or https
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
    if (hasScheme && !/^https?:\/\//i.test(trimmed)) {
      return null;
    }

    const withScheme = hasScheme ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }

    const scheme = parsed.protocol.slice(0, -1).toLowerCase() as 'https' | 'http';
    const hostname = parsed.hostname.toLowerCase();

    // Standardize port: omit default ports
    let port = parsed.port;
    if ((scheme === 'https' && port === '443') || (scheme === 'http' && port === '80')) {
      port = '';
    }

    return port ? `${scheme}://${hostname}:${port}` : `${scheme}://${hostname}`;
  } catch {
    return null;
  }
}

/**
 * Parses an origin into its structural components (scheme, hostname, port).
 */
export function parseOrigin(originStr: string): ParsedOrigin | null {
  const canonical = getCanonicalOrigin(originStr);
  if (!canonical) return null;

  try {
    const parsed = new URL(canonical);
    const scheme = parsed.protocol.slice(0, -1).toLowerCase() as 'https' | 'http';
    return {
      scheme,
      hostname: parsed.hostname.toLowerCase(),
      port: parsed.port,
      origin: canonical,
    };
  } catch {
    return null;
  }
}

/**
 * Checks if the origin is safe for credential autofill.
 * By default, plain HTTP is rejected unless it is local loopback (localhost, 127.0.0.1, [::1]).
 */
export function isAllowedAutofillOrigin(originStr: string, allowHttpLoopback = true): boolean {
  const parsed = parseOrigin(originStr);
  if (!parsed) return false;

  if (parsed.scheme === 'https') {
    return true;
  }

  if (parsed.scheme === 'http' && allowHttpLoopback) {
    const host = parsed.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  }

  return false;
}

/**
 * Strictly verifies whether two origins match.
 * Matching requires identical scheme, identical hostname, and identical effective port.
 * Subdomains are strictly isolated: sub.example.com does NOT match example.com.
 */
export function doOriginsMatch(originA: string, originB: string): boolean {
  const canonicalA = getCanonicalOrigin(originA);
  const canonicalB = getCanonicalOrigin(originB);

  if (!canonicalA || !canonicalB) return false;
  return canonicalA === canonicalB;
}

/**
 * Validates a candidate login URL or origin string from user input or DOM form.
 */
export function validateCandidateUrl(rawUrl: string): {
  isValid: boolean;
  origin: string | null;
  error?: string;
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, origin: null, error: 'URL is empty or not a string.' };
  }

  const origin = getCanonicalOrigin(rawUrl);
  if (!origin) {
    return { isValid: false, origin: null, error: 'Malformed or unsupported URL scheme.' };
  }

  if (!isAllowedAutofillOrigin(origin)) {
    return {
      isValid: false,
      origin,
      error: 'Insecure HTTP pages are not permitted for password operations.',
    };
  }

  return { isValid: true, origin };
}
