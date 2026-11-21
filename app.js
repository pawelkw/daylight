import { season } from './seasons.js';
import { CITIES, nearestCity, findCity } from './cities.js';

const STORE = 'daylight';
const DAY = 864e5;
const app = document.getElementById('app');
const dialog = document.getElementById('settings');
const form = document.getElementById('settings-form');
const coordsInput = form.elements.coords;
const cityInput = form.elements.city;
const locateStatus = document.getElementById('locate-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

document.getElementById('cities').innerHTML = CITIES.map((c) => `<option value="${c.name}"></option>`).join('');

// ---- Settings (kept on this device only) ----
function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function save(next) {
  try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* private mode: keep it for this session */ }
  settings = next;
}
let settings = load();
const flag = (key) => { try { return localStorage.getItem(key); } catch { return '1'; } };
const setFlag = (key) => { try { localStorage.setItem(key, '1'); } catch { /* not remembered: fine */ } };

// A setting never saved keeps its default; one cleared in Settings turns that milestone off.
const bearableMinutes = () => {
  if (settings.bearable === undefined) return 600;
  const v = Number(settings.bearable);
  return settings.bearable !== '' && v > 0 && v < 24 ? Math.round(v * 60) : null;
};
const eveningMinutes = () => {
  if (settings.evening === undefined) return 1020;
  const m = /^(\d{1,2}):(\d{2})$/.exec(settings.evening || '');
  return m ? +m[1] * 60 + +m[2] : null;
};

// Two decimals is about a kilometre: plenty for sunrise and sunset, and no more precise than needed.
const round = (n) => Math.round(n * 100) / 100;
const parseCoords = (v) => {
  const m = String(v ?? '').trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  return m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180 ? { lat: round(+m[1]), lon: round(+m[2]) } : null;
};
const coordsText = ({ lat, lon }) => `${lat}, ${lon}`;
const coordsLabel = ({ lat, lon }) => `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? 'W' : 'E'}`;
function placeName() {
  if (settings.source === 'city' && settings.city) return settings.city;
  const near = nearestCity(settings);
  return near ? `Near ${near.name}` : coordsLabel(settings);
}

const DENIED = 'Location is off for this app. Allow it in Settings › Privacy & Security › Location Services, or choose a city.';
function currentPlace() {
  if (!('geolocation' in navigator)) return Promise.reject(new Error('This browser cannot share a location. Choose a city instead.'));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: round(pos.coords.latitude), lon: round(pos.coords.longitude) }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? DENIED : 'Could not find your location. Try again, or choose a city.')),
      { enableHighAccuracy: false, maximumAge: 6 * 3600e3, timeout: 15000 },
    );
  });
}

// ---- Wording ----
const clockText = (min) => new Date(2000, 0, 1, Math.floor(min / 60), min % 60)
  .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const hoursText = (min, short) => {
  const hh = Math.floor(min / 60), mm = min % 60;
  if (mm === 0 || mm === 30) return `${hh}${mm ? '½' : ''}${short ? ' h' : ' hours'}`;
  return `${hh}h ${mm}m`;
};
const words = (p) => ({
  evenings: { title: 'Evenings get lighter', icon: 'sunset', detail: 'Sunsets stop getting earlier, before the shortest day.',
    after: 'From here on, every sunset is a little later than the one before.' },
  grow: { title: 'Days start growing', icon: 'grow', detail: 'The shortest day. Every day after it is longer.',
    after: 'The bottom of the year. Tomorrow is a little longer, and so is every day after it.' },
  'sun-returns': { title: 'The sun returns', icon: 'sunrise', detail: 'First sunrise after the polar night.',
    after: 'The sun is back above the horizon, and it stays a little longer each day.' },
  mornings: { title: 'Mornings get lighter', icon: 'sunrise', detail: 'Sunrises stop getting later.',
    after: 'From here on, every sunrise is a little earlier than the one before.' },
  sunset: { title: `Sunset after ${clockText(p.minutes)}`, icon: 'sunset', detail: 'Daylight after a normal working day.',
    after: `The sun sets after ${clockText(p.minutes)} from today, and later every day.` },
  bearable: { title: `${hoursText(p.minutes)} of light`, icon: 'sun', detail: 'Back above your bearable day length.',
    after: `${hoursText(p.minutes)} of light today, and a little more tomorrow.` },
  equal: { title: 'Day longer than night', icon: 'half', detail: 'More light than dark until autumn.',
    after: 'From today until autumn, there is more light than dark.' },
  longest: { title: 'Longest day', icon: 'sun', detail: 'The top of the year.',
    after: 'The top of the year. Enjoy the light.' },
})[p.kind];

