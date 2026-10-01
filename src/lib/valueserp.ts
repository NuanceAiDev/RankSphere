import { RankSettings, RankingData } from '../types';

// A single-keyword lookup walks up to 3 SERP pages server-side, so it needs headroom —
// but it must never wait forever: a request that never settles leaves the spinner stuck
// on screen because neither .then() nor finally{} ever runs.
const SINGLE_FETCH_TIMEOUT_MS = 25_000;

/**
 * AbortSignal that always fires after `ms`, so a hung request rejects instead of hanging.
 *
 * This previously returned `undefined` when AbortSignal.timeout was unavailable, which
 * silently removed the timeout altogether — the request then hung forever with no error
 * raised anywhere. The fallback below guarantees a signal in every browser.
 */
export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException(`Timed out after ${ms}ms`, 'TimeoutError')), ms);
  return controller.signal;
}

/**
 * Hard deadline for any promise. Used to bound work that fetch's own signal can't reach —
 * notably Supabase queries, which run their own unbounded fetch internally. Guarantees the
 * returned promise settles, so a Promise.allSettled() over these can never stall.
 */
export function withTimeout<T>(operation: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new DOMException(`${label} timed out after ${ms}ms`, 'TimeoutError')),
      ms
    );
    operation.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

/** True when a fetch rejected because it timed out / was aborted, rather than returning a response. */
export function isTimeoutError(error: unknown): boolean {
  return (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

// Main ranking function — calls the secure /api/fetch-rank proxy instead of
// hitting ValueSERP directly. This keeps the API key server-side and eliminates CORS issues.
// The proxy checks pages 1-3 with early exit: a page-1 hit costs 1 credit, page-3 costs 3.
// domain and brandName are passed so the proxy can do matching server-side and return early.
export async function fetchKeywordRanking(
  domain: string,
  keyword: string,
  rankType: 'dubai' | 'qatar' = 'qatar',
  brandName?: string | null
): Promise<RankingData> {
  console.count('🔥 API CALL START');
  console.log(`\n🔍 [Proxy] Target: "${domain}" | Keyword: "${keyword}" | Market: ${rankType}`);

  try {
    // Route through our secure Vercel serverless proxy — API key never touches the browser.
    // Proxy returns { rank, url } after checking up to 3 pages with early exit.
    const url = `/api/fetch-rank?keyword=${encodeURIComponent(keyword)}&rankType=${encodeURIComponent(rankType)}&domain=${encodeURIComponent(domain)}&brandName=${encodeURIComponent(brandName ?? '')}&_t=${Date.now()}`;
    const response = await fetch(url, {
      cache: 'no-store',
      signal: timeoutSignal(SINGLE_FETCH_TIMEOUT_MS)
    });

    if (!response.ok) {
      console.error(`Proxy returned ${response.status}`);
      // 504/503 come back as an HTML gateway page, so never try to parse the body here.
      throw new Error(
        response.status === 504 || response.status === 503
          ? `Server timeout (${response.status}) while fetching this keyword`
          : `Proxy error: ${response.status}`
      );
    }

    const result = await response.json();

    if (result.rank != null) {
      console.log(`✅ Found at global pos ${result.rank}`);
      return { rank: result.rank, url: result.url ?? undefined };
    }

    // Not ranked is a valid outcome, not an error: return null so the caller writes
    // null to the database and the table reads "Not ranked" instead of staying blank.
    console.log('❌ Not found in top 30 results.');
    return { rank: null, url: undefined };

  } catch (error) {
    console.error('Proxy fetch failed:', error);
    throw error;
  }
}

export const DEFAULT_RANK_SETTINGS: RankSettings = {
  type: 'qatar-desktop',
  location: 'Doha, Qatar',
  gl: 'qa',
  hl: 'en',
  device: 'desktop'
};

export const DUBAI_RANK_SETTINGS: RankSettings = {
  type: 'qatar-desktop',
  location: 'Dubai, United Arab Emirates',
  gl: 'ae',
  hl: 'en',
  device: 'desktop'
};