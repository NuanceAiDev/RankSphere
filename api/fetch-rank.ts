import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/fetch-rank — legacy shim
//
// This endpoint has been superseded by the frontend-polling architecture:
//   POST /api/trigger-scrape  →  returns snapshot_id
//   POST /api/resolve-scrape  →  polls progress, fetches snapshot, writes DB
//
// This file is intentionally left as a 410 Gone response so any stale
// references surface clearly instead of silently failing.
// ---------------------------------------------------------------------------
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(410).json({
    error: 'This endpoint has been replaced. Use /api/trigger-scrape and /api/resolve-scrape instead.',
  });
}