const date = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const dateLong = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const countdown = (n) => (n < 1 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`);
// Intl.DurationFormat localises "8h 37m"; older browsers get the English short form.
const durations = 'DurationFormat' in Intl ? new Intl.DurationFormat(undefined, { style: 'narrow' }) : null;
const fmt = (parts) => (durations
  ? durations.format(parts)
  : Object.entries(parts).filter(([, v]) => v).map(([k, v]) => `${v}${k[0]}`).join(' ')) || '0m';
const minutesOf = (ms) => Math.max(0, Math.round(ms / 60e3));
const dur = (ms) => { const m = minutesOf(ms); return fmt({ hours: Math.floor(m / 60), minutes: m % 60 }); };
const longDurations = durations ? new Intl.DurationFormat(undefined, { style: 'long' }) : null;
const durLong = (ms) => {
  const m = minutesOf(ms);
  return longDurations ? longDurations.format({ hours: Math.floor(m / 60), minutes: m % 60 }) || dur(ms) : dur(ms);
};
const change = (ms) => {
  const s = Math.round(Math.abs(ms) / 1000);
  return `${ms < 0 ? '−' : '+'}${fmt({ minutes: Math.floor(s / 60), seconds: s % 60 })}`;
};
// Extra light only means something once it fits into a day.
const tangible = (ms) => {
  const m = minutesOf(ms);
  if (m < 10) return 'A few more minutes of daylight, and growing.';
  if (m < 20) return "That's enough for a walk round the block.";
  if (m < 40) return "That's time for a coffee outside.";
  if (m < 70) return "That's a whole lunch break of extra light.";
  if (m < 120) return "That's an evening walk that starts in daylight.";
  if (m < 240) return "That's a long afternoon you didn't have at midwinter.";
  return 'Long, light evenings are back.';
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// ---- Living sky ----
const SKIES = {
  dawn: { a: '#1a1c4a', b: '#5a3a6e', c: '#e58a6a', glow: 'rgba(255, 170, 110, .55)', stars: 0.35 },
  day: { a: '#17325f', b: '#2d5288', c: '#5f7fae', glow: 'rgba(255, 226, 168, .28)', stars: 0 },
  dusk: { a: '#201a4c', b: '#6a3560', c: '#e0705a', glow: 'rgba(255, 140, 92, .55)', stars: 0.3 },
  night: { a: '#0a0b1f', b: '#12133a', c: '#1c1d4a', glow: 'rgba(89, 77, 230, .22)', stars: 1 },
};
const EDGE = 45 * 60e3;
const HORIZON = 236;
const sunEl = document.getElementById('sun');
const arcEl = document.getElementById('arc');
const seasonLabel = document.getElementById('season-label');

/** Paints the sky for `day` (today unless previewing) at time `now`. */
function paintSky(s, { day = s.today, now = Date.now(), phase } = {}) {
  const share = Math.min(1, day.daylight / s.longest.daylight);
  const peak = 170 * share, half = 110 + 110 * share;
  const preview = day !== s.today;
  const polar = day.rise == null;
  let t, up;
  if (preview) { t = 0.5; up = day.daylight > 0; }
  else if (polar) { t = ((now - day.day) / DAY) % 1; up = day.daylight > 0; }
  else { t = Math.min(1, Math.max(0, (now - day.rise) / (day.set - day.rise))); up = now >= day.rise && now <= day.set; }
  const name = phase || (preview ? 'day'
    : polar ? (up ? 'day' : 'night')
    : now < day.rise - EDGE || now > day.set + EDGE ? 'night'
    : now < day.rise + EDGE ? 'dawn' : now > day.set - EDGE ? 'dusk' : 'day');
  const x = 201 - half + 2 * half * t;
  const y = up ? HORIZON - 4 * peak * t * (1 - t) : HORIZON + 26;
  arcEl.setAttribute('d', `M${(201 - half).toFixed(1)} ${HORIZON} Q201 ${(HORIZON - 2 * peak).toFixed(1)} ${(201 + half).toFixed(1)} ${HORIZON}`);
  arcEl.style.opacity = day.daylight > 0 ? 1 : 0;
  sunEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  sunEl.style.opacity = up ? 1 : 0;
  seasonLabel.textContent = `${new Date(s.longest.day).toLocaleDateString(undefined, { month: 'long' })}'s path`;
  // Near midsummer today's path is the longest day's, and the sun passes where the label sits.
  seasonLabel.style.opacity = share > 0.85 ? 0 : 1;
  const root = document.documentElement.style, k = SKIES[name];
  for (const p of ['a', 'b', 'c']) root.setProperty(`--sky-${p}`, k[p]);
  root.setProperty('--glow', k.glow);
  root.setProperty('--stars', k.stars);
  // The scene is centred and scaled to fit the sky (meet), so map its x to the sky's width.
  const sky = document.querySelector('.sky');
  const scale = Math.min(sky.clientWidth / 402, sky.clientHeight / 300) || 1;
  root.setProperty('--sun-x', `${((sky.clientWidth - 402 * scale) / 2 + x * scale).toFixed(0)}px`);
  document.querySelector('meta[name="theme-color"]').content = k.a;
}

