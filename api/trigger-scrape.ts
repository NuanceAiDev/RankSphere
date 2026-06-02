import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// Bright Data Scraper API — Dataset ID for Google SERP
// ---------------------------------------------------------------------------
const BD_DATASET_ID = 'gd_mfz5x93lmsjjjylob';
const BD_BASE_URL   = 'https://api.brightdata.com/datasets/v3';

// ---------------------------------------------------------------------------
// Step 1 — Trigger endpoint: fires the Bright Data scrape job and immediately
// returns the snapshot_id. Designed to complete in << 2 seconds so it stays
// well within Vercel's serverless execution limits.
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { keyword, rankType } = req.body as { keyword: string; rankType: string };

  if (!keyword || !rankType) {
    return res.status(400).json({ error: 'Missing required fields: keyword, rankType' });
  }

  // Strict geo-parameters per market — prevents SERP localization mismatches
  const countryCode = rankType.toLowerCase() === 'dubai' ? 'ae' : 'qa';

  const apiKey = process.env.BRIGHTDATA_API_KEY ?? '';
  const authHeader = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // Construct the scraper trigger payload
  const triggerPayload = [{
    url:          'https://www.google.com/',
    keyword:      keyword,        // passed verbatim — Bright Data handles encoding
    language:     'en',
    start_page:   1,
    end_page:     10,             // pages 1–10 → up to 100 organic results
    collapse_aio: true,           // strip AI Overviews so ranks aren't suppressed
    country:      countryCode,    // 'qa' for Qatar, 'ae' for Dubai
  }];

  try {
    const triggerRes = await fetch(
      `${BD_BASE_URL}/trigger?dataset_id=${BD_DATASET_ID}&include_errors=true`,
      { method: 'POST', headers: authHeader, body: JSON.stringify(triggerPayload) }
    );

    if (!triggerRes.ok) {
      const errText = await triggerRes.text();
      return res.status(triggerRes.status).json({
        error: `Bright Data trigger error: ${triggerRes.status}`,
        detail: errText,
      });
    }

    const triggerData = await triggerRes.json();
    const snapshotId: string = triggerData.snapshot_id;

    if (!snapshotId) {
      return res.status(502).json({
        error: 'Bright Data did not return a snapshot_id',
        raw: triggerData,
      });
    }

    // Return the snapshot_id immediately — frontend drives the polling loop
    return res.status(200).json({ snapshot_id: snapshotId });

  } catch (error) {
    console.error('trigger-scrape failed:', error);
    return res.status(500).json({ error: 'Failed to trigger Bright Data scrape' });
  }
}
