import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel defaults serverless functions to a 10s limit, which a 3-page SERP walk could
// exceed — that was the real source of the 504s, not a platform ceiling. 60s is accepted
// on Hobby and Pro alike, and lets this function finish naturally.
export const config = { maxDuration: 60 };

// Per-page ceiling for the upstream ValueSERP call. 3 pages x 20s stays inside the 60s
// budget above, so we always return a JSON error ourselves rather than being killed
// mid-flight and handing the browser an HTML gateway timeout. Early exit means most
// keywords resolve on page 1 in a few seconds.
const UPSTREAM_TIMEOUT_MS = 20_000;

function normalizeDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .trim()
    .toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { keyword, rankType, domain, brandName } = req.query as Record<string, string>;

  if (!keyword || !rankType || !domain) {
    return res.status(400).json({ error: 'Missing required query parameters: keyword, rankType, domain' });
  }

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

  // Fetch pages 1-3 one at a time, returning as soon as the client's domain is found.
  // Early exit means a page-1 hit costs 1 credit instead of 3, and keeps each
  // serverless invocation well under Vercel's 10s timeout.
  // Google deprecated num=100 in Sept 2025, so single-page requests cap at ~10 results;
  // we compensate by checking up to 3 pages (top ~30 results).
  for (let page = 1; page <= 3; page++) {
    const params = new URLSearchParams({
      api_key: process.env.VALUESERP_API_KEY ?? '', // Pulled securely from Vercel environment variables
      q: keyword,
      output: 'json',
      page: String(page),
      ...locationParams
    });

    let data: any;
    try {
      // Cap each upstream call. Without this a hung ValueSERP request stalls the whole
      // function until the platform kills it, and the browser gets an HTML 504 gateway
      // page instead of JSON — which is what left the UI spinning.
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
        return res.status(200).json({ rank: localMatch.position, url: localMatch.website || localMatch.link || '' });
      }
    }

    // B. Organic results — position_overall gives the true global rank; fall back to
    //    calculating it from the page number if ValueSERP omits it on single-page requests.
    const organicMatch = data.organic_results?.find((item: any) =>
      item.link?.toLowerCase().includes(cleanDomain)
    );
    if (organicMatch) {
      const rank = organicMatch.position_overall ?? (organicMatch.position + (page - 1) * 10);
      return res.status(200).json({ rank, url: organicMatch.link });
    }
  }

  return res.status(200).json({ rank: null, url: null });
}