// ---- Screens ----
let current = null; // the season on screen, for the sky clock and the day preview

function welcome() {
  // Show the idea before asking for anything: a sky for a typical mid-latitude place.
  current = season(new Date().setHours(12, 0, 0, 0), 51.51, -0.13, {});
  paintSky(current);
  app.innerHTML = `
    <section class="card welcome">
      <h2>When does the light come back?</h2>
      <p>Daylight counts down to the moments the dark months turn: lighter evenings, the shortest day, lighter mornings, and the day there's enough light again.</p>
      <p class="hint">It needs a rough location to work out sunrise and sunset. That stays on this phone.</p>
      <button type="button" class="btn primary" id="welcome-locate">${icon('pin')} Use my location</button>
      <div class="field">
        <label for="welcome-city">Or choose a city</label>
        <input id="welcome-city" type="text" list="cities" autocomplete="off" autocorrect="off" autocapitalize="words"
               spellcheck="false" enterkeyhint="go" placeholder="Start typing, e.g. Oslo" aria-describedby="welcome-status">
      </div>
      <button type="button" class="btn quiet" id="welcome-manual">Type coordinates instead</button>
      <p class="hint" id="welcome-status" role="status"></p>
    </section>`;
  const status = document.getElementById('welcome-status');
  document.getElementById('welcome-locate').addEventListener('click', async () => {
    status.textContent = 'Finding you…';
    try {
      save({ ...settings, ...(await currentPlace()), source: 'gps' });
      render();
    } catch (e) {
      status.textContent = e.message;
    }
  });
  const pick = (e) => {
    const city = findCity(e.target.value);
    if (city) { save({ ...settings, lat: city.lat, lon: city.lon, source: 'city', city: city.name }); render(); }
    else if (e.type === 'change' && e.target.value.trim()) status.textContent = 'Pick a city from the list, or type coordinates instead.';
  };
  const cityField = document.getElementById('welcome-city');
  cityField.addEventListener('input', pick);
  cityField.addEventListener('change', pick);
  document.getElementById('welcome-manual').addEventListener('click', openSettings);
}

function render() {
  // Re-rendering replaces the focused button, so put focus back on the screen rather than lose it.
  const hadFocus = app.contains(document.activeElement);
  if (settings.lat == null) welcome();
  else dashboard();
  if (hadFocus) (document.getElementById('place-button') || document.getElementById('welcome-locate'))?.focus({ preventScroll: true });
}

