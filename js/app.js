import * as api from './api.js';
import * as ui from './ui.js';
import {
  DAILY_SLOT_COUNT,
  MAX_CITY_LENGTH,
  MAX_RECENT_SEARCHES,
  SEARCH_DEBOUNCE_MS,
  debounce,
  groupForecastByDay,
  isValidPlace,
  normalizePlace,
  pickHourlySlots,
  readStoredJson,
  removeStoredKey,
  samePlace,
  themeForCondition,
  validateCityName,
  writeStoredJson,
} from './utils.js';

const STORAGE_KEY_RECENT = 'weather.recentSearches';
const STORAGE_KEY_LAST = 'weather.lastPlace';
const STORAGE_KEY_UNIT = 'weather.unit';
const MIN_SUGGESTION_LENGTH = 2;
const FALLBACK_ERROR = 'Something unexpected went wrong. Please try again.';
const NOT_FOUND_MESSAGE = 'We could not find that city. Check the spelling and try again.';

// Messages for input the user can fix themselves
const INPUT_MESSAGES = {
  empty: 'Type a city name first.',
  'too-long': `City names can be at most ${MAX_CITY_LENGTH} characters.`,
  'invalid-chars': 'City names can only use letters, spaces, dots, commas, apostrophes and hyphens.',
};

// Everything the app needs to remember while it runs
const state = {
  unit: 'metric',
  place: null,
  current: null,
  forecast: null,
  recent: [],
  suggestions: [],
  activeSuggestion: -1,
  suggestionToken: 0,
  requestId: 0,
};

// Start a new request and retire any older one
function beginRequest() {
  state.requestId += 1;
  ui.setBusy(true);
  return state.requestId;
}

// True once a newer request has replaced this one
function isStale(ticket) {
  return ticket !== state.requestId;
}

// Clear the loading state for the newest request only
function finishRequest(ticket) {
  if (isStale(ticket)) return;
  ui.setBusy(false);
  ui.setRefreshing(false);
}

// Read the saved unit and ignore anything unexpected
function readStoredUnit() {
  return readStoredJson(STORAGE_KEY_UNIT, 'metric') === 'imperial' ? 'imperial' : 'metric';
}

// Read the saved recent list and drop rows that look wrong
function readRecentPlaces() {
  const stored = readStoredJson(STORAGE_KEY_RECENT, []);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter(isValidPlace)
    .slice(0, MAX_RECENT_SEARCHES)
    .map(normalizePlace);
}

// Pick the friendliest message we have for a failure
function messageForError(error) {
  if (error instanceof api.WeatherError) return error.message;
  return FALLBACK_ERROR;
}

// Report a failed load without leaving the screen empty
function handleLoadError(error, ticket) {
  if (isStale(ticket)) return;
  ui.showAlert(messageForError(error));
  ui.setStatus('');
  if (state.current) ui.showContent();
  else ui.showWelcome();
}

// Draw every card from the metric data we already hold
function renderAll() {
  if (!state.place || !state.current || !state.forecast) return;
  const offset = Number.isFinite(state.current.timezone) ? state.current.timezone : 0;
  const list = Array.isArray(state.forecast.list) ? state.forecast.list : [];
  const weather = Array.isArray(state.current.weather) ? state.current.weather[0] : null;
  const theme = themeForCondition(weather ? weather.id : Number.NaN, weather ? weather.icon : '');

  ui.setTheme(theme);
  ui.renderCurrent(state.place, state.current, state.unit);
  ui.renderDetails(state.current, state.unit);
  ui.renderHourly(pickHourlySlots(list, Date.now()), offset, state.unit);
  ui.renderDaily(groupForecastByDay(list, offset).slice(0, DAILY_SLOT_COUNT), offset, state.unit);
  ui.showContent();
  ui.setStatus(`Showing weather for ${state.place.name}.`);
}

// Fetch the weather for a place and draw it
async function applyWeather(place, ticket) {
  const [current, forecast] = await Promise.all([
    api.fetchCurrentWeather(place.lat, place.lon),
    api.fetchForecast(place.lat, place.lon),
  ]);
  if (isStale(ticket)) return;
  state.place = place;
  state.current = current;
  state.forecast = forecast;
  renderAll();
  rememberPlace(place);
}

