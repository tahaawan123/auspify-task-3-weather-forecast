// Shared constants used across the whole app
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const SEARCH_DEBOUNCE_MS = 400;
export const MAX_CITY_LENGTH = 60;
export const MAX_RECENT_SEARCHES = 5;
export const SUGGESTION_LIMIT = 5;
export const HOURLY_SLOT_COUNT = 8;
export const DAILY_SLOT_COUNT = 5;
export const STALE_PLACE_DEGREES = 0.02;
export const CITY_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.',-]*$/u;

// Run the function only once the calls have stopped
export function debounce(fn, waitMs) {
  let timerId = 0;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => fn(...args), waitMs);
  };
}

// Trim and screen a city name before it reaches the API
export function validateCityName(rawValue) {
  const value = String(rawValue ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, reason: 'empty' };
  if (value.length > MAX_CITY_LENGTH) return { ok: false, reason: 'too-long' };
  if (!CITY_NAME_PATTERN.test(value)) return { ok: false, reason: 'invalid-chars' };
  return { ok: true, value };
}

// Convert Celsius into the unit the user picked
export function convertTemp(celsius, unit) {
  return unit === 'imperial' ? (celsius * 9) / 5 + 32 : celsius;
}

// Degree label for the active unit
export function unitSymbol(unit) {
  return unit === 'imperial' ? '°F' : '°C';
}

// Temperature with the unit, such as 21°C
export function formatTemp(celsius, unit) {
  if (!Number.isFinite(celsius)) return '—';
  return `${Math.round(convertTemp(celsius, unit))}${unitSymbol(unit)}`;
}

// Temperature without the unit, for compact tiles
export function formatTempShort(celsius, unit) {
  if (!Number.isFinite(celsius)) return '—';
  return `${Math.round(convertTemp(celsius, unit))}°`;
}

// Wind speed in km/h or mph
export function formatWind(metersPerSecond, unit) {
  if (!Number.isFinite(metersPerSecond)) return '—';
  const speed = unit === 'imperial' ? metersPerSecond * 2.236936 : metersPerSecond * 3.6;
  return `${Math.round(speed)} ${unit === 'imperial' ? 'mph' : 'km/h'}`;
}

// Visibility shown in km or miles
export function formatVisibility(metres, unit) {
  if (!Number.isFinite(metres)) return '—';
  const distance = unit === 'imperial' ? metres / 1609.344 : metres / 1000;
  return `${distance.toFixed(1)} ${unit === 'imperial' ? 'mi' : 'km'}`;
}

// Whole percent value, or a dash when the API leaves it out
export function formatPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : '—';
}

// Pressure in hectopascals
export function formatPressure(value) {
  return Number.isFinite(value) ? `${Math.round(value)} hPa` : '—';
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// Turn wind degrees into a compass point
export function windDirection(degrees) {
  if (!Number.isFinite(degrees)) return '';
  const normalised = ((degrees % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(normalised / 45) % 8];
}

// Shift a UTC timestamp so its UTC fields show the city clock
export function cityDate(timestampMs, offsetSeconds) {
  return new Date(timestampMs + offsetSeconds * 1000);
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
});

const CLOCK_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const SLOT_CLOCK_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  hour: 'numeric',
  hour12: true,
});

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long' });

// Readable date and clock in the city's own time zone
export function formatCityDateTime(offsetSeconds) {
  const now = cityDate(Date.now(), offsetSeconds);
  return `${DATE_FORMAT.format(now)} · ${CLOCK_FORMAT.format(now)}`;
}

// Hour label for an hourly tile, such as 3 PM
export function formatSlotClock(timestampMs, offsetSeconds) {
  return SLOT_CLOCK_FORMAT.format(cityDate(timestampMs, offsetSeconds));
}

// Short weekday label for a forecast slot
export function formatSlotDay(timestampMs, offsetSeconds) {
  return SHORT_DATE_FORMAT.format(cityDate(timestampMs, offsetSeconds));
}

// Weekday name for a whole forecast day
export function formatWeekday(timestampMs, offsetSeconds) {
  return WEEKDAY_FORMAT.format(cityDate(timestampMs, offsetSeconds));
}

