import {
  capitalize,
  convertTemp,
  dayKey,
  formatCityDateTime,
  formatPercent,
  formatPressure,
  formatSlotClock,
  formatSlotDay,
  formatTemp,
  formatTempShort,
  formatUtcOffset,
  formatVisibility,
  formatWeekday,
  formatWind,
  unitSymbol,
  weatherEmoji,
  windDirection,
} from './utils.js';

// Every element the app talks to
export const dom = {
  body: document.body,
  searchForm: document.getElementById('search-form'),
  cityInput: document.getElementById('city-input'),
  searchBtn: document.getElementById('search-btn'),
  suggestions: document.getElementById('suggestions'),
  locateBtn: document.getElementById('locate-btn'),
  unitMetric: document.getElementById('unit-metric'),
  unitImperial: document.getElementById('unit-imperial'),
  alertBox: document.getElementById('alert-box'),
  alertText: document.getElementById('alert-text'),
  alertClose: document.getElementById('alert-close'),
  status: document.getElementById('status'),
  recentSection: document.getElementById('recent-section'),
  recentChips: document.getElementById('recent-chips'),
  clearRecentBtn: document.getElementById('clear-recent'),
  welcome: document.getElementById('welcome'),
  currentPanel: document.getElementById('current-panel'),
  currentSkeleton: document.getElementById('current-skeleton'),
  currentCard: document.getElementById('current-card'),
  placeName: document.getElementById('place-name'),
  placeMeta: document.getElementById('place-meta'),
  heroIcon: document.getElementById('hero-icon'),
  heroValue: document.getElementById('hero-value'),
  heroUnit: document.getElementById('hero-unit'),
  currentCondition: document.getElementById('current-condition'),
  statFeels: document.getElementById('stat-feels'),
  statMin: document.getElementById('stat-min'),
  statMax: document.getElementById('stat-max'),
  detailsSection: document.getElementById('details-section'),
  detailGrid: document.getElementById('detail-grid'),
  hourlySection: document.getElementById('hourly-section'),
  hourlyStrip: document.getElementById('hourly-strip'),
  dailySection: document.getElementById('daily-section'),
  dailyGrid: document.getElementById('daily-grid'),
};

const THEME_CLASSES = [
  'theme-clear-day',
  'theme-clear-night',
  'theme-clouds',
  'theme-rain',
  'theme-drizzle',
  'theme-thunderstorm',
  'theme-snow',
  'theme-mist',
];

const SKELETON_DETAIL_COUNT = 7;
const SKELETON_HOUR_COUNT = 8;
const SKELETON_DAY_COUNT = 5;

// Panels that report their busy state
const BUSY_PANELS = [dom.currentPanel, dom.detailsSection, dom.hourlySection, dom.dailySection];

// Skeleton containers live beside the real content
const skeletons = {
  details: null,
  hourly: null,
  daily: null,
};

// Build one shimmer tile for a skeleton grid
function buildSkeletonTile(className) {
  const tile = document.createElement('div');
  tile.className = `card ${className}`;
  const lines = ['sk-w-40', 'sk-w-70', 'sk-w-60'];
  lines.forEach((width) => {
    const line = document.createElement('span');
    line.className = `skeleton sk-line ${width}`;
    tile.append(line);
  });
  return tile;
}

// Create a skeleton container and place it before the real one
function buildSkeletonGrid(target, className, tileClass, count) {
  const grid = document.createElement('div');
  grid.className = className;
  grid.setAttribute('aria-hidden', 'true');
  grid.hidden = true;
  for (let index = 0; index < count; index += 1) {
    grid.append(buildSkeletonTile(tileClass));
  }
  target.parentElement.insertBefore(grid, target);
  return grid;
}

// Prepare the skeleton placeholders once, before any data arrives
export function init() {
  skeletons.details = buildSkeletonGrid(dom.detailGrid, 'detail-grid', 'skeleton-detail', SKELETON_DETAIL_COUNT);
  skeletons.hourly = buildSkeletonGrid(dom.hourlyStrip, 'hourly-strip', 'skeleton-tile', SKELETON_HOUR_COUNT);
  skeletons.daily = buildSkeletonGrid(dom.dailyGrid, 'daily-grid', 'skeleton-day', SKELETON_DAY_COUNT);
}

// Build an emoji icon, labelled when it is the only carrier of the meaning
function buildIcon(emoji, label, className) {
  const node = document.createElement('span');
  node.className = className;
  if (label) {
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', label);
  } else {
    node.setAttribute('aria-hidden', 'true');
  }
  node.textContent = emoji;
  return node;
}

