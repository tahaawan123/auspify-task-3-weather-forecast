import { CACHE_TTL_MS, SUGGESTION_LIMIT } from './utils.js';

// Our own serverless endpoint, the OpenWeatherMap key lives on the server only
const ENDPOINT = '/api/weather';

// Results kept in memory so repeat lookups skip the network
const responseCache = new Map();

// Error we can show to the user with a friendly message
export class WeatherError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'WeatherError';
    this.kind = kind;
  }
}

// Build a request URL for our own endpoint
function buildUrl(type, params) {
  const url = new URL(ENDPOINT, window.location.origin);
  url.searchParams.set('type', type);
  Object.keys(params).forEach((name) => {
    url.searchParams.set(name, String(params[name]));
  });
  return url;
}

// Read the safe error message our own endpoint sends back, if there is one
async function readServerMessage(response) {
  try {
    const data = await response.json();
    return data && typeof data.error === 'string' ? data.error : '';
  } catch {
    return '';
  }
}

// Turn an HTTP status into a typed, friendly error
function describeHttpError(status, serverMessage) {
  if (status === 400) {
    return new WeatherError('bad-request', 'That search did not look right. Check the city name and try again.');
  }
  if (status === 401) {
    return new WeatherError('bad-key', 'The API key is missing or not active yet. New OpenWeatherMap keys can take a few minutes to work.');
  }
  if (status === 404) {
    return new WeatherError('not-found', 'We could not find that city. Check the spelling and try again.');
  }
  if (status === 429) {
    return new WeatherError('rate-limit', 'Too many requests right now. Please wait a minute and try again.');
  }
  if (status >= 500) {
    // Our own endpoint explains setup problems, so show that instead of guessing
    if (serverMessage) return new WeatherError('config', serverMessage);
    return new WeatherError('server', 'The weather service is having trouble. Please try again shortly.');
  }
  return new WeatherError('server', `The weather service replied with an unexpected error (${status}).`);
}

// Fetch JSON and convert every failure into a typed error
async function requestJson(url) {
  if (window.navigator.onLine === false) {
    throw new WeatherError('offline', 'You look offline. Check your internet connection and try again.');
  }
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new WeatherError('offline', 'We could not reach the weather service. Check your connection and try again.');
  }
  if (!response.ok) throw describeHttpError(response.status, await readServerMessage(response));
  try {
    return await response.json();
  } catch {
    throw new WeatherError('server', 'We received an unreadable reply from the weather service.');
  }
}

// Return a cached result while it is still fresh
function readCache(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

// Remember a result with its timestamp
function writeCache(key, value) {
  responseCache.set(key, { value, savedAt: Date.now() });
}

// Round coordinates so nearby lookups share one cache entry
function coordinateKey(lat, lon) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

// Check that a geocoding row has everything we need
function isGeoRow(row) {
  return Boolean(row) && typeof row.name === 'string' && Number.isFinite(row.lat) && Number.isFinite(row.lon);
}

// Convert a geocoding row into our own place object
function toPlace(row) {
  return {
    name: row.name,
    country: typeof row.country === 'string' ? row.country : '',
    state: typeof row.state === 'string' ? row.state : '',
    lat: Number(row.lat),
    lon: Number(row.lon),
  };
}

// Look up up to five matching cities by name
export async function searchCities(query) {
  const cacheKey = `geo:${query.toLowerCase()}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;
  const url = buildUrl('geo', { q: query });
  const data = await requestJson(url);
  const places = (Array.isArray(data) ? data : []).filter(isGeoRow).map(toPlace).slice(0, SUGGESTION_LIMIT);
  writeCache(cacheKey, places);
  return places;
}

// Find the nearest city name for a coordinate pair
export async function reverseGeocode(lat, lon) {
  const url = buildUrl('reverse', { lat, lon });
  const data = await requestJson(url);
  const rows = (Array.isArray(data) ? data : []).filter(isGeoRow);
  return rows.length ? toPlace(rows[0]) : null;
}

// Current conditions for a coordinate pair
export async function fetchCurrentWeather(lat, lon) {
  const cacheKey = `now:${coordinateKey(lat, lon)}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;
  const url = buildUrl('current', { lat, lon });
  const data = await requestJson(url);
  if (!data || typeof data !== 'object') {
    throw new WeatherError('server', 'The weather service sent an unexpected reply.');
  }
  writeCache(cacheKey, data);
  return data;
}

// Five day, three hour forecast for a coordinate pair
export async function fetchForecast(lat, lon) {
  const cacheKey = `forecast:${coordinateKey(lat, lon)}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;
  const url = buildUrl('forecast', { lat, lon });
  const data = await requestJson(url);
  if (!data || !Array.isArray(data.list)) {
    throw new WeatherError('server', 'The forecast reply was incomplete. Please try again.');
  }
  writeCache(cacheKey, data);
  return data;
}
