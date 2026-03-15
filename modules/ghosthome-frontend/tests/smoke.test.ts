import { describe, it, expect } from 'vitest';

describe('API client module shape', () => {
  it('exports expected functions from api.ts', async () => {
    const api = await import('@/lib/api');
    expect(typeof api.fetchHealth).toBe('function');
    expect(typeof api.fetchCameras).toBe('function');
    expect(typeof api.fetchWorkflows).toBe('function');
    expect(typeof api.fetchIncidents).toBe('function');
    expect(typeof api.fetchSummary).toBe('function');
    expect(typeof api.fetchMetrics).toBe('function');
    expect(typeof api.fetchStorages).toBe('function');
    expect(typeof api.fetchAnalytics).toBe('function');
    expect(typeof api.fetchAuthStatus).toBe('function');
    expect(typeof api.triggerAction).toBe('function');
    expect(typeof api.toggleAnalytics).toBe('function');
    expect(typeof api.bulkToggleAnalytics).toBe('function');
    expect(typeof api.formatUptime).toBe('function');
    expect(typeof api.formatPercent).toBe('function');
  });
});

describe('Utility helpers', () => {
  it('formatUptime returns dash for null', async () => {
    const { formatUptime } = await import('@/lib/api');
    expect(formatUptime(null)).toBe('\u2014');
  });

  it('formatUptime formats seconds correctly', async () => {
    const { formatUptime } = await import('@/lib/api');
    expect(formatUptime(90061)).toBe('1d 1h 1m');
    expect(formatUptime(3660)).toBe('1h 1m');
    expect(formatUptime(120)).toBe('2m');
  });

  it('formatPercent returns dash for null', async () => {
    const { formatPercent } = await import('@/lib/api');
    expect(formatPercent(null)).toBe('\u2014');
  });

  it('formatPercent formats value correctly', async () => {
    const { formatPercent } = await import('@/lib/api');
    expect(formatPercent(75.4)).toBe('75%');
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('Environment configuration', () => {
  it('NEXT_PUBLIC_API_URL is defined or empty string', () => {
    const val = process.env.NEXT_PUBLIC_API_URL ?? '';
    expect(typeof val).toBe('string');
  });
});