// Build a small text node with one class
function buildText(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

// Swap the page theme without touching any inline styles
export function setTheme(themeName) {
  const safeTheme = THEME_CLASSES.includes(themeName) ? themeName : 'theme-clear-day';
  THEME_CLASSES.forEach((name) => dom.body.classList.toggle(name, name === safeTheme));
}

// Highlight the active unit button
export function setUnit(unit) {
  const isMetric = unit !== 'imperial';
  dom.unitMetric.classList.toggle('is-active', isMetric);
  dom.unitImperial.classList.toggle('is-active', !isMetric);
  dom.unitMetric.setAttribute('aria-pressed', String(isMetric));
  dom.unitImperial.setAttribute('aria-pressed', String(!isMetric));
}

// Keep the input in step with the chosen city
export function setSearchValue(value) {
  dom.cityInput.value = value;
}

// Lock the controls while a request is running
export function setBusy(isBusy) {
  BUSY_PANELS.forEach((panel) => panel.setAttribute('aria-busy', String(isBusy)));
  dom.searchBtn.disabled = isBusy;
  dom.locateBtn.disabled = isBusy;
}

// Dim the current results during a quiet refresh
export function setRefreshing(isRefreshing) {
  [dom.currentCard, dom.detailGrid, dom.hourlyStrip, dom.dailyGrid].forEach((node) => {
    node.classList.toggle('is-refreshing', isRefreshing);
  });
}

// Show placeholder cards while the first result loads
export function showSkeleton() {
  dom.welcome.hidden = true;
  dom.currentPanel.hidden = false;
  dom.detailsSection.hidden = false;
  dom.hourlySection.hidden = false;
  dom.dailySection.hidden = false;
  dom.currentSkeleton.hidden = false;
  dom.currentCard.hidden = true;
  dom.detailGrid.hidden = true;
  dom.hourlyStrip.hidden = true;
  dom.dailyGrid.hidden = true;
  skeletons.details.hidden = false;
  skeletons.hourly.hidden = false;
  skeletons.daily.hidden = false;
}

// Reveal the rendered weather cards
export function showContent() {
  dom.welcome.hidden = true;
  dom.currentPanel.hidden = false;
  dom.detailsSection.hidden = false;
  dom.hourlySection.hidden = false;
  dom.dailySection.hidden = false;
  dom.currentSkeleton.hidden = true;
  dom.currentCard.hidden = false;
  dom.detailGrid.hidden = false;
  dom.hourlyStrip.hidden = false;
  dom.dailyGrid.hidden = false;
  skeletons.details.hidden = true;
  skeletons.hourly.hidden = true;
  skeletons.daily.hidden = true;
}

// Fall back to the empty state before the first search
export function showWelcome() {
  dom.welcome.hidden = false;
  dom.currentPanel.hidden = true;
  dom.detailsSection.hidden = true;
  dom.hourlySection.hidden = true;
  dom.dailySection.hidden = true;
  dom.currentSkeleton.hidden = true;
  dom.currentCard.hidden = true;
  dom.detailGrid.hidden = true;
  dom.hourlyStrip.hidden = true;
  dom.dailyGrid.hidden = true;
  skeletons.details.hidden = true;
  skeletons.hourly.hidden = true;
  skeletons.daily.hidden = true;
}

// Fill the big current weather card
export function renderCurrent(place, current, unit) {
  const timezone = Number.isFinite(current.timezone) ? current.timezone : 0;
  const weather = Array.isArray(current.weather) ? current.weather[0] : null;
  const main = current.main || {};
  const region = [place.state, place.country].filter(Boolean).join(', ');
  const when = `${formatCityDateTime(timezone)} · ${formatUtcOffset(timezone)}`;

  dom.placeName.textContent = place.name;
  dom.placeMeta.textContent = region ? `${region} · ${when}` : when;
  dom.heroIcon.textContent = weatherEmoji(weather ? weather.icon : '');
  dom.heroIcon.setAttribute('aria-label', weather ? capitalize(weather.description) : 'Weather');
  dom.heroValue.textContent = Number.isFinite(main.temp) ? String(Math.round(convertTemp(main.temp, unit))) : '—';
  dom.heroUnit.textContent = unitSymbol(unit);
  dom.currentCondition.textContent = weather ? capitalize(weather.description) : 'Conditions unavailable';
  dom.statFeels.textContent = formatTemp(main.feels_like, unit);
  dom.statMin.textContent = formatTemp(main.temp_min, unit);
  dom.statMax.textContent = formatTemp(main.temp_max, unit);
}

// Build the seven detail cards from the current weather
export function renderDetails(current, unit) {
  const main = current.main || {};
  const wind = current.wind || {};
  const clouds = current.clouds || {};
  const sys = current.sys || {};
  const timezone = Number.isFinite(current.timezone) ? current.timezone : 0;
  const direction = windDirection(wind.deg);

  const rows = [
    { icon: '💧', label: 'Humidity', value: formatPercent(main.humidity), hint: 'Relative humidity' },
    {
      icon: '🌬️',
      label: 'Wind',
      value: formatWind(wind.speed, unit),
      hint: direction ? `Blowing from the ${direction}` : 'Wind speed',
    },
    { icon: '🧭', label: 'Pressure', value: formatPressure(main.pressure), hint: 'At sea level' },
    {
      icon: '👁️',
      label: 'Visibility',
      value: Number.isFinite(current.visibility) ? formatVisibility(current.visibility, unit) : '—',
      hint: 'Clear viewing distance',
    },
    { icon: '☁️', label: 'Cloudiness', value: formatPercent(clouds.all), hint: 'Sky covered by cloud' },
    {
      icon: '🌅',
      label: 'Sunrise',
      value: Number.isFinite(sys.sunrise) ? formatSlotClock(sys.sunrise * 1000, timezone) : '—',
      hint: 'City local time',
    },
    {
      icon: '🌇',
      label: 'Sunset',
      value: Number.isFinite(sys.sunset) ? formatSlotClock(sys.sunset * 1000, timezone) : '—',
      hint: 'City local time',
    },
  ];

  dom.detailGrid.replaceChildren(
    ...rows.map((row) => {
      const card = document.createElement('article');
      card.className = 'detail-card card enter';
      card.append(
        buildIcon(row.icon, '', 'detail-icon'),
        buildText('p', 'detail-label', row.label),
        buildText('p', 'detail-value', row.value),
        buildText('p', 'detail-hint', row.hint),
      );
      return card;
    }),
  );
}

// Fill the horizontally scrolling hourly strip
export function renderHourly(items, offsetSeconds, unit) {
  dom.hourlyStrip.replaceChildren(
    ...items.map((item) => {
      const weather = Array.isArray(item.weather) ? item.weather[0] : null;
      const main = item.main || {};
      const tile = document.createElement('article');
      tile.className = 'hour-tile card enter';
      tile.append(
        buildText('p', 'hour-day', formatSlotDay(item.dt * 1000, offsetSeconds)),
        buildText('p', 'hour-time', formatSlotClock(item.dt * 1000, offsetSeconds)),
        buildIcon(weatherEmoji(weather ? weather.icon : ''), weather ? capitalize(weather.description) : 'Weather', 'hour-icon'),
        buildText('p', 'hour-temp', formatTempShort(main.temp, unit)),
      );
      if (Number.isFinite(item.pop) && item.pop > 0) {
        tile.append(buildText('p', 'hour-pop', `${Math.round(item.pop * 100)}% rain`));
      }
      return tile;
    }),
  );
}

// Fill the five day summary cards
export function renderDaily(days, offsetSeconds, unit) {
  const todayKey = dayKey(Date.now(), offsetSeconds);
  const tomorrowKey = dayKey(Date.now() + 86400000, offsetSeconds);

  dom.dailyGrid.replaceChildren(
    ...days.map((day) => {
      const name = dayKey(day.startMs, offsetSeconds);
      let title = formatWeekday(day.startMs, offsetSeconds);
      if (name === todayKey) title = 'Today';
      else if (name === tomorrowKey) title = 'Tomorrow';

      const card = document.createElement('article');
      card.className = 'day-card card enter';
      const range = document.createElement('p');
      range.className = 'day-range';
      range.append(
        buildText('span', 'day-max', formatTempShort(day.max, unit)),
        buildText('span', 'day-min', formatTempShort(day.min, unit)),
      );
      card.append(
        buildText('h3', 'day-name', title),
        buildIcon(weatherEmoji(day.weather.icon), '', 'day-icon'),
        buildText('p', 'day-condition', capitalize(day.weather.description)),
        range,
      );
      return card;
    }),
  );
}

// Draw the recent search chips
export function renderRecent(places) {
  dom.recentSection.hidden = places.length === 0;
  dom.recentChips.replaceChildren(
    ...places.map((place) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.setAttribute('aria-label', `Search ${place.name} again`);
      chip.append(buildText('span', null, place.name));
      if (place.country) chip.append(buildText('span', 'chip-meta', place.country));
      return chip;
    }),
  );
}

