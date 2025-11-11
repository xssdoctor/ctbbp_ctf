const DEFAULT_PARAM = 'q';

export const DEEP_LINK_QUERY_PARAM = DEFAULT_PARAM;

/**
 * Attempts to extract the raw query value for the deep-link param.
 * Falls back to treating a bare query string (e.g. "/?hello") as the prompt.
 *
 * @param {string} search - window.location.search style string (with or without leading "?").
 * @param {string} paramName - The primary query parameter to read (defaults to "q").
 * @returns {{ rawValue: string, mode: 'param' | 'entire' } | null}
 */
export function extractDeepLinkQuery(search, paramName = DEFAULT_PARAM) {
  if (!search || search === '?') {
    return null;
  }

  const normalizedSearch = search.startsWith('?') ? search : `?${search}`;
  const params = new URLSearchParams(normalizedSearch);

  if (params.has(paramName)) {
    return {
      rawValue: params.get(paramName) ?? '',
      mode: 'param'
    };
  }

  const fallback = normalizedSearch.slice(1);
  if (!fallback || fallback.includes('=')) {
    return null;
  }

  return {
    rawValue: fallback,
    mode: 'entire'
  };
}

/**
 * Decodes a query value, tolerating malformed encodings and "+" spacing.
 *
 * @param {string} value
 * @returns {string}
 */
export function decodeDeepLinkValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }

  return decoded.replace(/\+/g, ' ');
}
