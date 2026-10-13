// Serverless endpoint that talks to OpenWeatherMap so the key never reaches the browser
const OWM_BASE = 'https://api.openweathermap.org';
const ALLOWED_TYPES = ['geo', 'reverse', 'current', 'forecast'];
const CACHEABLE_TYPES = ['geo', 'current', 'forecast'];
const CACHE_HEADER = 's-maxage=600, stale-while-revalidate=300';
const REQUEST_TIMEOUT_MS = 10000;
const MAX_CITY_LENGTH = 60;
const CITY_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.',-]*$/u;

// Send a JSON reply and finish the response
function sendJson(res, status, body, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  Object.keys(headers || {}).forEach((name) => {
    res.setHeader(name, headers[name]);
  });
  res.end(JSON.stringify(body));
}

// Read one query value as a trimmed string
function readQuery(searchParams, name) {
  const value = searchParams.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

// Read a coordinate and check it sits inside the allowed range
function readCoordinate(rawValue, min, max) {
  if (!rawValue) return null;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

// Check the inputs for one request type and return the values we will send upstream
function validateInputs(type, searchParams) {
  if (type === 'geo') {
    const q = readQuery(searchParams, 'q').replace(/\s+/g, ' ');
    if (!q) return { ok: false, message: 'A city name is required.' };
    if (q.length > MAX_CITY_LENGTH) return { ok: false, message: 'That city name is too long.' };
    if (!CITY_PATTERN.test(q)) return { ok: false, message: 'That city name has characters we cannot use.' };
    return { ok: true, inputs: { q } };
  }
  const lat = readCoordinate(readQuery(searchParams, 'lat'), -90, 90);
  const lon = readCoordinate(readQuery(searchParams, 'lon'), -180, 180);
  if (lat === null || lon === null) {
    return { ok: false, message: 'A valid latitude and longitude are required.' };
  }
  return { ok: true, inputs: { lat, lon } };
}

// Build the OpenWeatherMap URL here so the key is only ever added on the server
function buildUpstreamUrl(type, inputs, key) {
  if (type === 'geo') {
    const url = new URL('/geo/1.0/direct', OWM_BASE);
    url.searchParams.set('q', inputs.q);
    url.searchParams.set('limit', '5');
    url.searchParams.set('appid', key);
    return url;
  }
  if (type === 'reverse') {
    const url = new URL('/geo/1.0/reverse', OWM_BASE);
    url.searchParams.set('lat', String(inputs.lat));
    url.searchParams.set('lon', String(inputs.lon));
    url.searchParams.set('limit', '1');
    url.searchParams.set('appid', key);
    return url;
  }
  const path = type === 'current' ? '/data/2.5/weather' : '/data/2.5/forecast';
  const url = new URL(path, OWM_BASE);
  url.searchParams.set('lat', String(inputs.lat));
  url.searchParams.set('lon', String(inputs.lon));
  url.searchParams.set('units', 'metric');
  url.searchParams.set('appid', key);
  return url;
}

// Ask OpenWeatherMap for the data and hand back only its status and JSON body
async function fetchUpstream(type, inputs, key) {
  const response = await fetch(buildUpstreamUrl(type, inputs, key), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const raw = await response.text();
  let body = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

module.exports = async (req, res) => {
  try {
    // This endpoint only ever reads data
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET' });
      return;
    }

    const key = (process.env.OWM_API_KEY || '').trim();
    if (!key) {
      sendJson(res, 500, { error: 'The weather service is not configured yet.' });
      return;
    }

    const { searchParams } = new URL(req.url || '/', 'http://localhost');
    const type = readQuery(searchParams, 'type');
    if (!ALLOWED_TYPES.includes(type)) {
      sendJson(res, 400, { error: 'That request type is not supported.' });
      return;
    }

    const check = validateInputs(type, searchParams);
    if (!check.ok) {
      sendJson(res, 400, { error: check.message });
      return;
    }

    const upstream = await fetchUpstream(type, check.inputs, key);
    // Only cache real answers, never an error
    const cacheHeaders =
      upstream.status === 200 && CACHEABLE_TYPES.includes(type)
        ? { 'Cache-Control': CACHE_HEADER }
        : undefined;

    if (upstream.body === null) {
      const status = upstream.status >= 400 ? upstream.status : 502;
      sendJson(res, status, { error: 'The weather service sent an unreadable reply.' });
      return;
    }

    sendJson(res, upstream.status, upstream.body, cacheHeaders);
  } catch {
    // Nothing from the failure is passed on, so no key, URL or stack trace can leak
    sendJson(res, 500, { error: 'Something went wrong. Please try again.' });
  }
};
