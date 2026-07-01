import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { keyword, rankType } = req.query as Record<string, string>;

  if (!keyword || !rankType) {
    return res.status(400).json({ error: 'Missing required query parameters: keyword, rankType' });
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

  const params = new URLSearchParams({
    api_key: process.env.VALUESERP_API_KEY ?? '', // Pulled securely from Vercel environment variables
    q: keyword,
    output: 'json',
    // Google deprecated the `num=100` parameter in Sept 2025 — it now silently
    // returns only the first page (~10 results), so keywords ranking at position
    // 10+ were reported as "not found". We instead paginate via `max_page`,
    // which ValueSERP fetches server-side and merges into a single organic_results
    // array with a global `position_overall`. max_page=3 covers the top ~30 results,
    // balancing tracking depth against API credit cost (up to 3 credits per keyword).

    page: '1',
    max_page: '3',
    ...locationParams
  });

  try {
    const response = await fetch(`https://api.valueserp.com/search?${params.toString()}`);

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: `ValueSERP upstream error: ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy fetch failed:', error);
    return res.status(500).json({ error: 'Failed to fetch SERP data' });
  }
}