function dashboard() {
  const bearable = bearableMinutes();
  const s = season(new Date().setHours(12, 0, 0, 0), settings.lat, settings.lon, { bearable, evening: eveningMinutes() });
  current = s;
  const { days, todayIndex: ti, shortestIndex: si, today } = s;
  const next = s.points[s.next];
  const daysLeft = s.daysUntil(next);
  const w = words(next);
  const rising = ti > si;
  const toLose = today.daylight - s.shortest.daylight;
  // Once the light is plentiful, stop counting down: in spring to the dark side of the year,
  // and after midsummer never at all, until days drop below what feels bearable again.
  const summer = today.daylight >= (rising ? DAY / 2 : (bearable ?? 720) * 60e3);
  const celebrate = daysLeft < 1 && !flag(`lit:${next.key}`);

  const state = (p) => (p.key === next.key ? 'next' : s.done(p) ? 'done' : 'ahead');
  const listHtml = `<ol class="list" role="list">${s.points.map((p) => `
    <li class="row ${state(p)}${celebrate && p.key === next.key ? ' lighting' : ''}">
      <span class="dot">${icon(words(p).icon)}</span>
      <span class="rt"><b>${words(p).title}</b><small>${words(p).detail}</small></span>
      <span class="rd"><b>${date(p.day)}</b><small>${state(p) === 'done' ? 'Lit' : countdown(s.daysUntil(p))}</small></span>
    </li>`).join('')}</ol>`;

  const stats = `
    <div class="stats">
      <div><b>${dur(today.daylight)}</b><span>of light today</span></div>
      ${today.daylight === 0 && s.change === 0
        ? `<div class="end"><b>${daysLeft}</b><span>${daysLeft === 1 ? 'day' : 'days'} until the sun is back</span></div>`
        : `<div class="end"><b>${change(s.change)}</b><span>vs yesterday${s.change < 0 && s.slowing ? ', and slowing' : ''}</span></div>`}
    </div>`;

  let hero;
  if (summer) {
    const m = minutesOf(today.daylight);
    hero = `
      <p class="eyebrow">Today's light</p>
      <p class="big hours"><span class="n">${Math.floor(m / 60)}</span><small>h</small>${m % 60 ? ` <span class="n">${m % 60}</span><small>m</small>` : ''}</p>
      <h2>${rising ? `Lighter every day until ${date(s.longest.day)}` : today.daylight >= DAY / 2 ? 'The long days are here' : 'Still plenty of light'}</h2>
      <div class="comfort">
        <p>${rising
          ? `<b>${durLong(toLose)}</b> more light than midwinter. ${tangible(toLose)}`
          : `Still <b>${durLong(toLose)}</b> more light than midwinter. Enjoy it.`}</p>
        ${stats}
      </div>`;
  } else {
    const comfort = daysLeft < 1
      ? `<b>Today.</b> ${w.after}`
      : today.daylight === 0
        ? `The sun is resting below the horizon. It comes back on <b>${date(next.day)}</b>, and stays a little longer every day after.`
      : !rising && s.change < 0 && toLose > 60e3
        ? `The dark has only <b>${durLong(toLose)}</b> left to take. After that, every day gives some back.`
        : s.gained
          ? `<b>+${dur(s.gained)}</b> of light since ${date(s.shortest.day)}. ${tangible(s.gained)}`
          : 'The bottom of the year. From here, every day gives some light back.';
    hero = `
      <p class="eyebrow">${daysLeft < 1 ? 'A milestone today' : 'The next turn towards light'}</p>
      ${daysLeft < 2
        ? `<p class="big words"><span class="n">${countdown(daysLeft)}</span></p>`
        : `<p class="big"><span class="n">${daysLeft}</span><small>days</small></p>`}
      <h2>${w.title}</h2>
      <p class="when">${dateLong(next.day)} · ${w.detail}</p>
      <div class="comfort"><p>${comfort}</p>${stats}</div>`;
  }

  const sunTimes = today.rise == null
    ? `<div class="suntimes"><div><b>${today.daylight > 0 ? 'Sun up all day' : 'No sunrise today'}</b>${today.daylight > 0 ? 'midnight sun' : 'polar night'}</div></div>`
    : `<div class="suntimes"><div><b>${time(today.rise)}</b>sunrise</div><div class="end"><b>${time(today.set)}</b>sunset</div></div>`;

  // Brightest light: solar noon, give or take half an hour. After sunset, tomorrow's.
  const lightDay = today.rise != null && Date.now() > today.set ? days[ti + 1] : today;
  const noon = lightDay.rise != null ? (lightDay.rise + lightDay.set) / 2 : null;
  const ritual = noon == null ? '' : `
    <section class="card ritual">
      <span class="badge">${icon('sun')}</span>
      <div>
        <b>${lightDay === today ? 'Brightest light' : "Tomorrow's brightest light"} ${time(noon - 30 * 60e3)} – ${time(noon + 30 * 60e3)}</b>
        <p>If you can, catch a little of it. Ten minutes by a window counts.</p>
      </div>
    </section>`;

  const later = summer && !rising
    ? `<details class="card later"><summary>Next winter's turn: ${date(s.points[0].day)}</summary>${listHtml}</details>`
    : `<section class="card"><h3>The way back to light</h3>${listHtml}</section>`;

  app.innerHTML = `
    ${sunTimes}
    <section class="hero">${hero}</section>
    ${valley(s, { summer, rising, bearable })}
    ${ritual}
    ${later}
    <button type="button" class="place" id="place-button">${icon('pin')} ${placeName()}</button>`;
  document.getElementById('place-button').addEventListener('click', openSettings);
  wireScrub(s);

  if (celebrate) {
    setFlag(`lit:${next.key}`);
    sunrise(s);
  } else {
    paintSky(s);
  }
}