// Draw the suggestion dropdown and mark the highlighted row
export function renderSuggestions(places, activeIndex) {
  if (!places.length) {
    hideSuggestions();
    return;
  }
  dom.suggestions.replaceChildren(
    ...places.map((place, index) => {
      const item = document.createElement('li');
      item.className = index === activeIndex ? 'suggestion is-active' : 'suggestion';
      item.id = `suggestion-${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index === activeIndex));
      const meta = [place.state, place.country].filter(Boolean).join(', ');
      item.append(buildText('span', 'suggestion-name', place.name));
      if (meta) item.append(buildText('span', 'suggestion-meta', meta));
      return item;
    }),
  );
  dom.suggestions.hidden = false;
  dom.cityInput.setAttribute('aria-expanded', 'true');
  if (activeIndex >= 0) dom.cityInput.setAttribute('aria-activedescendant', `suggestion-${activeIndex}`);
  else dom.cityInput.removeAttribute('aria-activedescendant');
}

// Close and empty the suggestion list
export function hideSuggestions() {
  dom.suggestions.hidden = true;
  dom.suggestions.replaceChildren();
  dom.cityInput.setAttribute('aria-expanded', 'false');
  dom.cityInput.removeAttribute('aria-activedescendant');
}

// Show a dismissible message above the results
export function showAlert(message) {
  dom.alertText.textContent = message;
  dom.alertBox.hidden = false;
}

// Hide the message box
export function hideAlert() {
  dom.alertBox.hidden = true;
  dom.alertText.textContent = '';
}

// Announce a short message to screen readers
export function setStatus(message) {
  dom.status.textContent = message;
}
