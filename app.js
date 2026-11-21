import { season } from './seasons.js';

const STORE = 'daylight';
const app = document.getElementById('app');
const dialog = document.getElementById('settings');
const form = document.getElementById('settings-form');
const coordsInput = form.elements.coords;
const locateStatus = document.getElementById('locate-status');

// ---- Settings (kept on this device only) ----
function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function save(next) {
  try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* private mode: keep it for this session */ }
  settings = next;
}
let settings = load();

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

const DENIED = 'Location is off for this app. Allow it in Settings › Privacy & Security › Location Services, or type the coordinates.';
function currentPlace() {
  if (!('geolocation' in navigator)) return Promise.reject(new Error('This browser cannot share a location. Type the coordinates instead.'));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: round(pos.coords.latitude), lon: round(pos.coords.longitude) }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? DENIED : 'Could not find your location. Try again, or type the coordinates.')),
      { enableHighAccuracy: false, maximumAge: 6 * 3600e3, timeout: 15000 },
    );
  });
}

// ---- Wording ----
const clockText = (min) => new Date(2000, 0, 1, Math.floor(min / 60), min % 60)
  .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const hoursText = (min, short) => {
  const hh = Math.floor(min / 60), mm = min % 60;
  if (mm === 0 || mm === 30) return `${hh}${mm ? '½' : ''}${short ? ' h' : ' hours'}`;
  return `${hh}h ${mm}m`;
};
const words = (p) => ({
  evenings: { title: 'Evenings get lighter', label: ['Lighter', 'evenings'], icon: 'sunset', detail: 'Sunsets stop getting earlier, before the shortest day.' },
  grow: { title: 'Days start growing', label: ['Days', 'grow'], icon: 'grow', detail: 'The shortest day. Every day after it is longer.' },
  'sun-returns': { title: 'The sun returns', label: ['Sun', 'returns'], icon: 'sunrise', detail: 'First sunrise after the polar night.' },
  mornings: { title: 'Mornings get lighter', label: ['Lighter', 'mornings'], icon: 'sunrise', detail: 'Sunrises stop getting later.' },
  sunset: { title: `Sunset after ${clockText(p.minutes)}`, label: ['Sunset', clockText(p.minutes)], icon: 'sunset', detail: 'Daylight after a normal working day.' },
  bearable: { title: `${hoursText(p.minutes)} of light`, label: [`${hoursText(p.minutes, true)} of`, 'light'], icon: 'sun', detail: 'Back above your bearable day length.' },
  equal: { title: 'Day longer than night', label: ['Day beats', 'night'], icon: 'half', detail: 'More light than dark until autumn.' },
  longest: { title: 'Longest day', label: ['Longest', 'day'], icon: 'sun', detail: 'The top of the year.' },
})[p.kind];

const date = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const countdown = (n) => (n < 1 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`);
// Intl.DurationFormat localises "8h 37m"; older browsers get the English short form.
const durations = 'DurationFormat' in Intl ? new Intl.DurationFormat(undefined, { style: 'narrow' }) : null;
const fmt = (parts) => (durations
  ? durations.format(parts)
  : Object.entries(parts).filter(([, v]) => v).map(([k, v]) => `${v}${k[0]}`).join(' ')) || '0m';
const dur = (ms) => {
  const m = Math.max(0, Math.round(ms / 60e3));
  return fmt({ hours: Math.floor(m / 60), minutes: m % 60 });
};
const change = (ms) => {
  const s = Math.round(Math.abs(ms) / 1000);
  return `${ms < 0 ? '−' : '+'}${fmt({ minutes: Math.floor(s / 60), seconds: s % 60 })}`;
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const where = ({ lat, lon }) => `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? 'W' : 'E'}`;

// ---- Screens ----
function welcome() {
  app.innerHTML = `
    <section class="card welcome">
      <span class="badge">${icon('sunrise')}</span>
      <h2>When does the light come back?</h2>
      <p>Daylight counts down to the moments the dark months turn: lighter evenings, the shortest day, lighter mornings, and the day there's enough light again.</p>
      <p class="hint">It needs your rough location to work out sunrise and sunset. That stays on this phone.</p>
      <button type="button" class="btn primary" id="welcome-locate">${icon('pin')} Use my location</button>
      <button type="button" class="btn" id="welcome-manual">Type coordinates instead</button>
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
  document.getElementById('welcome-manual').addEventListener('click', openSettings);
}

function render() {
  // Re-rendering replaces the focused button, so put focus back on the screen rather than lose it.
  const hadFocus = app.contains(document.activeElement);
  if (settings.lat == null) {
    welcome();
  } else {
    dashboard();
  }
  if (hadFocus) (document.getElementById('place-button') || document.getElementById('welcome-locate'))?.focus({ preventScroll: true });
}