// ---- The valley: day length across the season, with today on it ----
let valleyGeom = null;
function valley(s, { summer, rising, bearable }) {
  const { days, todayIndex: ti, shortestIndex: si } = s;
  const light = days.map((d) => d.daylight);
  const far = s.points.find((p) => p.kind === 'bearable')?.at ?? s.points.find((p) => p.kind === 'sunset')?.at ?? si + 60;
  let a, b;
  if (summer) { a = ti - 60; b = ti + 75; }
  else { a = Math.min(ti, si) - 45; b = Math.max(far, ti) + 14; }
  a = Math.max(2, a); b = Math.min(days.length - 2, b);
  const W = 338, H = 160, top = 16, base = H - 26;
  const span = light.slice(a, b + 1);
  const threshold = bearable != null ? bearable * 60e3 : null;
  let lo = Math.min(...span), hi = Math.max(...span);
  if (threshold != null && threshold > lo && threshold < hi + (hi - lo) * 0.3) hi = Math.max(hi, threshold);
  const X = (i) => ((i - a) / (b - a)) * W;
  const Y = (v) => top + ((hi - v) / ((hi - lo) || 1)) * (base - top - 10);
  valleyGeom = { a, b, X, Y, light };
  const path = (i0, i1) => {
    let d = '';
    for (let i = i0; i <= i1; i++) d += `${i === i0 ? 'M' : 'L'}${X(i).toFixed(1)} ${Y(light[i]).toFixed(1)}`;
    return d;
  };
  const months = [];
  for (let i = a + 1; i <= b; i++) if (new Date(days[i].day).getDate() === 1) months.push(i);
  const nextPoint = s.points[s.next];
  const showThreshold = threshold != null && threshold >= lo && threshold <= hi;
  const tx = X(ti), ty = Y(light[ti]);

  let caption;
  if (summer) {
    const top = s.points.find((p) => p.kind === 'longest');
    caption = rising
      ? `${s.daysUntil(top)} days to the top of the year.`
      : `Past the top of the year. Next winter's turn is ${date(s.points[0].day)}.`;
  } else if (!rising) {
    caption = `${si - ti} days to the bottom of the valley. The climb out starts on ${date(days[si].day)}.`;
  } else {
    const bp = s.points.find((p) => p.kind === 'bearable' && !s.done(p));
    caption = `${ti - si} days into the climb.${bp ? ` ${s.daysUntil(bp)} days until ${hoursText(bp.minutes)} of light.` : ''}`;
  }
  const label = `Day length from ${date(days[a].day)} to ${date(days[b].day)}. Today ${dur(light[ti])}. ${caption}`;

  return `
    <section class="card valley">
      <h3>Where you are</h3>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
        <defs>
          <linearGradient id="valley-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffd58a" stop-opacity=".3"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${path(a, b)}L${W} ${base}L0 ${base}Z" fill="url(#valley-fill)"/>
        ${showThreshold ? `
          <line class="threshold" x1="0" x2="${W}" y1="${Y(threshold)}" y2="${Y(threshold)}"/>
          <text x="0" y="${Y(threshold) - 6}">${hoursText(bearable, true)}, your bearable day</text>` : ''}
        <path class="ahead" d="${path(ti, b)}"/>
        <path class="lived" d="${path(a, ti)}"/>
        ${s.points.filter((p) => p.at >= a && p.at <= b).map((p) => {
          const cx = X(p.at), cy = Y(light[p.at]);
          if (p.key === nextPoint.key) {
            return `<circle cx="${cx}" cy="${cy}" r="9" class="next-halo"/><circle cx="${cx}" cy="${cy}" r="5" class="next"/>
              <text class="g" x="${Math.min(W - 18, Math.max(18, cx))}" y="${cy - 14}" text-anchor="middle">${date(p.day)}</text>`;
          }
          return `<circle cx="${cx}" cy="${cy}" r="4" class="${s.done(p) ? 'done' : 'mark'}"/>`;
        }).join('')}
        <g class="today-dot">
          <circle class="ring" cx="${tx}" cy="${ty}" r="10"/>
          <circle cx="${tx}" cy="${ty}" r="5" fill="#fff"/>
          <text x="${Math.min(W - 18, Math.max(18, tx))}" y="${ty + 24}" text-anchor="middle">Today</text>
        </g>
        <g id="peek" class="peek" hidden>
          <line id="peek-line" y1="${top - 6}" y2="${base}"/>
          <circle id="peek-dot" r="5"/>
        </g>
        ${months.map((i) => `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${new Date(days[i].day).toLocaleDateString(undefined, { month: 'short' })}</text>`).join('')}
      </svg>
      <p class="cap">${caption}</p>
      <div class="scrub">
        <label for="scrub">Look at another day</label>
        <input id="scrub" type="range" min="${a}" max="${b}" step="1" value="${ti}">
        <div class="peek-row">
          <p id="peek-text" aria-hidden="true"></p>
          <button type="button" class="btn quiet small" id="peek-reset" hidden>Back to today</button>
        </div>
      </div>
    </section>`;
}

