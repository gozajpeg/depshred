import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CACHE_FILE = join(tmpdir(), 'depshred-cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let inMemoryCache = null;

/**
 * Load cache from OS temporary directory.
 */
async function loadCache() {
  if (inMemoryCache) return inMemoryCache;
  try {
    const raw = await readFile(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const now = Date.now();
    if (parsed._timestamp && now - parsed._timestamp < CACHE_TTL_MS) {
      inMemoryCache = parsed;
      return inMemoryCache;
    }
  } catch {
    // Cache file missing or invalid; ignore and start fresh
  }
  inMemoryCache = { _timestamp: Date.now() };
  return inMemoryCache;
}

/**
 * Persist cache to OS temporary directory.
 */
async function saveCache() {
  if (!inMemoryCache) return;
  try {
    await writeFile(CACHE_FILE, JSON.stringify(inMemoryCache), 'utf8');
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Fetch package metadata from the npm registry with caching and timeout.
 *
 * @param {string} packageName - Name of the npm package (e.g. "lodash" or "@types/node")
 * @param {number} timeoutMs - Request timeout in milliseconds (default: 4000)
 * @returns {Promise<{ unpackedSize: number, dependenciesCount: number, deprecated: string|null, lastPublished: string|null, yearsDormant: number, isOffline: boolean }>}
 */
export async function fetchPackageMetadata(packageName, timeoutMs = 4000) {
  const cache = await loadCache();
  if (cache[packageName]) {
    return cache[packageName];
  }

  // Handle scoped packages: @scope/name -> @scope%2fname in npm registry URL
  const encodedName = packageName.startsWith('@')
    ? `@${encodeURIComponent(packageName.slice(1))}`
    : encodeURIComponent(packageName);

  const url = `https://registry.npmjs.org/${encodedName}/latest`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'depshred-audit/1.0.2'
      }
    });

    clearTimeout(timer);

    if (!response.ok) {
      // 404 or registry error: package might be private or unpublished
      const fallback = {
        unpackedSize: 0,
        dependenciesCount: 0,
        deprecated: null,
        lastPublished: null,
        yearsDormant: 0,
        isPrivateOrNotFound: true,
        isOffline: false
      };
      cache[packageName] = fallback;
      return fallback;
    }

    const data = await response.json();
    const unpackedSize = Number(data.dist?.unpackedSize) || 0;
    const dependenciesCount = Object.keys(data.dependencies || {}).length;
    const deprecated = data.deprecated || null;

    // Determine publish timestamp
    let lastPublished = null;
    let yearsDormant = 0;
    const publishTime = data.time?.modified || data.publish_time;
    if (publishTime) {
      lastPublished = publishTime;
      const pubDate = new Date(publishTime);
      const diffMs = Date.now() - pubDate.getTime();
      yearsDormant = Math.max(0, Number((diffMs / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1)));
    }

    const result = {
      unpackedSize,
      dependenciesCount,
      deprecated,
      lastPublished,
      yearsDormant,
      isOffline: false
    };

    cache[packageName] = result;
    return result;
  } catch {
    clearTimeout(timer);
    // Offline, timeout, or network failure
    const offlineResult = {
      unpackedSize: 0,
      dependenciesCount: 0,
      deprecated: null,
      lastPublished: null,
      yearsDormant: 0,
      isOffline: true
    };
    return offlineResult;
  }
}

/**
 * Batch fetch metadata for multiple packages.
 */
export async function batchFetchMetadata(packageNames) {
  const results = new Map();
  // Fetch up to 10 packages concurrently to avoid socket congestion
  const BATCH_SIZE = 10;
  for (let i = 0; i < packageNames.length; i += BATCH_SIZE) {
    const batch = packageNames.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (pkg) => {
      const meta = await fetchPackageMetadata(pkg);
      results.set(pkg, meta);
    });
    await Promise.all(promises);
  }
  await saveCache();
  return results;
}
