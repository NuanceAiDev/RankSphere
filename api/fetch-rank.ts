import type { VercelRequest, VercelResponse } from '@vercel/node';

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
      const response = await fetch(`https://api.valueserp.com/search?${params.toString()}`);
      if (!response.ok) {
        return res.status(response.status).json({ error: `ValueSERP upstream error: ${response.status}` });
      }
      data = await response.json();
    } catch (err) {
      console.error(`Proxy fetch failed on page ${page}:`, err);
      return res.status(500).json({ error: 'Failed to fetch SERP data' });
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