function wireScrub(s) {
  const range = document.getElementById('scrub');
  if (!range) return;
  const out = document.getElementById('peek-text');
  const reset = document.getElementById('peek-reset');
  const peek = document.getElementById('peek');
  const describe = (d) => (d.rise == null
    ? `${date(d.day)}: ${d.daylight > 0 ? 'sun up all day' : 'no sunrise'}`
    : `${date(d.day)}: ${dur(d.daylight)} of light, sunset ${time(d.set)}`);
  const show = () => {
    const i = Number(range.value), d = s.days[i], isToday = i === s.todayIndex;
    const text = isToday ? `Today: ${dur(d.daylight)} of light` : describe(d);
    out.textContent = text;
    range.setAttribute('aria-valuetext', text);
    reset.hidden = isToday;
    peek.toggleAttribute('hidden', isToday); // an SVG element has no .hidden property
    if (!isToday) {
      const { X, Y, light } = valleyGeom;
      document.getElementById('peek-line').setAttribute('x1', X(i));
      document.getElementById('peek-line').setAttribute('x2', X(i));
      document.getElementById('peek-dot').setAttribute('cx', X(i));
      document.getElementById('peek-dot').setAttribute('cy', Y(light[i]));
    }
    paintSky(s, isToday ? {} : { day: d });
  };
  range.addEventListener('input', show);
  reset.addEventListener('click', () => { range.value = s.todayIndex; show(); range.focus(); });
  show();
}

// On a milestone day, the first time the app opens: the sky runs through a dawn.
function sunrise(s) {
  if (reducedMotion.matches) { paintSky(s); return; }
  const root = document.documentElement;
  root.classList.add('instant');
  paintSky(s, { phase: 'night', now: s.today.rise ?? Date.now() });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.classList.remove('instant');
    root.classList.add('celebrating');
    paintSky(s, { phase: 'dawn', now: s.today.rise ? s.today.rise + EDGE / 2 : Date.now() });
    setTimeout(() => { paintSky(s); setTimeout(() => root.classList.remove('celebrating'), 2600); }, 1300);
  }));
}

