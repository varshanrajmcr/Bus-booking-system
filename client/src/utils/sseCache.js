/**
 * SSE Data Cache Utility
 * Manages localStorage caching for SSE data to avoid unnecessary server requests
 */

const CACHE_KEY_PREFIX = 'sse_cache_';
const CACHE_VERSION_KEY = 'sse_cache_version';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a hash from data for comparison
 */
function generateDataHash(data) {
  try {
    const dataString = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  } catch (error) {
    console.error('Error generating hash:', error);
    return Date.now().toString();
  }
}

/**
 * Get cache key for admin
 */
function getCacheKey(adminId) {
  return `${CACHE_KEY_PREFIX}${adminId}`;
}

/**
 * Store SSE data in localStorage
 */
export function storeSSEData(adminId, data) {
  try {
    const cacheKey = getCacheKey(adminId);
    const cacheData = {
      data: data,
      hash: generateDataHash(data),
      timestamp: Date.now(),
      version: getCacheVersion()
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    console.log('[SSE Cache] Data stored for admin:', adminId);
    return cacheData.hash;
  } catch (error) {
    console.error('[SSE Cache] Error storing data:', error);
    return null;
  }
}

/**
 * Get cached SSE data from localStorage
 */
export function getCachedSSEData(adminId) {
  try {
    const cacheKey = getCacheKey(adminId);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) {
      console.log('[SSE Cache] No cached data found for admin:', adminId);
      return null;
    }
    
    const cacheData = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired
    if (now - cacheData.timestamp > CACHE_EXPIRY_MS) {
      console.log('[SSE Cache] Cache expired for admin:', adminId);
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    // Check if cache version matches
    if (cacheData.version !== getCacheVersion()) {
      console.log('[SSE Cache] Cache version mismatch for admin:', adminId);
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    console.log('[SSE Cache] Cached data retrieved for admin:', adminId);
    return cacheData.data;
  } catch (error) {
    console.error('[SSE Cache] Error retrieving cached data:', error);
    return null;
  }
}

/**
 * Check if server data has changed compared to cached data
 */
export function hasDataChanged(adminId, serverData) {
  try {
    const cacheKey = getCacheKey(adminId);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) {
      return true; // No cache, data is "new"
    }
    
    const cacheData = JSON.parse(cached);
    const serverHash = generateDataHash(serverData);
    
    return cacheData.hash !== serverHash;
  } catch (error) {
    console.error('[SSE Cache] Error checking data change:', error);
    return true; // On error, assume data changed
  }
}

/**
 * Get cached data hash
 */
export function getCachedHash(adminId) {
  try {
    const cacheKey = getCacheKey(adminId);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    const cacheData = JSON.parse(cached);
    return cacheData.hash;
  } catch (error) {
    console.error('[SSE Cache] Error getting cached hash:', error);
    return null;
  }
}

/**
 * Clear cached data for admin
 */
export function clearSSECache(adminId) {
  try {
    const cacheKey = getCacheKey(adminId);
    localStorage.removeItem(cacheKey);
    console.log('[SSE Cache] Cache cleared for admin:', adminId);
  } catch (error) {
    console.error('[SSE Cache] Error clearing cache:', error);
  }
}

/**
 * Get cache version (increment this when data structure changes)
 */
function getCacheVersion() {
  try {
    const version = localStorage.getItem(CACHE_VERSION_KEY);
    return version || '1.0';
  } catch (error) {
    return '1.0';
  }
}

/**
 * Set cache version (call this when data structure changes)
 */
export function setCacheVersion(version) {
  try {
    localStorage.setItem(CACHE_VERSION_KEY, version);
  } catch (error) {
    console.error('[SSE Cache] Error setting cache version:', error);
  }
}

/**
 * Clear all SSE caches
 */
export function clearAllSSECaches() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    console.log('[SSE Cache] All caches cleared');
  } catch (error) {
    console.error('[SSE Cache] Error clearing all caches:', error);
  }
}

