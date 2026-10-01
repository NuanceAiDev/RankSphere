import type { VercelRequest, VercelResponse } from '@vercel/node';

// One invocation = one SERP page = exactly one upstream request.
//
// This function used to walk pages 1-3 itself, so a single call could take ~3x as long as
// the SERP API did and blow past Vercel's 10s default. The page loop now lives in the
// browser (src/lib/valueserp.ts), which calls this once per page and stops as soon as the
// client's domain is found. Each invocation therefore finishes in roughly the time of one
// ValueSERP request (~2-5s), comfortably inside the free tier's limit with no maxDuration
// configured — and the API key still never leaves the server.
const UPSTREAM_TIMEOUT_MS = 8_000;

const MAX_PAGE = 3;

function normalizeDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .trim()
    .toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { keyword, rankType, domain, brandName, page: pageParam } = req.query as Record<string, string>;

  if (!keyword || !rankType || !domain) {
    return res.status(400).json({ error: 'Missing required query parameters: keyword, rankType, domain' });
  }

  // Default to page 1 so older callers keep working; clamp so a bad value can't request
  // an unbounded number of pages (every page costs a credit).
  const parsedPage = Number.parseInt(pageParam ?? '1', 10);
  const page = Number.isFinite(parsedPage) ? Math.min(Math.max(parsedPage, 1), MAX_PAGE) : 1;

  // Strict geo-parameters per market — prevents SERP localization mismatches
  let locationParams: Record<string, string>;
  if (rankType.toLowerCase() === 'dubai') {
    locationParams = {
      location: 'Dubai, Dubai, United Arab Emirates',
      google_domain: 'google.ae',
      gl: 'ae',
      hl: 'en'
    };
  } else {
    // Default to Qatar — city-level targeting matches local Doha browser results
    locationParams = {
      location: 'Doha, Doha, Qatar',
      google_domain: 'google.com.qa',
      gl: 'qa',
      hl: 'en'
    };
  }

  const cleanDomain = normalizeDomain(domain);
  const titleFallback = brandName?.toLowerCase() || cleanDomain.split('.')[0];

  const params = new URLSearchParams({
    api_key: process.env.VALUESERP_API_KEY ?? '', // Pulled securely from Vercel environment variables
    q: keyword,
    output: 'json',
    page: String(page),
    ...locationParams
  });

  let data: any;
  try {
    const response = await fetch(`https://api.valueserp.com/search?${params.toString()}`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `ValueSERP upstream error: ${response.status}` });
    }
    data = await response.json();
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.error(`Proxy fetch failed on page ${page}:`, err);
    // Always answer with JSON so the client can report a real reason instead of hanging.
    return res.status(timedOut ? 504 : 500).json({
      error: timedOut
        ? `ValueSERP timed out after ${UPSTREAM_TIMEOUT_MS}ms on page ${page}`
        : 'Failed to fetch SERP data'
    });
  }

  // A. Map Pack (local_results) — only appears on page 1.
  //    Some businesses have no website button, so we fall back to title matching.
  if (page === 1) {
    const localMatch = data.local_results?.find((item: any) =>
      item.website?.toLowerCase().includes(cleanDomain) ||
      item.link?.toLowerCase().includes(cleanDomain) ||
      item.title?.toLowerCase().includes(titleFallback)
    );
    if (localMatch) {
      return res.status(200).json({
        rank: localMatch.position,
        url: localMatch.website || localMatch.link || '',
        page
      });
    }
  }

  // B. Organic results — position_overall gives the true global rank; fall back to
  //    calculating it from the page number if ValueSERP omits it on single-page requests.
  const organicMatch = data.organic_results?.find((item: any) =>
    item.link?.toLowerCase().includes(cleanDomain)
  );
  if (organicMatch) {
    const rank = organicMatch.position_overall ?? (organicMatch.position + (page - 1) * 10);
    return res.status(200).json({ rank, url: organicMatch.link, page });
  }

  // Not on this page. The caller decides whether to request the next one.
  return res.status(200).json({ rank: null, url: null, page });
}
