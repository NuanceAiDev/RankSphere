import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { keyword, rankType } = req.query as Record<string, string>;

  if (!keyword || !rankType) {
    return res.status(400).json({ error: 'Missing required query parameters: keyword, rankType' });
  }

  // Strict geo-parameters per market — prevents SERP localization mismatches
  let googleDomain: string;
  let countryCode: string;
  if (rankType.toLowerCase() === 'dubai') {
    googleDomain = 'google.ae';
    countryCode = 'ae'; // Bright Data 2-letter country code for UAE
  } else {
    // Default to Qatar — city-level targeting matches local Doha browser results
    googleDomain = 'google.com.qa';
    countryCode = 'qa'; // Bright Data 2-letter country code for Qatar
  }

  // Build the target Google search URL — num=100 requests exactly 100 organic results
  // encodeURIComponent ensures keywords with spaces/special chars don't break the URL
  const targetUrl = `https://www.${googleDomain}/search?q=${encodeURIComponent(keyword)}&num=100&hl=en&gl=${countryCode}`;

  const brightDataPayload = {
    zone: process.env.BRIGHTDATA_ZONE ?? 'serp_api1', // Bright Data SERP API zone name
    url: targetUrl,
    format: 'json',    // Request structured parsed JSON response
    country: countryCode, // Bright Data 2-letter country code for geo-targeting
  };

  try {
    const response = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BRIGHTDATA_API_KEY ?? ''}`,
      },
      body: JSON.stringify(brightDataPayload),
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: `Bright Data upstream error: ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy fetch failed:', error);
    return res.status(500).json({ error: 'Failed to fetch SERP data' });
  }
}
