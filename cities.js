// A small offline list for choosing a place without sharing a location, and for naming
// the nearest city to a GPS fix. Coordinates are city centres to two decimals.
export const CITIES = [
  ['London', 51.51, -0.13], ['Manchester', 53.48, -2.24], ['Edinburgh', 55.95, -3.19], ['Glasgow', 55.86, -4.25],
  ['Belfast', 54.6, -5.93], ['Cardiff', 51.48, -3.18], ['Dublin', 53.35, -6.26], ['Reykjavík', 64.15, -21.94],
  ['Oslo', 59.91, 10.75], ['Bergen', 60.39, 5.32], ['Tromsø', 69.65, 18.96], ['Stockholm', 59.33, 18.07],
  ['Gothenburg', 57.71, 11.97], ['Helsinki', 60.17, 24.94], ['Copenhagen', 55.68, 12.57], ['Amsterdam', 52.37, 4.9],
  ['Brussels', 50.85, 4.35], ['Paris', 48.86, 2.35], ['Berlin', 52.52, 13.4], ['Hamburg', 53.55, 9.99],
  ['Munich', 48.14, 11.58], ['Vienna', 48.21, 16.37], ['Zurich', 47.38, 8.54], ['Prague', 50.08, 14.44],
  ['Warsaw', 52.23, 21.01], ['Kraków', 50.06, 19.94], ['Gdańsk', 54.35, 18.65], ['Wrocław', 51.11, 17.03],
  ['Poznań', 52.41, 16.93], ['Budapest', 47.5, 19.04], ['Tallinn', 59.44, 24.75], ['Riga', 56.95, 24.11],
  ['Vilnius', 54.69, 25.28], ['Kyiv', 50.45, 30.52], ['Moscow', 55.76, 37.62], ['Saint Petersburg', 59.94, 30.31],
  ['Madrid', 40.42, -3.7], ['Barcelona', 41.39, 2.17], ['Lisbon', 38.72, -9.14], ['Rome', 41.9, 12.5],
  ['Milan', 45.46, 9.19], ['Athens', 37.98, 23.73], ['Istanbul', 41.01, 28.98], ['New York', 40.71, -74.01],
  ['Boston', 42.36, -71.06], ['Washington', 38.91, -77.04], ['Chicago', 41.88, -87.63], ['Minneapolis', 44.98, -93.27],
  ['Toronto', 43.65, -79.38], ['Montreal', 45.5, -73.57], ['Vancouver', 49.28, -123.12], ['Seattle', 47.61, -122.33],
  ['San Francisco', 37.77, -122.42], ['Los Angeles', 34.05, -118.24], ['Denver', 39.74, -104.99], ['Anchorage', 61.22, -149.9],
  ['Mexico City', 19.43, -99.13], ['São Paulo', -23.55, -46.63], ['Buenos Aires', -34.6, -58.38], ['Santiago', -33.45, -70.67],
  ['Cape Town', -33.92, 18.42], ['Johannesburg', -26.2, 28.05], ['Nairobi', -1.29, 36.82], ['Cairo', 30.04, 31.24],
  ['Dubai', 25.2, 55.27], ['Mumbai', 19.08, 72.88], ['Delhi', 28.61, 77.21], ['Singapore', 1.35, 103.82],
  ['Hong Kong', 22.32, 114.17], ['Beijing', 39.9, 116.41], ['Shanghai', 31.23, 121.47], ['Seoul', 37.57, 126.98],
  ['Tokyo', 35.68, 139.69], ['Sydney', -33.87, 151.21], ['Melbourne', -37.81, 144.96], ['Hobart', -42.88, 147.33],
  ['Perth', -31.95, 115.86], ['Brisbane', -27.47, 153.03], ['Auckland', -36.85, 174.76], ['Wellington', -41.29, 174.78],
  ['Christchurch', -43.53, 172.64],
].map(([name, lat, lon]) => ({ name, lat, lon }));

const R = Math.PI / 180;
const km = (a, b) => {
  const h = Math.sin(((b.lat - a.lat) * R) / 2) ** 2
    + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(((b.lon - a.lon) * R) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** The listed city within `limit` km of a place, if any. */
export function nearestCity(place, limit = 50) {
  let best = null, dist = Infinity;
  for (const c of CITIES) { const d = km(place, c); if (d < dist) { dist = d; best = c; } }
  return dist <= limit ? best : null;
}

export const findCity = (name) => CITIES.find((c) => c.name.toLowerCase() === String(name).trim().toLowerCase()) || null;