// Stable key for the city-local calendar day
export function dayKey(timestampMs, offsetSeconds) {
  const date = cityDate(timestampMs, offsetSeconds);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

// Label such as UTC+05:00 for the city offset
export function formatUtcOffset(offsetSeconds) {
  if (!Number.isFinite(offsetSeconds)) return '';
  const sign = offsetSeconds < 0 ? '-' : '+';
  const totalMinutes = Math.abs(Math.round(offsetSeconds / 60));
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}

// Emoji that matches an OpenWeatherMap icon code
export function weatherEmoji(iconCode) {
  const code = String(iconCode ?? '');
  const isNight = code.endsWith('n');
  const group = code.slice(0, 2);
  if (group === '01') return isNight ? '🌙' : '☀️';
  if (group === '02') return isNight ? '🌙' : '⛅';
  if (group === '03') return '🌤️';
  if (group === '04') return '☁️';
  if (group === '09') return '🌧️';
  if (group === '10') return isNight ? '🌧️' : '🌦️';
  if (group === '11') return '⛈️';
  if (group === '13') return '❄️';
  if (group === '50') return '🌫️';
  return '🌡️';
}

// Pick the page theme from the condition id and the icon code
export function themeForCondition(conditionId, iconCode) {
  const isNight = String(iconCode ?? '').endsWith('n');
  if (!Number.isFinite(conditionId)) return 'clouds';
  if (conditionId >= 200 && conditionId < 300) return 'thunderstorm';
  if (conditionId >= 300 && conditionId < 400) return 'drizzle';
  if (conditionId >= 500 && conditionId < 600) return 'rain';
  if (conditionId >= 600 && conditionId < 700) return 'snow';
  if (conditionId >= 700 && conditionId < 800) return 'mist';
  if (conditionId === 800) return isNight ? 'clear-night' : 'clear-day';
  return 'clouds';
}

// Capitalise a description coming from the API
export function capitalize(text) {
  const value = String(text ?? '');
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Lowest reading inside one three-hour forecast slot
function slotMin(item) {
  const main = item && item.main ? item.main : {};
  return Number.isFinite(main.temp_min) ? main.temp_min : main.temp;
}

// Highest reading inside one three-hour forecast slot
function slotMax(item) {
  const main = item && item.main ? item.main : {};
  return Number.isFinite(main.temp_max) ? main.temp_max : main.temp;
}

// Keep the next few three-hour slots, starting from now
export function pickHourlySlots(list, nowMs, count = HOURLY_SLOT_COUNT) {
  if (!Array.isArray(list)) return [];
  const upcoming = list.filter((item) => Number.isFinite(item.dt) && item.dt * 1000 >= nowMs);
  const source = upcoming.length ? upcoming : list;
  return source.slice(0, count);
}

// Condition that shows up most often inside a group of slots
function mostCommonWeather(items) {
  const counts = new Map();
  items.forEach((item) => {
    const weather = Array.isArray(item.weather) ? item.weather[0] : null;
    if (!weather) return;
    const id = String(weather.id);
    const found = counts.get(id);
    if (found) found.count += 1;
    else counts.set(id, { count: 1, weather });
  });
  let winner = null;
  counts.forEach((entry) => {
    if (winner === null || entry.count > winner.count) winner = entry;
  });
  return winner ? winner.weather : { id: 800, main: 'Clear', description: 'clear sky', icon: '01d' };
}

// Build one summary per city-local day from the three-hour list
export function groupForecastByDay(list, offsetSeconds) {
  if (!Array.isArray(list)) return [];
  const groups = new Map();
  list.forEach((item) => {
    if (!Number.isFinite(item.dt)) return;
    const key = dayKey(item.dt * 1000, offsetSeconds);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  });
  return Array.from(groups.values()).map((items) => {
    const weather = mostCommonWeather(items);
    const mins = items.map(slotMin).filter(Number.isFinite);
    const maxes = items.map(slotMax).filter(Number.isFinite);
    return {
      startMs: items[0].dt * 1000,
      min: mins.length ? Math.min(...mins) : Number.NaN,
      max: maxes.length ? Math.max(...maxes) : Number.NaN,
      weather: {
        id: weather.id,
        main: weather.main,
        description: weather.description,
        icon: String(weather.icon ?? '').replace(/n$/, 'd'),
      },
    };
  });
}

// Read and parse a stored value without ever throwing
export function readStoredJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

// Save a value as JSON without ever throwing
export function writeStoredJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Drop a stored value without ever throwing
export function removeStoredKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    return false;
  }
  return true;
}

// Check that a stored place is still safe to use
export function isValidPlace(place) {
  if (!place || typeof place !== 'object') return false;
  if (typeof place.name !== 'string' || !place.name.trim()) return false;
  if (place.name.length > MAX_CITY_LENGTH) return false;
  if (typeof place.country !== 'string' || place.country.length > 8) return false;
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return false;
  if (Math.abs(place.lat) > 90 || Math.abs(place.lon) > 180) return false;
  return true;
}

// Keep only the place fields we trust
export function normalizePlace(place) {
  return {
    name: place.name.trim().slice(0, MAX_CITY_LENGTH),
    country: typeof place.country === 'string' ? place.country.slice(0, 8) : '',
    state: typeof place.state === 'string' ? place.state.slice(0, MAX_CITY_LENGTH) : '',
    lat: place.lat,
    lon: place.lon,
  };
}

// Compare two places by their rounded coordinates
export function samePlace(first, second) {
  if (!isValidPlace(first) || !isValidPlace(second)) return false;
  return (
    Math.abs(first.lat - second.lat) < STALE_PLACE_DEGREES &&
    Math.abs(first.lon - second.lon) < STALE_PLACE_DEGREES
  );
}