// Load a place we already know, such as a recent chip
async function loadPlace(place) {
  const ticket = beginRequest();
  const refreshing = Boolean(state.current) && samePlace(state.place, place);
  if (refreshing) ui.setRefreshing(true);
  else ui.showSkeleton();
  ui.hideAlert();
  try {
    await applyWeather(place, ticket);
  } catch (error) {
    handleLoadError(error, ticket);
  } finally {
    finishRequest(ticket);
  }
}

// Look the city name up first, then load its weather
async function searchByCityName(query) {
  const ticket = beginRequest();
  ui.showSkeleton();
  ui.hideAlert();
  try {
    const places = await api.searchCities(query);
    if (isStale(ticket)) return;
    if (!places.length) throw new api.WeatherError('not-found', NOT_FOUND_MESSAGE);
    await applyWeather(places[0], ticket);
  } catch (error) {
    handleLoadError(error, ticket);
  } finally {
    finishRequest(ticket);
  }
}

// Keep the last five cities in storage and on screen
function rememberPlace(place) {
  const kept = state.recent.filter((item) => !samePlace(item, place));
  kept.unshift(normalizePlace(place));
  state.recent = kept.slice(0, MAX_RECENT_SEARCHES);
  writeStoredJson(STORAGE_KEY_RECENT, state.recent);
  writeStoredJson(STORAGE_KEY_LAST, normalizePlace(place));
  ui.renderRecent(state.recent);
}

// Forget every saved city
function clearRecentSearches() {
  state.recent = [];
  removeStoredKey(STORAGE_KEY_RECENT);
  removeStoredKey(STORAGE_KEY_LAST);
  ui.renderRecent(state.recent);
  ui.setStatus('Recent searches cleared.');
}

// Load the last city when the page opens
async function restoreLastPlace() {
  const stored = readStoredJson(STORAGE_KEY_LAST, null);
  if (!isValidPlace(stored)) {
    ui.showWelcome();
    return;
  }
  await loadPlace(normalizePlace(stored));
}

// Refresh the suggestion list after the user pauses typing
const requestSuggestions = debounce((query) => {
  void loadSuggestions(query);
}, SEARCH_DEBOUNCE_MS);

// Ask the geocoder for matching cities
async function loadSuggestions(query) {
  const check = validateCityName(query);
  if (!check.ok || check.value.length < MIN_SUGGESTION_LENGTH) {
    state.suggestions = [];
    state.activeSuggestion = -1;
    ui.hideSuggestions();
    return;
  }
  state.suggestionToken += 1;
  const token = state.suggestionToken;
  try {
    const places = await api.searchCities(check.value);
    if (token !== state.suggestionToken) return;
    state.suggestions = places;
    state.activeSuggestion = -1;
    ui.renderSuggestions(places, -1);
  } catch (error) {
    if (token !== state.suggestionToken) return;
    state.suggestions = [];
    state.activeSuggestion = -1;
    ui.hideSuggestions();
    const kind = error instanceof api.WeatherError ? error.kind : '';
    if (kind === 'config' || kind === 'bad-key') ui.showAlert(error.message);
  }
}

// Move the highlight up or down the suggestion list
function moveSuggestion(step) {
  if (!state.suggestions.length) return;
  const last = state.suggestions.length - 1;
  let next = state.activeSuggestion + step;
  if (next < 0) next = last;
  if (next > last) next = 0;
  state.activeSuggestion = next;
  ui.renderSuggestions(state.suggestions, next);
}

// Load the city the user picked from the list
function chooseSuggestion(index) {
  const place = state.suggestions[index];
  if (!place) return;
  state.suggestions = [];
  state.activeSuggestion = -1;
  ui.hideSuggestions();
  ui.setSearchValue(place.name);
  void loadPlace(place);
}

// Handle Enter and the arrow keys inside the search box
function handleInputKeydown(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!state.suggestions.length) return;
    event.preventDefault();
    moveSuggestion(event.key === 'ArrowDown' ? 1 : -1);
    return;
  }
  if (event.key === 'Enter' && state.activeSuggestion >= 0) {
    event.preventDefault();
    chooseSuggestion(state.activeSuggestion);
    return;
  }
  if (event.key === 'Escape') {
    state.suggestions = [];
    state.activeSuggestion = -1;
    ui.hideSuggestions();
  }
}

