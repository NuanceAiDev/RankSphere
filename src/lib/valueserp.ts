import { RankSettings, RankingData } from '../types';

// A single-keyword lookup walks up to 3 SERP pages server-side, so it needs headroom —
// but it must never wait forever: a request that never settles leaves the spinner stuck
// on screen because neither .then() nor finally{} ever runs.
// Per-page ceiling. Each proxy call is now a single ValueSERP request (~2-5s), so this is
// a generous backstop rather than an expected wait. Worst case for a keyword is 3 pages.
const PAGE_FETCH_TIMEOUT_MS = 20_000;

// Google deprecated num=100 in Sept 2025, so one request returns ~10 results. We check up
// to 3 pages (top ~30) and stop early, which also caps credit spend at what we actually use.
const MAX_PAGES = 3;

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

// Main ranking function — calls the secure /api/fetch-rank proxy instead of hitting
// ValueSERP directly, so the API key never reaches the browser and there is no CORS issue.
//
// Pagination is driven here rather than in the proxy: we request one SERP page per call and
// stop as soon as the domain is found. That keeps every serverless invocation to a single
// upstream request (~2-5s), well inside the free tier's 10s limit, and still spends only the
// credits we actually use — a page-1 hit costs 1 credit, not 3.
export async function fetchKeywordRanking(
  domain: string,
  keyword: string,
  rankType: 'dubai' | 'qatar' = 'qatar',
  brandName?: string | null
): Promise<RankingData> {
  console.log(`🔍 [Proxy] Target: "${domain}" | Keyword: "${keyword}" | Market: ${rankType}`);

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `/api/fetch-rank?keyword=${encodeURIComponent(keyword)}` +
      `&rankType=${encodeURIComponent(rankType)}` +
      `&domain=${encodeURIComponent(domain)}` +
      `&brandName=${encodeURIComponent(brandName ?? '')}` +
      `&page=${page}&_t=${Date.now()}`;

    const response = await fetch(url, {
      cache: 'no-store',
      signal: timeoutSignal(PAGE_FETCH_TIMEOUT_MS)
    });

    if (!response.ok) {
      console.error(`Proxy returned ${response.status} on page ${page}`);
      // 504/503 come back as an HTML gateway page, so never try to parse the body here.
      throw new Error(
        response.status === 504 || response.status === 503
          ? `Server timeout (${response.status}) on page ${page} of this keyword`
          : `Proxy error: ${response.status} on page ${page}`
      );
    }

    const result = await response.json();

    if (result.rank != null) {
      console.log(`✅ Found at global position ${result.rank} (page ${page})`);
      return { rank: result.rank, url: result.url ?? undefined };
    }

    console.log(`… not on page ${page}`);
  }

  // Not ranked is a valid outcome, not an error: return null so the caller writes null to
  // the database and the table reads "Not ranked" instead of staying blank.
  console.log(`❌ Not found in the top ${MAX_PAGES * 10} results.`);
  return { rank: null, url: undefined };
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