// ---- Settings dialog ----
// "Use my location" and the city picker only fill the field, so Cancel still undoes them.
let gpsFill = '';
let cityFill = null;
function openSettings() {
  coordsInput.value = settings.lat != null ? coordsText(settings) : '';
  coordsInput.setCustomValidity('');
  gpsFill = settings.source === 'gps' ? coordsInput.value : '';
  cityFill = settings.source === 'city' && settings.city ? { name: settings.city, text: coordsInput.value } : null;
  cityInput.value = cityFill ? cityFill.name : '';
  form.elements.bearable.value = settings.bearable === undefined ? 10 : settings.bearable;
  form.elements.evening.value = settings.evening === undefined ? '17:00' : settings.evening;
  locateStatus.textContent = '';
  dialog.returnValue = '';
  dialog.showModal();
}
document.getElementById('open-settings').addEventListener('click', openSettings);
document.getElementById('settings-cancel').addEventListener('click', () => dialog.close());

document.getElementById('locate').addEventListener('click', async () => {
  locateStatus.textContent = 'Finding you…';
  try {
    gpsFill = coordsText(await currentPlace());
    coordsInput.value = gpsFill;
    coordsInput.setCustomValidity('');
    cityInput.value = '';
    locateStatus.textContent = 'Found you. Save to use it.';
  } catch (e) {
    locateStatus.textContent = e.message;
  }
});

cityInput.addEventListener('input', () => {
  const city = findCity(cityInput.value);
  if (!city) return;
  cityFill = { name: city.name, text: coordsText(city) };
  coordsInput.value = cityFill.text;
  coordsInput.setCustomValidity('');
  locateStatus.textContent = '';
});

coordsInput.addEventListener('input', () => coordsInput.setCustomValidity(''));
form.addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'save') return;
  const value = coordsInput.value.trim();
  if (!value && settings.lat == null) {
    coordsInput.setCustomValidity('Use your location, choose a city or type latitude, longitude, e.g. 51.5, -0.12');
  } else if (value && !parseCoords(value)) {
    coordsInput.setCustomValidity('Use latitude, longitude in degrees, e.g. 51.5, -0.12');
  } else {
    return;
  }
  e.preventDefault();
  coordsInput.reportValidity();
});

dialog.addEventListener('close', () => {
  const choice = dialog.returnValue;
  dialog.returnValue = '';
  if (choice !== 'save') return;
  const value = coordsInput.value.trim();
  const place = parseCoords(value);
  const where = !place ? {}
    : cityFill && value === cityFill.text ? { ...place, source: 'city', city: cityFill.name }
    : { ...place, source: value === gpsFill ? 'gps' : 'manual', city: undefined };
  save({ ...settings, ...where, bearable: form.elements.bearable.value, evening: form.elements.evening.value });
  render();
});

// Safari has no closedby="any" yet, so tapping the backdrop is handled here.
if (!('closedBy' in HTMLDialogElement.prototype)) {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = r.top <= event.clientY && event.clientY <= r.bottom && r.left <= event.clientX && event.clientX <= r.right;
    if (!inside) dialog.close();
  });
}

// ---- Keep it current ----
// The countdown changes at midnight and the sky moves through the day; a phone may leave
// the app open or suspended across either.
let shown = new Date().toDateString();
function tick() {
  if (new Date().toDateString() !== shown) { shown = new Date().toDateString(); render(); return; }
  const range = document.getElementById('scrub');
  if (current && (!range || Number(range.value) === current.todayIndex)) paintSky(current);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
setInterval(tick, 60e3);

// Follow the phone when it moves, but only for a location that came from GPS (never one
// typed or picked by hand) and only once location has already been allowed.
if (settings.source === 'gps' && navigator.permissions?.query) {
  navigator.permissions.query({ name: 'geolocation' })
    .then((p) => (p.state === 'granted' ? currentPlace() : null))
    .then((place) => {
      if (place && (place.lat !== settings.lat || place.lon !== settings.lon)) {
        save({ ...settings, ...place });
        render();
      }
    })
    .catch(() => {});
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

render();