// Run a search from the form or a suggestion click
function handleSubmit(event) {
  event.preventDefault();
  const check = validateCityName(ui.dom.cityInput.value);
  state.suggestions = [];
  state.activeSuggestion = -1;
  ui.hideSuggestions();
  if (!check.ok) {
    ui.showAlert(INPUT_MESSAGES[check.reason] || FALLBACK_ERROR);
    ui.dom.cityInput.focus();
    return;
  }
  ui.setSearchValue(check.value);
  void searchByCityName(check.value);
}

// Pick a recent chip with the mouse
function handleRecentClick(event) {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  const index = Array.from(ui.dom.recentChips.children).indexOf(chip);
  const place = state.recent[index];
  if (place) void loadPlace(place);
}

// Pick a suggestion with the mouse
function handleSuggestionClick(event) {
  const item = event.target.closest('.suggestion');
  if (!item) return;
  chooseSuggestion(Array.from(ui.dom.suggestions.children).indexOf(item));
}

// Close the suggestion list when the user clicks away
function handleDocumentClick(event) {
  if (!ui.dom.searchForm.contains(event.target)) {
    state.suggestions = [];
    state.activeSuggestion = -1;
    ui.hideSuggestions();
  }
}

// Friendly text for each geolocation failure code
function geolocationMessage(error) {
  if (error && error.code === 1) {
    return 'Location access was denied. You can still search for a city by name.';
  }
  if (error && error.code === 3) {
    return 'Finding your location took too long. Please try again or search by name.';
  }
  return 'We could not read your location right now. Please search for a city instead.';
}

// Ask the browser for the user's coordinates
function useMyLocation() {
  if (!('geolocation' in navigator)) {
    ui.showAlert('Your browser cannot share a location. Please search for a city instead.');
    return;
  }
  const ticket = beginRequest();
  if (state.current) ui.setRefreshing(true);
  else ui.showSkeleton();
  ui.hideAlert();
  navigator.geolocation.getCurrentPosition(
    (position) => {
      void loadFromCoordinates(position.coords, ticket);
    },
    (error) => {
      if (isStale(ticket)) return;
      ui.showAlert(geolocationMessage(error));
      if (state.current) ui.showContent();
      else ui.showWelcome();
      finishRequest(ticket);
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
  );
}

// Name a coordinate pair, falling back to a generic label
async function resolvePlace(coords) {
  const lat = Number(coords.latitude);
  const lon = Number(coords.longitude);
  try {
    const found = await api.reverseGeocode(lat, lon);
    if (found) return found;
  } catch {
    return { name: 'My location', country: '', state: '', lat, lon };
  }
  return { name: 'My location', country: '', state: '', lat, lon };
}

// Load the weather for a coordinate pair
async function loadFromCoordinates(coords, ticket) {
  try {
    const place = await resolvePlace(coords);
    if (isStale(ticket)) return;
    await applyWeather(place, ticket);
  } catch (error) {
    handleLoadError(error, ticket);
  } finally {
    finishRequest(ticket);
  }
}

// Switch units and redraw from the stored metric data
function applyUnit(unit) {
  if (unit === state.unit) return;
  state.unit = unit;
  writeStoredJson(STORAGE_KEY_UNIT, unit);
  ui.setUnit(unit);
  if (state.current) renderAll();
}

// Connect every control on the page
function bindEvents() {
  ui.dom.searchForm.addEventListener('submit', handleSubmit);
  ui.dom.cityInput.addEventListener('input', (event) => {
    requestSuggestions(event.target.value);
  });
  ui.dom.cityInput.addEventListener('keydown', handleInputKeydown);
  ui.dom.suggestions.addEventListener('click', handleSuggestionClick);
  ui.dom.locateBtn.addEventListener('click', useMyLocation);
  ui.dom.alertClose.addEventListener('click', ui.hideAlert);
  ui.dom.clearRecentBtn.addEventListener('click', clearRecentSearches);
  ui.dom.recentChips.addEventListener('click', handleRecentClick);
  ui.dom.unitMetric.addEventListener('click', () => applyUnit('metric'));
  ui.dom.unitImperial.addEventListener('click', () => applyUnit('imperial'));
  document.addEventListener('click', handleDocumentClick);
}

// Bring the app to life
function start() {
  ui.init();
  ui.setTheme('theme-clear-day');
  state.unit = readStoredUnit();
  ui.setUnit(state.unit);
  state.recent = readRecentPlaces();
  ui.renderRecent(state.recent);
  bindEvents();
  void restoreLastPlace();
}

start();
