import { getUserPreference, setUserPreference } from './db';

const CACHE_NAME = 'osm-map-tiles';
const REGIONS_PREF_KEY = 'offline_map_regions';

/**
 * Convert longitude to tile X coordinate
 */
export const lon2tile = (lon, zoom) => {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
};

/**
 * Convert latitude to tile Y coordinate
 */
export const lat2tile = (lat, zoom) => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
};

/**
 * Convert tile coordinates back to lat/lon (tile northwest corner)
 */
export const tile2lon = (x, z) => {
  return (x / Math.pow(2, z)) * 360 - 180;
};

export const tile2lat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

/**
 * Calculate list of tiles covering a bounding box at specified zooms
 */
export const getTileListForBounds = (bounds, zoomLevels = [13, 14]) => {
  const tiles = [];
  const { minLat, maxLat, minLng, maxLng } = bounds;

  for (const z of zoomLevels) {
    const minX = Math.min(lon2tile(minLng, z), lon2tile(maxLng, z));
    const maxX = Math.max(lon2tile(minLng, z), lon2tile(maxLng, z));
    const minY = Math.min(lat2tile(maxLat, z), lat2tile(minLat, z));
    const maxY = Math.max(lat2tile(maxLat, z), lat2tile(minLat, z));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // Round-robin tile subdomains a, b, c
        const subdomain = ['a', 'b', 'c'][(x + y) % 3];
        const url = `https://${subdomain}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
        tiles.push({ x, y, z, url });
      }
    }
  }
  return tiles;
};

/**
 * Get all previously downloaded offline map regions
 */
export const getDownloadedRegions = async () => {
  return (await getUserPreference(REGIONS_PREF_KEY, [])) || [];
};

/**
 * Get total cached map tiles count and size estimate
 */
export const getMapCacheStats = async () => {
  if (!('caches' in window)) return { count: 0, estimatedSizeMB: 0 };
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    // OSM PNG tiles average ~25KB each
    const estimatedSizeMB = ((keys.length * 25) / 1024).toFixed(1);
    return { count: keys.length, estimatedSizeMB };
  } catch (e) {
    console.warn('[MapCache] Failed to get cache stats:', e);
    return { count: 0, estimatedSizeMB: 0 };
  }
};

/**
 * Safely download and pre-cache a bounded area of map tiles.
 * Capped to a maximum of 45 tiles per region to strictly respect OpenStreetMap fair use policy.
 */
export const downloadMapArea = async ({
  name,
  center,
  radiusKm = 3,
  zoomLevels = [13, 14],
  onProgress = null,
}) => {
  if (!('caches' in window)) {
    throw new Error('Cache Storage API is not supported in this browser');
  }

  // Calculate approximate bounding box in degrees from radiusKm
  const latDelta = radiusKm / 111.0;
  const lngDelta = radiusKm / (111.0 * Math.cos((center.lat * Math.PI) / 180));

  const bounds = {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };

  const tiles = getTileListForBounds(bounds, zoomLevels);

  // Hard safety limit: max 45 tiles per batch to strictly prevent bulk abuse
  const MAX_TILES = 45;
  const tilesToFetch = tiles.slice(0, MAX_TILES);

  console.log(`[MapCache] Pre-caching ${tilesToFetch.length} tiles for region "${name}"...`);

  const cache = await caches.open(CACHE_NAME);
  let completed = 0;

  for (const tile of tilesToFetch) {
    try {
      // Check if already in cache
      const cached = await cache.match(tile.url);
      if (!cached) {
        // Courteous polite delay (80ms) between tile requests
        await new Promise((res) => setTimeout(res, 80));

        const response = await fetch(tile.url, {
          mode: 'cors',
          headers: { 'Accept': 'image/png,image/*;q=0.8' },
        });

        if (response.ok) {
          await cache.put(tile.url, response.clone());
        }
      }
    } catch (err) {
      console.warn(`[MapCache] Failed to cache tile ${tile.z}/${tile.x}/${tile.y}:`, err.message);
    }

    completed++;
    if (onProgress) {
      onProgress({
        total: tilesToFetch.length,
        completed,
        percent: Math.round((completed / tilesToFetch.length) * 100),
      });
    }
  }

  // Save region metadata to user preferences
  const currentRegions = await getDownloadedRegions();
  const regionRecord = {
    id: `region_${Date.now()}`,
    name: name || `Area (${center.lat.toFixed(2)}, ${center.lng.toFixed(2)})`,
    center,
    radiusKm,
    zoomLevels,
    tileCount: tilesToFetch.length,
    downloadedAt: Date.now(),
  };

  const updatedRegions = [regionRecord, ...currentRegions.filter((r) => r.name !== regionRecord.name)];
  await setUserPreference(REGIONS_PREF_KEY, updatedRegions);

  return regionRecord;
};

/**
 * Remove a region record from user preferences
 */
export const deleteDownloadedRegion = async (id) => {
  const currentRegions = await getDownloadedRegions();
  const filtered = currentRegions.filter((r) => r.id !== id);
  await setUserPreference(REGIONS_PREF_KEY, filtered);
  return filtered;
};