function dashboard() {
  const s = season(new Date().setHours(12, 0, 0, 0), settings.lat, settings.lon,
    { bearable: bearableMinutes(), evening: eveningMinutes() });
  const next = s.points[s.next];
  const days = s.daysUntil(next);
  const w = words(next);
  const state = (p) => (p.key === next.key ? 'next' : s.done(p) ? 'done' : 'ahead');
  const segs = s.points.map((p, i) => `<i style="--fill:${i < s.next ? 1 : i === s.next ? s.progress.toFixed(3) : 0}"></i>`).join('');
  const passed = `${s.next} of ${s.points.length} milestones passed. Next: ${w.title}, ${countdown(days).toLowerCase()}.`;

  const n = Math.min(5, s.points.length);
  const from = Math.max(0, Math.min(s.next - 1, s.points.length - n));
  const win = s.points.slice(from, from + n);
  const centre = (i) => ((i + 0.5) / win.length) * 100;
  const ni = win.findIndex((p) => p.key === next.key);
  // With no finished milestone on the track the left edge is "now"; otherwise "now"
  // travels between the last finished milestone and the next one.
  const nowAt = ni > 0 ? centre(ni - 1) + (centre(ni) - centre(ni - 1)) * s.progress : 0;

  app.innerHTML = `
    <section class="hero">
      <p class="eyebrow">${days < 1 ? 'Milestone today' : 'Next milestone'}</p>
      ${days < 2
        ? `<p class="big words">${countdown(days)}</p>`
        : `<p class="big">${days}<small>days</small></p>`}
      <h2>${w.title}</h2>
      <p class="gold">${date(next.day)} · ${w.detail}</p>
      <div class="segs" role="img" aria-label="${passed}">${segs}</div>
      <div class="stats">
        <div><b>${dur(s.today.daylight)}</b><span>of light today</span></div>
        ${s.gained
          ? `<div class="end"><b class="gold">+${dur(s.gained)}</b><span>since ${date(s.shortest.day)}</span></div>`
          : `<div class="end"><b>${change(s.change)}</b><span>vs yesterday</span></div>`}
      </div>
    </section>

    <section class="card">
      <div class="track" style="--now:${nowAt.toFixed(2)}; --count:${win.length}" aria-hidden="true">
        <div class="line"></div><div class="done-line"></div><div class="now"></div>
        ${win.map((p, i) => `
          <div class="node ${state(p)}" style="--at:${centre(i).toFixed(2)}">
            <small>${date(p.day)}</small>
            <span class="slot"><span class="mark">${state(p) === 'done' ? icon('check') : ''}</span></span>
            <span class="lbl">${words(p).label[0]}<br>${words(p).label[1]}</span>
          </div>`).join('')}
      </div>
    </section>

    <section class="card">
      <h3>The way back to light</h3>
      <ol class="list" role="list">
        ${s.points.map((p) => `
          <li class="row ${state(p)}">
            <span class="dot">${icon(state(p) === 'done' ? 'check' : words(p).icon)}</span>
            <span class="rt"><b>${words(p).title}</b><small>${words(p).detail}</small></span>
            <span class="rd"><b>${date(p.day)}</b><small>${state(p) === 'done' ? 'Done' : countdown(s.daysUntil(p))}</small></span>
          </li>`).join('')}
      </ol>
    </section>

    <button type="button" class="place" id="place-button">${icon('pin')} ${where(settings)}</button>`;
  document.getElementById('place-button').addEventListener('click', openSettings);
}

// ---- Settings dialog ----
// "Use my location" only fills the field, so Cancel still undoes it.
let gpsFill = '';
function openSettings() {
  coordsInput.value = settings.lat != null ? coordsText(settings) : '';
  coordsInput.setCustomValidity('');
  gpsFill = settings.source === 'gps' ? coordsInput.value : '';
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
    locateStatus.textContent = 'Found you. Save to use it.';
  } catch (e) {
    locateStatus.textContent = e.message;
  }
});

coordsInput.addEventListener('input', () => coordsInput.setCustomValidity(''));
form.addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'save') return;
  const value = coordsInput.value.trim();
  if (!value && settings.lat == null) {
    coordsInput.setCustomValidity('Use your location or type latitude, longitude, e.g. 51.5, -0.12');
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
  save({
    ...settings,
    ...(place ? { ...place, source: value === gpsFill ? 'gps' : 'manual' } : {}),
    bearable: form.elements.bearable.value,
    evening: form.elements.evening.value,
  });
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
// The countdown changes at midnight; a phone may leave the app open or suspended across it.
let shown = new Date().toDateString();
function refreshIfNewDay() {
  if (new Date().toDateString() !== shown) { shown = new Date().toDateString(); render(); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIfNewDay(); });
setInterval(refreshIfNewDay, 60e3);

// Follow the phone when it moves, but only for a location that came from GPS (never one
// typed by hand) and only once location has already been allowed.
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
