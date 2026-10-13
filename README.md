# Weather Forecast

A glassmorphism weather app built with pure HTML, CSS and JavaScript that shows current conditions, an hourly strip and a 5-day outlook for any city. The OpenWeatherMap key is read by a small serverless function, so it is never exposed in the browser.

## Live Demo

🔗 _Live demo link coming soon._

## Features

- City search with a debounced suggestion dropdown (up to 5 matches, keyboard navigable with arrows, Enter and Escape)
- "Use my location" button using the Geolocation API with a friendly message when access is denied
- Current weather card with city, country, local date and time, temperature, feels like, condition, emoji icon and daily min/max
- Detail cards for humidity, wind, pressure, visibility, cloudiness, sunrise and sunset in the city's own time zone
- Hourly forecast strip with the next 8 slots in 3-hour steps
- 5-day forecast built by grouping the 3-hour list into one card per day
- Unit toggle for °C / °F and km/h / mph that converts the stored data without refetching
- Recent searches (last 5) and the last opened city saved in localStorage as clickable chips with a Clear button
- Dynamic theme per condition and day/night with an animated decorative layer (floating blobs plus rain and snow drops drawn in pure CSS)
- Skeleton shimmer placeholders while loading, so the layout never jumps
- Dismissible error alerts for empty input, city not found, bad key, rate limit, offline, server errors and denied location
- Fully responsive from 320px to 1440px with mobile-first CSS Grid and Flexbox
- Accessible: semantic HTML, one h1, aria-live status messages, aria-busy panels, visible focus outlines and 44px touch targets

## Tech stack

- HTML5
- CSS3 (custom properties, Grid, Flexbox, backdrop-filter, keyframe animations)
- Vanilla JavaScript with ES modules
- A Vercel serverless function in Node.js that proxies the OpenWeatherMap REST API (Geocoding, Current Weather, 5 day / 3 hour Forecast)

## Folder structure

```
weather-forecast/
  api/
    weather.js         (serverless proxy, holds the key)
  css/
    style.css
  js/
    api.js
    ui.js
    utils.js
    app.js
  index.html
  .gitignore
  README.md
```

## Setup

The app needs an OpenWeatherMap API key, but the key is only ever read on the server by `api/weather.js`. It is never bundled into the browser code.

### 1. Get a free key

1. Create an account at https://home.openweathermap.org/users/sign_up
2. Open https://home.openweathermap.org/api_keys
3. Copy the default key, or generate a new one. New keys can take a few minutes before they start working.

### 2. Run it locally

1. Install the Vercel CLI once: `npm i -g vercel`
2. Create a `.env.local` file in the project root and add your key:

   ```
   OWM_API_KEY=your-real-key-here
   ```

   This file is listed in `.gitignore`, so it is never committed.

3. Start the dev server, which serves the static files and the `api/` function together:

   ```
   npx vercel dev
   ```

4. Open the local URL it prints, usually `http://localhost:3000`.

A plain static server is not enough here, because the page calls `/api/weather` and that route only exists while the Vercel dev server is running.

### 3. Deploy to Vercel

1. Push the project to GitHub and import it at https://vercel.com/new, or run `npx vercel` from the project folder.
2. In the Vercel dashboard go to **Settings → Environment Variables** and add `OWM_API_KEY` with your key as the value. Add it for Production, Preview and Development so every deployment works.
3. Redeploy, because environment variables are only picked up by a new build.

## Security notes

- The key lives only in the `OWM_API_KEY` environment variable and is read by `api/weather.js` on the server. It never reaches the browser.
- The endpoint answers only `GET`, only the four known request types, and validates every input before the upstream URL is built.
- Failures are returned as a small `{ error: "message" }` body. The key, the upstream URL and stack traces are never included.
- A strict Content-Security-Policy meta tag in `index.html` limits scripts, styles and network calls to this origin.
- No `innerHTML` is used with API or user data. Every node is built with `createElement` and `textContent`.
- City input is trimmed, capped at 60 characters and limited to letters, spaces, dots, commas, apostrophes and hyphens, checked on the client and again on the server.
- All localStorage reads are wrapped in `try/catch` with `JSON.parse` guarded and the stored shape validated before use.
- Every external link uses `rel="noopener noreferrer"` and the document sets `referrer` to `no-referrer`.
- Requests are reduced with a 400ms suggestion debounce, a 10 minute in-memory cache per city and a short CDN cache on the geo, current and forecast routes.

## Author

Muhammad Taha — Auspify Technologies Web Development Internship, Task 3

Weather data by [OpenWeatherMap](https://openweathermap.org/)

#Auspify #AuspifyTechnologies #AuspifyInternship #AuspifyProjects
