import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BACEN_INDEX_RATE_FETCH_TIMEOUT_MS,
  BACEN_INDEX_RATE_CACHE_TTL_MS,
  clearBacenIndexRateCache,
  fetchLatestIndexRate,
  fetchLatestIPCA,
  fetchLatestTR,
} from '../bacen';

afterEach(() => {
  clearBacenIndexRateCache();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mockFetch(payload: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => payload,
    }),
  );
}

describe('BACEN index rates', () => {
  it('fetches and parses the latest TR rate', async () => {
    mockFetch([{ data: '17/04/2026', dataFim: '17/05/2026', valor: '0.1372' }]);

    const result = await fetchLatestTR();

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('bcdata.sgs.226'), {
      signal: expect.any(AbortSignal),
    });
    expect(result.indexType).toBe('TR');
    expect(result.rate).toBeCloseTo(0.1372, 4);
    expect(result.referenceDate).toEqual(new Date(2026, 3, 17));
    expect(result.endDate).toEqual(new Date(2026, 4, 17));
    expect(result.label).toBe('TR (17/04/2026 a 17/05/2026)');
  });

  it('fetches and parses the latest IPCA rate', async () => {
    mockFetch([{ data: '01/03/2026', valor: '0.88' }]);

    const result = await fetchLatestIPCA();

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('bcdata.sgs.433'), {
      signal: expect.any(AbortSignal),
    });
    expect(result.indexType).toBe('IPCA');
    expect(result.rate).toBeCloseTo(0.88, 2);
    expect(result.endDate).toBeUndefined();
    expect(result.label).toBe('IPCA (mar/2026)');
  });

  it('accepts decimal comma rates when BACEN returns them', async () => {
    mockFetch([{ data: '01/02/2026', valor: '1,31' }]);

    const result = await fetchLatestIPCA();

    expect(result.rate).toBeCloseTo(1.31, 2);
    expect(result.label).toBe('IPCA (fev/2026)');
  });

  it('throws on non-OK responses', async () => {
    mockFetch([], false, 503);

    await expect(fetchLatestIndexRate('TR')).rejects.toThrow('status 503');
  });

  it('throws on empty or malformed payloads', async () => {
    mockFetch([]);
    await expect(fetchLatestIndexRate('TR')).rejects.toThrow('no rate data');

    clearBacenIndexRateCache();
    mockFetch([{ data: '01/03/2026' }]);
    await expect(fetchLatestIndexRate('TR')).rejects.toThrow('malformed rate data');
  });

  it('caches repeated requests for the session', async () => {
    mockFetch([{ data: '01/03/2026', valor: '0.01723' }]);

    await fetchLatestTR();
    await fetchLatestTR();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes cached rates after the TTL expires', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(0);
    mockFetch([{ data: '01/03/2026', valor: '0.01723' }]);

    await fetchLatestTR();

    nowSpy.mockReturnValueOnce(BACEN_INDEX_RATE_CACHE_TTL_MS - 1);
    await fetchLatestTR();

    nowSpy.mockReturnValueOnce(BACEN_INDEX_RATE_CACHE_TTL_MS + 1);
    await fetchLatestTR();

    expect(fetch).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('passes abort signals to fetch', async () => {
    const controller = new AbortController();
    mockFetch([{ data: '01/03/2026', valor: '0.01723' }]);

    await fetchLatestTR({ signal: controller.signal });

    expect(fetch).toHaveBeenCalledWith(expect.any(String), {
      signal: expect.any(AbortSignal),
    });
  });

  it('aborts slow requests after the BACEN timeout', async () => {
    vi.useFakeTimers();
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), milliseconds);
      return controller.signal;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            const error = new Error('The operation was aborted.');
            error.name = 'AbortError';
            reject(error);
          });
        });
      }),
    );

    const promise = expect(fetchLatestTR()).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(BACEN_INDEX_RATE_FETCH_TIMEOUT_MS);

    await promise;
    timeoutSpy.mockRestore();
  });

  it('serves a stale cached rate when refresh fails', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(0);
    mockFetch([{ data: '01/03/2026', valor: '0.01723' }]);

    const cached = await fetchLatestTR();

    nowSpy.mockReturnValueOnce(BACEN_INDEX_RATE_CACHE_TTL_MS + 1);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));

    await expect(fetchLatestTR()).resolves.toEqual(cached);
    expect(fetch).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });
});
