'use strict';

const STORE_KEY = 'trainingstagebuch-v2';
const SYNC_KEY = 'trainingstagebuch-sync';
const DATA_PATH = 'trainingstagebuch.json';

const CATS = {
  grundlagen: { label: 'Grundlagen', color: 'var(--c-grundlagen)' },
  kraft:      { label: 'Kraft',      color: 'var(--c-kraft)' },
  technik:    { label: 'Technik',    color: 'var(--c-technik)' }
};
const LOCATIONS = { zuhause: 'Zuhause', kraftraum: 'Kraftraum' };

const NOTE_CATS = { todo: 'ToDo', anlauf: 'Anlauf', staffel: 'Staffelwechsel', allgemein: 'Allgemein' };

const UNITS = {
  time:     { label: 'Zeit',             better: 'lower',  hint: 'Format: 11,34 · 2:05,3 · 17:45' },
  distance: { label: 'Weite / Höhe (m)', better: 'higher', hint: 'In Metern, z. B. 4,20' },
  weight:   { label: 'Gewicht (kg)',     better: 'higher', hint: 'In kg, z. B. 100' },
  reps:     { label: 'Wiederholungen',   better: 'higher', hint: 'Anzahl, z. B. 12' },
  points:   { label: 'Punkte',           better: 'higher', hint: 'z. B. 5432' }
};
const PB_CATS = { la: 'Leichtathletik', kraft: 'Kraftraum' };

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DOW_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const ICON = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>'
};

// ---------- Hilfsfunktionen ----------

const $ = (sel, el = document) => el.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');

const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => ymd(new Date());
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
const weekStart = s => { const d = parseYmd(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); };
const weekDays = s => { const ws = weekStart(s); return Array.from({ length: 7 }, (_, i) => addDays(ws, i)); };
const fmtDate = s => { const d = parseYmd(s); return `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDateShort = s => { const d = parseYmd(s); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; };
const fmtDateLong = s => { const d = parseYmd(s); return `${DOW_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`; };
const fmtMinutes = m => m >= 60 ? `${Math.floor(m / 60)}:${pad(Math.round(m % 60))} h` : `${Math.round(m)} min`;

const trimNum = v => String(Math.round(v * 100) / 100).replace('.', ',');

function fmtTime(s, withUnit = true) {
  const t = Math.round(s * 100);
  const h = Math.floor(t / 360000);
  const m = Math.floor((t % 360000) / 6000);
  let sec = ((t % 6000) / 100).toFixed(2);
  if (!h && !m) return sec.replace('.', ',') + (withUnit ? ' s' : '');
  sec = sec.padStart(5, '0');
  if (sec.endsWith('.00')) sec = sec.slice(0, -3);
  sec = sec.replace('.', ',');
  return h ? `${h}:${pad(m)}:${sec}` : `${m}:${sec}`;
}

function fmtValue(v, unit) {
  if (v == null || isNaN(v)) return '–';
  switch (unit) {
    case 'time': return fmtTime(v);
    case 'distance': return v.toFixed(2).replace('.', ',') + ' m';
    case 'weight': return trimNum(v) + ' kg';
    case 'reps': return trimNum(v) + ' Wdh.';
    default: return trimNum(v) + ' Pkt.';
  }
}

const toInput = (v, unit) => v == null ? '' : unit === 'time' ? fmtTime(v, false) : trimNum(v);

function parseValue(str, unit) {
  const s = String(str).trim().replace(/,/g, '.').replace(/[^\d.:]/g, '');
  if (!s) return NaN;
  if (unit === 'time') {
    const parts = s.split(':').map(Number);
    if (parts.length > 3 || parts.some(isNaN)) return NaN;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  return Number(s);
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------- Daten ----------
// Standard-Einträge haben feste IDs, damit Handy und Laptop beim Sync keine Duplikate erzeugen.

function defaultState() {
  const d = (id, name, category, unit) => ({ id, name, category, unit, updatedAt: 0 });
  const q = (id, name, target) => ({ id, name, target, updatedAt: 0 });
  return {
    version: 2,
    sessions: [],
    disciplines: [
      d('d-stab', 'Stabhochsprung', 'la', 'distance'),
      d('d-30f', '30 m fliegend', 'la', 'time'),
      d('d-60', '60 m', 'la', 'time'),
      d('d-100', '100 m', 'la', 'time'),
      d('d-weit', 'Weitsprung', 'la', 'distance'),
      d('d-hoch', 'Hochsprung', 'la', 'distance'),
      d('d-kugel', 'Kugelstoß', 'la', 'distance'),
      d('d-bank', 'Bankdrücken', 'kraft', 'weight'),
      d('d-squat', 'Kniebeuge', 'kraft', 'weight'),
      d('d-dead', 'Kreuzheben', 'kraft', 'weight'),
      d('d-clean', 'Umsetzen', 'kraft', 'weight'),
      d('d-snatch', 'Reißen', 'kraft', 'weight'),
      d('d-pull', 'Klimmzüge', 'kraft', 'reps')
    ],
    results: [],
    competitions: [],
    notes: [],
    quests: [
      q('q-push', 'Liegestütz', '3 × 20'),
      q('q-core', 'Core Workout', '10 min: Plank, Side Plank, Crunches'),
      q('q-fuss', 'Fußstabi', '5 min: Einbeinstand, Zehenstand'),
      q('q-mob', 'Mobility', '10 min Hüfte & Schultern'),
      q('q-pull', 'Klimmzüge', '3 × max'),
      q('q-hand', 'Handstand an der Wand', '3 × 30 s'),
      q('q-rope', 'Seilspringen', '5 min')
    ],
    questLog: {},
    analyses: [],
    settings: {
      weekTemplate: {
        2: { cat: 'kraft', topic: 'Kraft zuhause', location: 'zuhause' },
        4: { cat: 'kraft', topic: 'Kraftraum', location: 'kraftraum' }
      },
      updatedAt: 0
    },
    deleted: {},
    lastBackup: null
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) { /* kaputte Daten -> neu starten */ }
  return defaultState();
}

let state = load();

function saveLocal() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('⚠️ Speichern fehlgeschlagen');
  }
}

function commit() { saveLocal(); render(); scheduleSync(); }

// Jede Änderung bekommt einen Zeitstempel, Löschungen einen Grabstein: daraus mischt der Sync.
function put(coll, item) {
  item.updatedAt = Date.now();
  const arr = state[coll];
  const i = arr.findIndex(x => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.push(item);
}

function remove(coll, id) {
  state[coll] = state[coll].filter(x => x.id !== id);
  state.deleted[id] = Date.now();
}

const ui = {
  tab: 'today', calMonth: null, selDate: todayStr(),
  perfView: 'pbs', pbCat: 'la', pbDetail: null,
  notesView: 'infos', noteCat: 'all', noteQuery: '', journalQuery: '',
  statWeeks: 12, statExercise: null, tableCat: 'all', tableQuery: '',
  aiRange: 'lastMonth', aiFrom: '', aiTo: '', aiQuestion: '',
  recapFilter: 'all', recapQuery: ''
};

// ---------- Abfragen ----------

const sessionsOn = date => state.sessions.filter(s => s.date === date);
const discipline = id => state.disciplines.find(d => d.id === id);
const quest = id => state.quests.find(q => q.id === id);
const isBetter = (a, b, unit) => UNITS[unit].better === 'lower' ? a < b : a > b;

function resultsFor(did) {
  return state.results
    .filter(r => r.disciplineId === did)
    .sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created);
}

function bestResult(d) {
  let best = null;
  for (const r of resultsFor(d.id)) if (!best || isBetter(r.value, best.value, d.unit)) best = r;
  return best;
}

function nextCompetition() {
  const t = todayStr();
  return state.competitions.filter(c => c.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
}

// ---------- Daily Quest ----------
// Ohne Eintrag wird die Quest aus dem Datum abgeleitet: Handy und Laptop zeigen dieselbe.
// Quests mit „krank“ im Namen markieren Krankheitstage: nie zufällig gezogen, Streak pausiert.

const isSickQuest = q => !!q && /krank/i.test(q.name);

function isSickDay(date) {
  const e = state.questLog[date];
  return !!e && (!!e.sick || isSickQuest(quest(e.questId)));
}

function autoQuest(date) {
  const pool = state.quests.filter(q => !isSickQuest(q)).sort((a, b) => a.id.localeCompare(b.id));
  if (!pool.length) return null;
  let i = hash(date) % pool.length;
  if (pool.length > 1) {
    const y = addDays(date, -1);
    const ye = state.questLog[y];
    const yId = ye && quest(ye.questId) ? ye.questId : pool[hash(y) % pool.length].id;
    if (pool[i].id === yId) i = (i + 1) % pool.length;
  }
  return pool[i];
}

function questFor(date) {
  const e = state.questLog[date];
  return (e && quest(e.questId)) || autoQuest(date);
}

const questDone = date => !!(state.questLog[date] && state.questLog[date].done) && !isSickDay(date);

// Krankheitstage zählen nicht mit, unterbrechen den Streak aber auch nicht
function questStreak() {
  let d = todayStr();
  if (!questDone(d)) d = addDays(d, -1);
  let n = 0;
  for (;;) {
    if (questDone(d)) n++;
    else if (!isSickDay(d)) break;
    d = addDays(d, -1);
  }
  return n;
}

function bestQuestStreak() {
  const dates = Object.keys(state.questLog).sort();
  if (!dates.length) return 0;
  let best = 0, run = 0;
  for (let d = dates[0]; d <= todayStr(); d = addDays(d, 1)) {
    if (questDone(d)) best = Math.max(best, ++run);
    else if (!isSickDay(d)) run = 0;
  }
  return best;
}

function setQuestLog(date, patch) {
  const q = questFor(date);
  state.questLog[date] = { questId: q && q.id, done: false, ...state.questLog[date], ...patch, updatedAt: Date.now() };
}

// ---------- Sync (privates GitHub-Repo) ----------

function loadSync() {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch (e) { return {}; }
}
let syncCfg = loadSync();
const saveSyncCfg = () => localStorage.setItem(SYNC_KEY, JSON.stringify(syncCfg));
const syncConfigured = () => !!(syncCfg.owner && syncCfg.repo && syncCfg.token);

let syncStatus = 'off';
let syncError = '';
let syncTimer = null;
let syncing = false;
let syncAgain = false;

function updateSyncDot() {
  const dot = $('#syncDot');
  dot.hidden = !syncConfigured();
  dot.className = 'sync-dot ' + syncStatus;
  const labels = { ok: 'Synchronisiert', pending: 'Änderungen warten auf Sync', busy: 'Synchronisiere …', error: 'Sync-Fehler: ' + syncError, offline: 'Offline, Sync folgt' };
  dot.title = labels[syncStatus] || '';
}

function scheduleSync(delay = 2500) {
  if (!syncConfigured()) return;
  clearTimeout(syncTimer);
  syncStatus = 'pending';
  updateSyncDot();
  syncTimer = setTimeout(() => runSync(false), delay);
}

function b64enc(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function b64dec(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

const ghRepoUrl = () => `https://api.github.com/repos/${encodeURIComponent(syncCfg.owner)}/${encodeURIComponent(syncCfg.repo)}`;
const ghHeaders = () => ({ Authorization: `Bearer ${syncCfg.token}`, Accept: 'application/vnd.github+json' });

function ghError(status) {
  if (status === 401) return 'Token ungültig oder abgelaufen';
  if (status === 403) return 'Token hat keine Schreibrechte';
  if (status === 404) return 'Repo nicht gefunden oder kein Zugriff';
  return 'GitHub-Fehler ' + status;
}

async function ghGet(path = DATA_PATH) {
  const res = await fetch(`${ghRepoUrl()}/contents/${path}?t=${Date.now()}`, { headers: ghHeaders(), cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(ghError(res.status));
  const j = await res.json();
  return { sha: j.sha, data: JSON.parse(b64dec(j.content)) };
}

// false = jemand anderes hat zwischendurch gespeichert -> neu laden und mischen
async function ghPut(data, sha) {
  const device = innerWidth >= 900 ? 'Laptop' : 'Handy';
  const res = await fetch(`${ghRepoUrl()}/contents/${DATA_PATH}`, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Sync vom ${device}`, content: b64enc(JSON.stringify(data)), ...(sha ? { sha } : {}) })
  });
  if (res.status === 409 || res.status === 422) return false;
  if (!res.ok) throw new Error(ghError(res.status));
  return true;
}

const COLLECTIONS = ['sessions', 'disciplines', 'results', 'competitions', 'notes', 'quests', 'analyses'];

function mergeStates(a, b) {
  const deleted = { ...(a.deleted || {}) };
  for (const [k, v] of Object.entries(b.deleted || {})) deleted[k] = Math.max(deleted[k] || 0, v);
  const out = { ...defaultState(), ...a, deleted };
  for (const c of COLLECTIONS) {
    const map = new Map();
    for (const it of [...(a[c] || []), ...(b[c] || [])]) {
      const ex = map.get(it.id);
      if (!ex || (it.updatedAt || 0) > (ex.updatedAt || 0)) map.set(it.id, it);
    }
    out[c] = [...map.values()].filter(it => !(deleted[it.id] >= (it.updatedAt || 0)));
  }
  out.questLog = { ...(a.questLog || {}) };
  for (const [d, e] of Object.entries(b.questLog || {})) {
    const ex = out.questLog[d];
    if (!ex || (e.updatedAt || 0) > (ex.updatedAt || 0)) out.questLog[d] = e;
  }
  const sa = a.settings || {}, sb = b.settings || {};
  out.settings = (sb.updatedAt || 0) > (sa.updatedAt || 0) ? sb : sa;
  out.lastBackup = [a.lastBackup, b.lastBackup].filter(Boolean).sort().pop() || null;
  return out;
}

async function runSync(manual) {
  if (!syncConfigured()) {
    if (manual) toast('Sync ist noch nicht eingerichtet (Mehr → Sync)');
    return;
  }
  if (syncing) { syncAgain = true; return; }
  clearTimeout(syncTimer);
  if (!navigator.onLine) { syncStatus = 'offline'; updateSyncDot(); return; }
  syncing = true;
  syncStatus = 'busy';
  updateSyncDot();
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await ghGet();
      const before = JSON.stringify(state);
      const merged = remote ? mergeStates(state, remote.data) : state;
      const mergedJson = JSON.stringify(merged);
      state = merged;
      saveLocal();
      if (mergedJson !== before && !sheetOpen) render();
      if (remote && JSON.stringify(remote.data) === mergedJson) break;
      if (await ghPut(merged, remote && remote.sha)) break;
    }
    await pullRecaps();
    syncCfg.lastSync = Date.now();
    saveSyncCfg();
    syncStatus = 'ok';
    syncError = '';
    if (manual) toast('✓ Synchronisiert');
  } catch (e) {
    syncStatus = navigator.onLine ? 'error' : 'offline';
    syncError = e.message || 'Netzwerkfehler';
    if (manual) toast('Sync-Fehler: ' + syncError);
  }
  syncing = false;
  updateSyncDot();
  if (ui.tab === 'more' && !sheetOpen) render();
  if (syncAgain) { syncAgain = false; runSync(false); }
}

// Automatische Recaps (von Claudes geplanter Aufgabe) liegen in recaps.json und werden hier übernommen
async function pullRecaps() {
  let remote;
  try { remote = await ghGet('recaps.json'); } catch (e) { return; }
  if (!remote) return;
  let changed = false;
  for (const r of [].concat(remote.data)) {
    if (!r || !r.id || state.deleted[r.id] >= (r.updatedAt || 0)) continue;
    const ex = state.analyses.find(a => a.id === r.id);
    if (ex && (ex.updatedAt || 0) >= (r.updatedAt || 0)) continue;
    state.analyses = state.analyses.filter(a => a.id !== r.id).concat(r);
    changed = true;
  }
  if (changed) {
    saveLocal();
    if (!sheetOpen) render();
  }
}

async function testSyncConnection() {
  const res = await fetch(ghRepoUrl(), { headers: ghHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(ghError(res.status));
  const repo = await res.json();
  return repo;
}

// ---------- Rahmen: Kopfzeile, Sheet, Toast, Tooltip ----------

const view = $('#view');
const modal = $('#modal');
const sheet = $('#sheet');
let sheetOpen = false;
let ignorePop = false;

function setTop(title, left = '<span class="logo mobile-logo"></span>', right = '') {
  $('#title').textContent = title;
  $('#topLeft').innerHTML = left;
  $('#topRight').innerHTML = right;
}

const iconBtn = (action, icon, extra = '') => `<button class="icon-btn" data-action="${action}" ${extra}>${icon}</button>`;

function openSheet(html, mount) {
  sheet.innerHTML = '<div class="sheet-grip"></div>' + html;
  sheet.scrollTop = 0;
  modal.classList.remove('hidden');
  if (!sheetOpen) {
    history.pushState({ sheet: true }, '');
    sheetOpen = true;
  }
  if (mount) mount(sheet);
}

function closeSheet() {
  if (!sheetOpen) return;
  sheetOpen = false;
  modal.classList.add('hidden');
  if (history.state && history.state.sheet) {
    ignorePop = true;
    history.back();
  }
}

// Android-Zurück-Taste schließt Sheets und die PB-Detailansicht
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop = false; return; }
  if (sheetOpen) {
    sheetOpen = false;
    modal.classList.add('hidden');
  } else if (ui.pbDetail) {
    ui.pbDetail = null;
    render();
  }
});

modal.addEventListener('click', e => { if (e.target === modal) closeSheet(); });

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
}

// Hover-Tooltip für alle Diagramm-Elemente mit data-tip
const tip = $('#tip');
function showTip(e) {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { tip.classList.add('hidden'); return; }
  tip.textContent = t.dataset.tip;
  tip.classList.remove('hidden');
  const r = tip.getBoundingClientRect();
  let x = e.clientX + 14, y = e.clientY - r.height - 10;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
  if (y < 8) y = e.clientY + 18;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
document.addEventListener('pointermove', showTip);
document.addEventListener('pointerdown', showTip);
document.addEventListener('scroll', () => tip.classList.add('hidden'), true);

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Ansicht: Heute ----------

function renderToday() {
  const t = todayStr();
  const now = new Date();
  setTop('Heute', undefined, iconBtn('add-session', ICON.plus, `data-date="${t}"`));

  let left = '', right = '';
  const next = nextCompetition();
  if (next) {
    const n = daysBetween(t, next.date);
    left += `<div class="card countdown" data-action="edit-comp" data-id="${next.id}">
        <div><div class="num">${n === 0 ? '🏁' : n}</div><div class="lbl">${n === 0 ? 'heute!' : n === 1 ? 'Tag' : 'Tage'}</div></div>
        <div>
          <div class="lbl">Nächster Wettkampf</div>
          <div class="name">${esc(next.name)}</div>
          <div class="lbl">${fmtDate(next.date)}${next.location ? ' · ' + esc(next.location) : ''}</div>
        </div>
      </div>`;
  }

  const sess = sessionsOn(t);
  const tpl = state.settings.weekTemplate[now.getDay()];
  const tplBtn = tpl && !sess.some(s => s.cat === tpl.cat)
    ? `<button class="btn small" data-action="apply-template-day" data-date="${t}">+ ${esc(tpl.topic || CATS[tpl.cat].label)} (Vorlage)</button>` : '';
  left += `<div class="card">
      <div class="card-head"><h2>Training heute</h2><button class="btn small" data-action="add-session" data-date="${t}">+ Einheit</button></div>
      ${sess.length ? sess.map(s => sessionItem(s)).join('') : `<div class="empty">Nichts eingetragen.</div>`}
      ${tplBtn ? `<div style="margin-top:8px">${tplBtn}</div>` : ''}
    </div>`;
  left += weekStats(t);

  right += questCard(t);
  right += todoCard();

  view.innerHTML = `
    <div class="hero-date">
      <div class="muted small">${DOW_LONG[now.getDay()]}</div>
      <div class="day">${now.getDate()}. ${MONTHS[now.getMonth()]}</div>
    </div>
    ${recapBanner()}
    ${backupBanner()}
    <div class="grid-2"><div>${left}</div><div>${right}</div></div>`;
}

function sessionItem(s, opts = {}) {
  const c = CATS[s.cat] || CATS.grundlagen;
  const exs = s.exercises || [];
  const meta = [
    opts.showDate ? fmtDateShort(s.date) : '',
    c.label,
    s.cat === 'kraft' && s.location ? LOCATIONS[s.location] : '',
    s.duration ? s.duration + ' min' : '',
    s.rpe ? 'RPE ' + s.rpe : '',
    s.cat === 'kraft' && exs.length ? `${exs.filter(e => e.done).length}/${exs.length} Übungen` : ''
  ].filter(Boolean).join(' · ');
  const text = s.cat === 'kraft'
    ? exs.map(e => [e.name, e.sets, e.weight && e.weight + ' kg'].filter(Boolean).join(' ')).join(' · ')
    : s.cat === 'technik' ? [s.content, s.journal && '💭 ' + s.journal].filter(Boolean).join('\n') : s.content;
  return `<div class="list-item ${s.done ? 'done' : ''}" data-action="edit-session" data-id="${s.id}">
      <span class="type-bar" style="background:${c.color}"></span>
      <div class="grow">
        <div class="title">${esc(s.topic || c.label)}</div>
        <div class="meta">${esc(meta)}</div>
        ${text ? `<div class="sub">${esc(text)}</div>` : ''}
      </div>
      <button class="check ${s.done ? 'on' : ''}" data-action="toggle-session" data-id="${s.id}" aria-label="Erledigt"></button>
    </div>`;
}

function questCard(t) {
  const q = questFor(t);
  if (!q) {
    return `<div class="card"><div class="card-head"><h2>Daily Quest</h2></div>
      <div class="empty">Kein Übungs-Pool. <a href="#" data-action="goto" data-tab="more">Unter „Mehr“ Übungen anlegen</a></div></div>`;
  }
  const done = questDone(t);
  const sick = isSickDay(t);
  const streak = questStreak();
  const rerollable = state.quests.filter(x => !isSickQuest(x)).length > 1;
  const body = sick
    ? `<div class="quest is-sick">
        <div class="q-label">🤒 Krankheitstag</div>
        <div class="q-name">Gute Besserung!</div>
        <div class="q-target">Dein Streak pausiert heute und läuft danach weiter.</div>
        <div class="btn-row"><button class="btn" data-action="unsick-quest" data-date="${t}">Doch nicht krank</button></div>
      </div>`
    : `<div class="quest ${done ? 'is-done' : ''}">
        <div class="q-label">${done ? '✓ Erledigt' : 'Deine Quest heute'}</div>
        <div class="q-name">${esc(q.name)}</div>
        ${q.target ? `<div class="q-target">${esc(q.target)}</div>` : ''}
        <div class="btn-row">
          <button class="btn ${done ? '' : 'primary'}" data-action="toggle-quest" data-date="${t}">${done ? 'Rückgängig' : '✓ Geschafft'}</button>
          ${done || !rerollable ? '' : `<button class="btn" data-action="reroll-quest" data-date="${t}">🎲 Neu würfeln</button>`}
        </div>
        ${done ? '' : `<button class="btn small" style="margin-top:8px" data-action="sick-quest" data-date="${t}">🤒 Heute krank</button>`}
      </div>`;
  return `<div class="card">
      <div class="card-head">
        <h2>Daily Quest</h2>
        <div class="streak"><span>🔥</span><span class="count">${streak}</span><span class="muted small">${streak === 1 ? 'Tag' : 'Tage'}</span></div>
      </div>
      ${body}
      ${heatmap(t)}
      <div class="muted small" style="margin-top:8px">Rekord: ${bestQuestStreak()} Tage in Folge</div>
    </div>`;
}

// Letzte 20 Wochen, eine Spalte pro Woche (Mo oben)
function heatmap(t) {
  const start = addDays(weekStart(t), -19 * 7);
  let cells = '';
  for (let i = 0; i < 140; i++) {
    const d = addDays(start, i);
    let cls = d > t ? 'future' : questDone(d) ? 'h2' : isSickDay(d) ? 'sick' : '';
    if (d === t) cls += ' today';
    const q = d <= t && state.questLog[d] && quest(state.questLog[d].questId);
    const tipExtra = isSickDay(d) ? '\n🤒 krank' : questDone(d) && q ? '\n✓ ' + esc(q.name) : '';
    cells += `<div class="${cls}" ${d <= t ? `data-tip="${fmtDate(d)}${tipExtra}"` : ''}></div>`;
  }
  return `<div class="heatmap">${cells}</div>`;
}

function todoCard() {
  const todos = state.notes.filter(n => n.cat === 'todo' && !n.done)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.updatedAt - b.updatedAt);
  if (!todos.length) return '';
  return `<div class="card">
      <div class="card-head"><h2>Offene ToDos</h2><a href="#" class="small" data-action="goto" data-tab="notes">Alle</a></div>
      ${todos.slice(0, 5).map(noteItem).join('')}
    </div>`;
}

function weekStats(t) {
  const days = weekDays(t);
  const sess = state.sessions.filter(s => days.includes(s.date));
  const done = sess.filter(s => s.done);
  const minutes = done.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  const quests = days.filter(questDone).length;
  return `<div class="card">
      <div class="card-head"><h2>Diese Woche</h2></div>
      <div class="stats">
        <div><div class="v">${done.length}/${sess.length}</div><div class="l">Einheiten</div></div>
        <div><div class="v">${fmtMinutes(minutes)}</div><div class="l">Trainingszeit</div></div>
        <div><div class="v">${quests}/7</div><div class="l">Quests</div></div>
      </div>
    </div>`;
}

// "Gelesen" merkt sich jedes Gerät selbst
const SEEN_KEY = 'trainingstagebuch-seen-recaps';
function seenRecaps() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch (e) { return []; }
}
function markRecapSeen(id) {
  const seen = seenRecaps();
  if (!seen.includes(id)) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id].slice(-50)));
}

function recapBanner() {
  const seen = seenRecaps();
  const fresh = state.analyses
    .filter(a => a.source === 'auto' && !seen.includes(a.id) && Date.now() - a.createdAt < 14 * 86400000)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!fresh) return '';
  const fazit = (fresh.text.split(/\n#+\s/)[0] || '').replace(/^#+.*\n/, '').replace(/[*#]/g, '').trim().slice(0, 160);
  return `<div class="card recap-card" data-action="ai-open" data-id="${fresh.id}">
      <div class="card-head"><h2>📬 Neues ${fresh.kind === 'month' ? 'Monats' : 'Wochen'}-Recap</h2><span class="pill">${esc(fresh.label)}</span></div>
      ${fazit ? `<div class="small" style="color:var(--text-2)">${esc(fazit)}${fazit.length >= 160 ? ' …' : ''}</div>` : ''}
      <div class="small" style="margin-top:6px;color:var(--accent);font-weight:700">Lesen →</div>
    </div>`;
}

function backupBanner() {
  if (syncConfigured()) return '';
  const count = state.sessions.length + state.results.length + state.notes.length;
  if (count < 10) return '';
  const age = state.lastBackup ? daysBetween(state.lastBackup, todayStr()) : Infinity;
  if (age < 30) return '';
  return `<div class="banner">
      <div class="grow">💾 ${state.lastBackup ? `Letztes Backup vor ${age} Tagen.` : 'Noch kein Backup.'} Richte den Sync ein oder speichere ein Backup.</div>
      <button class="btn small" data-action="goto" data-tab="more">Mehr</button>
    </div>`;
}

// ---------- Ansicht: Kalender ----------

function renderCalendar() {
  if (!ui.calMonth) ui.calMonth = ui.selDate.slice(0, 8) + '01';
  setTop('Kalender', undefined, iconBtn('add-session', ICON.plus, `data-date="${ui.selDate}"`));
  const t = todayStr();
  const month = parseYmd(ui.calMonth).getMonth();
  const start = weekStart(ui.calMonth);

  let cells = DOW.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const ds = addDays(start, i);
    const dd = parseYmd(ds);
    if (i % 7 === 0 && i > 0 && dd.getMonth() !== month) break;
    const sess = sessionsOn(ds);
    const comps = state.competitions.filter(c => c.date === ds);
    const dots = sess.slice(0, 6).map(s => {
      const col = (CATS[s.cat] || CATS.grundlagen).color;
      return `<span class="dot ${s.done ? '' : 'planned'}" style="background:${col};color:${col}"></span>`;
    }).join('');
    const evs = comps.map(c => `<span class="cal-ev" style="border-color:var(--accent)">🏁 ${esc(c.name)}</span>`).join('')
      + sess.map(s => `<span class="cal-ev ${s.done ? '' : 'planned'}" style="border-color:${(CATS[s.cat] || CATS.grundlagen).color}">${esc(s.topic || CATS[s.cat].label)}</span>`).join('');
    const cls = [
      dd.getMonth() !== month && 'other',
      ds === t && 'today',
      ds === ui.selDate && 'sel',
      comps.length && 'comp'
    ].filter(Boolean).join(' ');
    cells += `<button class="cal-day ${cls}" data-action="select-day" data-date="${ds}">
        <span class="n">${dd.getDate()}</span><span class="dots">${dots}</span><span class="cal-evs">${evs}</span>
        ${questDone(ds) ? '<span class="quest-mark"></span>' : ''}
      </button>`;
  }

  const m = parseYmd(ui.calMonth);
  view.innerHTML = `<div class="grid-cal">
    <div class="card">
      <div class="cal-head">
        ${iconBtn('cal-prev', ICON.back)}
        <h2>${MONTHS[m.getMonth()]} ${m.getFullYear()}</h2>
        ${iconBtn('cal-next', ICON.next)}
      </div>
      <div class="cal-grid">${cells}</div>
      <div class="legend">
        ${Object.values(CATS).map(c => `<span><i style="background:${c.color}"></i>${c.label}</span>`).join('')}
        <span><i style="background:transparent;box-shadow:inset 0 0 0 2px var(--accent)"></i>Wettkampf</span>
        <span><i style="background:var(--accent);height:3px"></i>Quest erledigt</span>
      </div>
      <div class="muted small" style="margin-top:4px">Gefüllt = erledigt, Ring = geplant</div>
    </div>
    ${dayAgenda(ui.selDate)}
  </div>`;
}

function dayAgenda(date) {
  const comps = state.competitions.filter(c => c.date === date);
  const sess = sessionsOn(date);
  const q = date <= todayStr() && state.quests.length ? questFor(date) : null;
  const compItems = comps.map(c => `<div class="list-item" data-action="edit-comp" data-id="${c.id}">
      <span class="type-bar" style="background:var(--accent)"></span>
      <div class="grow"><div class="title">🏁 ${esc(c.name)}</div><div class="sub">${esc(c.location || 'Wettkampf')}</div></div>
    </div>`).join('');

  return `<div class="card">
      <div class="card-head">
        <h2>${fmtDateLong(date)}</h2>
        ${date !== todayStr() ? '<button class="btn small" data-action="cal-today">Heute</button>' : ''}
      </div>
      ${compItems}
      ${sess.map(s => sessionItem(s)).join('')}
      ${!sess.length && !comps.length ? '<div class="empty">Keine Einheit eingetragen.</div>' : ''}
      ${isSickDay(date) ? '<div class="muted small" style="margin-top:8px">🤒 Krankheitstag</div>'
        : q ? `<div class="muted small" style="margin-top:8px">Quest: ${esc(q.name)} ${questDone(date) ? '✓' : '✗'}</div>` : ''}
      <div class="btn-row" style="margin-top:12px">
        <button class="btn primary" data-action="add-session" data-date="${date}">+ Einheit</button>
        <button class="btn" data-action="apply-template-week" data-date="${date}">Wochenvorlage einfügen</button>
      </div>
    </div>`;
}

function templateSession(date) {
  const tpl = state.settings.weekTemplate[parseYmd(date).getDay()];
  if (!tpl || sessionsOn(date).some(s => s.cat === tpl.cat)) return null;
  return { id: uid(), date, cat: tpl.cat, topic: tpl.topic || '', location: tpl.cat === 'kraft' ? tpl.location || 'zuhause' : '', content: '', journal: '', notes: '', exercises: [], duration: null, rpe: null, done: false };
}

function applyTemplateWeek(date) {
  const created = weekDays(date).map(templateSession).filter(Boolean);
  if (!created.length) return toast('Vorlage ist für diese Woche schon eingetragen');
  created.forEach(s => put('sessions', s));
  commit();
  toast(`${created.length} Einheit(en) aus der Vorlage eingefügt`);
}

// ---------- Sheet: Trainingseinheit ----------

function lastKraftExercises(date, location) {
  const prev = state.sessions
    .filter(s => s.cat === 'kraft' && s.date < date && (s.exercises || []).length)
    .sort((a, b) => b.date.localeCompare(a.date));
  const match = prev.find(s => s.location === location) || prev[0];
  return match ? { from: match, exercises: match.exercises.map(e => ({ ...e, id: uid(), done: false })) } : null;
}

function openSessionSheet(s, date, asNew = false) {
  const isNew = !s || asNew;
  const d = date || todayStr();
  const v = s ? JSON.parse(JSON.stringify(s)) : {
    id: uid(), date: d, cat: 'grundlagen', topic: '', content: '', journal: '', notes: '',
    location: 'zuhause', exercises: [], duration: null, rpe: null, done: d < todayStr()
  };
  v.exercises = v.exercises || [];
  if (!v.location) v.location = 'zuhause';
  let cat = v.cat;
  let location = v.location;
  let rpe = v.rpe;
  const exs = v.exercises;

  const rpeBtns = Array.from({ length: 10 }, (_, i) => i + 1)
    .map(n => `<button type="button" data-rpe="${n}" class="${rpe === n ? 'on' : ''}">${n}</button>`).join('');

  openSheet(`
    <h2>${isNew ? 'Neue Einheit' : 'Einheit bearbeiten'}</h2>
    <form id="f">
      <div class="segmented cats">${Object.entries(CATS).map(([k, c]) => `<button type="button" data-cat="${k}">${c.label}</button>`).join('')}</div>
      <div class="row2">
        <label class="field"><span>Datum</span><input type="date" name="date" value="${v.date}" required></label>
        <label class="field"><span>Thema</span><input name="topic" value="${esc(v.topic)}" placeholder="z. B. Anlauf + Einstich"></label>
      </div>

      <div class="cat-section" data-for="grundlagen">
        <label class="field"><span>Inhalt (nach dem Training eintragen)</span><textarea name="content_g" placeholder="Einlaufen 15 min&#10;Lauf-ABC&#10;5 × 60 m Steigerungen&#10;Auslaufen">${esc(v.cat === 'grundlagen' ? v.content : '')}</textarea></label>
      </div>

      <div class="cat-section" data-for="kraft">
        <div class="field"><span>Ort</span>
          <div class="segmented" style="margin:0">${Object.entries(LOCATIONS).map(([k, l]) => `<button type="button" data-loc="${k}">${l}</button>`).join('')}</div>
        </div>
        <div class="field"><span>Übungen</span>
          <div class="ex-head"><span></span><span>Übung</span><span>Sätze×Wdh</span><span>kg</span><span></span></div>
          <div id="exList"></div>
          <div class="btn-row" style="margin-top:6px">
            <button type="button" class="btn small" id="exAdd">+ Übung</button>
            <button type="button" class="btn small" id="exCopy">Aus letzter Einheit übernehmen</button>
          </div>
        </div>
      </div>

      <div class="cat-section" data-for="technik">
        <label class="field"><span>Inhalt</span><textarea name="content_t" placeholder="z. B. 6 Sprünge aus 12er-Anlauf, Stab 4,30 m / 75 kg">${esc(v.cat === 'technik' ? v.content : '')}</textarea></label>
        <label class="field"><span>💭 Journal: Gedanken & Ideen</span><textarea class="journal" name="journal" placeholder="Was hat sich gut angefühlt? Was will ich nächstes Mal ausprobieren?">${esc(v.journal)}</textarea></label>
      </div>

      <label class="field"><span>Notizen</span><textarea name="notes" style="min-height:64px">${esc(v.notes)}</textarea></label>
      <div class="row2">
        <label class="field"><span>Dauer (min)</span><input type="number" name="duration" inputmode="numeric" min="0" value="${v.duration ?? ''}"></label>
        <label class="toggle" style="margin-top:24px"><input type="checkbox" name="done" ${v.done ? 'checked' : ''}> Erledigt</label>
      </div>
      <div class="field"><span>Anstrengung (RPE 1–10)</span><div class="rpe">${rpeBtns}</div></div>
      <button class="btn primary block" type="submit">Speichern</button>
      ${isNew ? '' : `<div class="btn-row" style="margin-top:8px">
        <button type="button" class="btn" data-action="dup-session" data-id="${v.id}">Duplizieren</button>
        <button type="button" class="btn danger" data-action="del-session" data-id="${v.id}">Löschen</button>
      </div>`}
    </form>`, el => {
    const f = $('#f', el);

    const showCat = () => {
      el.querySelectorAll('[data-cat]').forEach(b => {
        const on = b.dataset.cat === cat;
        b.classList.toggle('active', on);
        b.style.background = on ? CATS[cat].color : '';
      });
      el.querySelectorAll('.cat-section').forEach(sec => { sec.hidden = sec.dataset.for !== cat; });
    };
    const showLoc = () => el.querySelectorAll('[data-loc]').forEach(b => b.classList.toggle('active', b.dataset.loc === location));
    const renderEx = () => {
      $('#exList', el).innerHTML = exs.map((e, i) => `<div class="ex-row">
          <button type="button" class="check sm ${e.done ? 'on' : ''}" data-ex-check="${i}" aria-label="Erledigt"></button>
          <input data-ex="name" data-i="${i}" value="${esc(e.name)}" placeholder="Übung">
          <input data-ex="sets" data-i="${i}" value="${esc(e.sets)}" placeholder="3×10">
          <input data-ex="weight" data-i="${i}" value="${esc(e.weight)}" placeholder="kg" inputmode="decimal">
          <button type="button" class="x" data-ex-del="${i}" aria-label="Entfernen">×</button>
        </div>`).join('') || '<div class="empty">Noch keine Übungen geplant.</div>';
    };
    showCat(); showLoc(); renderEx();

    el.querySelectorAll('[data-cat]').forEach(b => { b.onclick = () => { cat = b.dataset.cat; showCat(); }; });
    el.querySelectorAll('[data-loc]').forEach(b => { b.onclick = () => { location = b.dataset.loc; showLoc(); }; });
    el.querySelectorAll('[data-rpe]').forEach(b => {
      b.onclick = () => {
        const n = Number(b.dataset.rpe);
        rpe = rpe === n ? null : n;
        el.querySelectorAll('[data-rpe]').forEach(x => x.classList.toggle('on', Number(x.dataset.rpe) === rpe));
      };
    });
    $('#exList', el).addEventListener('input', e => {
      const inp = e.target.closest('[data-ex]');
      if (inp) exs[inp.dataset.i][inp.dataset.ex] = inp.value;
    });
    $('#exList', el).addEventListener('click', e => {
      const chk = e.target.closest('[data-ex-check]');
      const del = e.target.closest('[data-ex-del]');
      if (chk) { const x = exs[chk.dataset.exCheck]; x.done = !x.done; renderEx(); }
      if (del) { exs.splice(Number(del.dataset.exDel), 1); renderEx(); }
    });
    $('#exAdd', el).onclick = () => {
      exs.push({ id: uid(), name: '', sets: '', weight: '', done: false });
      renderEx();
      const inputs = el.querySelectorAll('[data-ex="name"]');
      inputs[inputs.length - 1].focus();
    };
    $('#exCopy', el).onclick = () => {
      const last = lastKraftExercises(f.date.value, location);
      if (!last) return toast('Keine frühere Krafteinheit mit Übungen gefunden');
      exs.push(...last.exercises.filter(e => !exs.some(x => x.name.trim().toLowerCase() === e.name.trim().toLowerCase())));
      renderEx();
      toast(`Übernommen vom ${fmtDateShort(last.from.date)}`);
    };

    f.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(f);
      put('sessions', {
        ...v,
        cat,
        date: fd.get('date'),
        topic: fd.get('topic').trim(),
        content: cat === 'grundlagen' ? fd.get('content_g').trim() : cat === 'technik' ? fd.get('content_t').trim() : '',
        journal: cat === 'technik' ? fd.get('journal').trim() : v.journal || '',
        location: cat === 'kraft' ? location : '',
        exercises: cat === 'kraft' ? exs.filter(x => x.name.trim()) : v.exercises.filter(x => x.name.trim()),
        notes: fd.get('notes').trim(),
        duration: fd.get('duration') ? Number(fd.get('duration')) : null,
        done: fd.get('done') === 'on',
        rpe
      });
      closeSheet();
      commit();
      toast('Gespeichert');
    };
  });
}

// ---------- Ansicht: Leistung (PBs + Wettkämpfe) ----------

function renderPerf() {
  if (ui.perfView === 'pbs' && ui.pbDetail) return renderPbDetail();
  const seg = `<div class="segmented">
      <button class="${ui.perfView === 'pbs' ? 'active' : ''}" data-action="perf-view" data-v="pbs">Bestleistungen</button>
      <button class="${ui.perfView === 'comps' ? 'active' : ''}" data-action="perf-view" data-v="comps">Wettkämpfe</button>
    </div>`;
  if (ui.perfView === 'comps') return renderComps(seg);
  setTop('Leistung', undefined, iconBtn('add-discipline', ICON.plus));
  const t = todayStr();
  const list = state.disciplines.filter(d => d.category === ui.pbCat);

  const cards = list.map(d => {
    const best = bestResult(d);
    const fresh = best && daysBetween(best.date, t) <= 14;
    return `<button class="pb-card ${fresh ? 'fresh' : ''} ${d.id === 'd-stab' ? 'main' : ''}" data-action="open-pb" data-id="${d.id}">
        <div class="name">${esc(d.name)}</div>
        ${best
          ? `<div class="val">${fmtValue(best.value, d.unit)}</div><div class="date">${fresh ? '🔥 ' : ''}${fmtDate(best.date)}</div>`
          : '<div class="val none">Noch kein Eintrag</div>'}
      </button>`;
  }).join('');

  view.innerHTML = `${seg}
    <div class="chips">${Object.entries(PB_CATS).map(([k, l]) => `<button class="chip ${ui.pbCat === k ? 'active' : ''}" data-action="pb-cat" data-cat="${k}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="pb-grid">${cards}</div>` : '<div class="empty">Noch keine Disziplinen. Tippe oben auf +.</div>'}
    <button class="btn primary block" style="margin-top:14px" data-action="add-result">+ Ergebnis eintragen</button>`;
}

function renderPbDetail() {
  const d = discipline(ui.pbDetail);
  if (!d) { ui.pbDetail = null; return renderPerf(); }
  setTop(d.name, iconBtn('pb-back', ICON.back), iconBtn('edit-discipline', ICON.edit, `data-id="${d.id}"`));
  const rs = resultsFor(d.id);
  const best = bestResult(d);

  const progression = new Set();
  let run = null;
  for (const r of rs) if (run === null || isBetter(r.value, run, d.unit)) { progression.add(r.id); run = r.value; }

  const items = [...rs].reverse().map(r => `<div class="list-item" data-action="edit-result" data-id="${r.id}">
      <div class="grow">
        <div class="title">${fmtValue(r.value, d.unit)} ${r.id === best.id ? '<span class="star">★ PB</span>' : progression.has(r.id) ? '<span class="muted small">↑ damals PB</span>' : ''}</div>
        <div class="sub">${fmtDate(r.date)}${r.note ? ' · ' + esc(r.note) : ''}</div>
      </div>
    </div>`).join('');

  view.innerHTML = `
    <div class="grid-2">
      <div>
        <div class="card">
          <div class="pb-hero">
            <div class="muted small">Persönliche Bestleistung · ${PB_CATS[d.category]}</div>
            <div class="val">${best ? fmtValue(best.value, d.unit) : '–'}</div>
            <div class="muted small">${best ? fmtDate(best.date) + (best.note ? ' · ' + esc(best.note) : '') : 'Noch kein Ergebnis'}</div>
          </div>
        </div>
        ${rs.length ? `<div class="card"><div class="card-head"><h2>Verlauf</h2><span class="muted small">Linie = Bestleistung</span></div>${pbChart(rs, d)}</div>` : ''}
      </div>
      <div>
        <div class="card">
          <div class="card-head"><h2>Alle Ergebnisse</h2><span class="pill">${rs.length}</span></div>
          ${items || '<div class="empty">Trag dein erstes Ergebnis ein.</div>'}
        </div>
        <button class="btn primary block" data-action="add-result" data-id="${d.id}">+ Ergebnis eintragen</button>
      </div>
    </div>`;
}

// Einfache Zeitreihe; bei Zeiten ist die Achse gedreht, damit "besser" immer oben ist.
function lineChart(points, { unit, lower = false, stepBest = false, color = 'var(--accent)', label }) {
  const W = 340, H = 190, pl = 50, pr = 14, pt = 12, pb = 26;
  const xs = points.map(p => parseYmd(p.date).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 15 * 86400000; x1 += 15 * 86400000; }
  const vs = points.map(p => p.value);
  let v0 = Math.min(...vs), v1 = Math.max(...vs);
  const padV = v0 === v1 ? (Math.abs(v0) * 0.05 || 1) : (v1 - v0) * 0.12;
  v0 -= padV; v1 += padV;
  const X = t => pl + (t - x0) / (x1 - x0) * (W - pl - pr);
  const Y = v => { const f = (v - v0) / (v1 - v0); return lower ? pt + f * (H - pt - pb) : H - pb - f * (H - pt - pb); };
  const lbl = label || (v => unit === 'time' ? fmtTime(v, false) : trimNum(v));

  let svg = '';
  for (let i = 0; i <= 3; i++) {
    const v = v0 + (v1 - v0) * i / 3;
    const y = Y(v).toFixed(1);
    svg += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/>
      <text class="axis" x="${pl - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${lbl(v)}</text>`;
  }
  const dateLbl = t => { const dt = new Date(t); return `${MONTHS_SHORT[dt.getMonth()]} ${String(dt.getFullYear()).slice(2)}`; };
  svg += `<text class="axis" x="${pl}" y="${H - 6}">${dateLbl(Math.min(...xs))}</text>`;
  if (xs.length > 1) svg += `<text class="axis" x="${W - pr}" y="${H - 6}" text-anchor="end">${dateLbl(Math.max(...xs))}</text>`;

  let path = '', best = null;
  const marks = points.map((p, i) => {
    const x = X(xs[i]).toFixed(1), y = Y(p.value).toFixed(1);
    let isPb = false;
    if (stepBest) {
      if (best === null || (lower ? p.value < best : p.value > best)) {
        path += best === null ? `M${x},${y}` : `H${x}V${y}`;
        best = p.value;
        isPb = true;
      }
    } else {
      path += (i ? 'L' : 'M') + `${x},${y}`;
    }
    const fill = stepBest && !isPb ? 'var(--muted)' : color;
    return `<circle class="pt" cx="${x}" cy="${y}" r="4.5" style="fill:${fill}"/>
      <circle class="hit" cx="${x}" cy="${y}" r="12" data-tip="${esc(p.tip)}"/>`;
  });
  if (stepBest) path += `H${X(Math.max(...xs)).toFixed(1)}`;

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${svg}<path class="line" d="${path}" style="stroke:${color}"/>${marks.join('')}</svg>`;
}

function pbChart(rs, d) {
  return lineChart(rs.map(r => ({ date: r.date, value: r.value, tip: `${fmtValue(r.value, d.unit)}\n${fmtDate(r.date)}${r.note ? '\n' + r.note : ''}` })),
    { unit: d.unit, lower: UNITS[d.unit].better === 'lower', stepBest: true });
}

function disciplineOptions(selected) {
  return Object.entries(PB_CATS).map(([k, l]) => `<optgroup label="${l}">${state.disciplines
    .filter(d => d.category === k)
    .map(d => `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</optgroup>`).join('');
}

function openResultSheet(r, discId) {
  const isNew = !r;
  const first = state.disciplines.find(d => d.category === ui.pbCat) || state.disciplines[0];
  if (!first) return toast('Lege zuerst eine Disziplin an');
  const v = r ? { ...r } : { id: uid(), disciplineId: discId || first.id, value: null, date: todayStr(), note: '', created: Date.now() };
  const unitOf = id => (discipline(id) || first).unit;

  openSheet(`
    <h2>${isNew ? 'Ergebnis eintragen' : 'Ergebnis bearbeiten'}</h2>
    <form id="f">
      <label class="field"><span>Disziplin</span><select name="disciplineId">${disciplineOptions(v.disciplineId)}</select></label>
      <div class="row2">
        <label class="field"><span>Ergebnis</span><input name="value" value="${toInput(v.value, unitOf(v.disciplineId))}" autocomplete="off" required></label>
        <label class="field"><span>Datum</span><input type="date" name="date" value="${v.date}" required></label>
      </div>
      <div class="hint" id="hint"></div>
      <label class="field"><span>Notiz</span><input name="note" value="${esc(v.note)}" placeholder="z. B. Hallen-DM, Stab 4,45 m / 80 kg"></label>
      <button class="btn primary block" type="submit">Speichern</button>
      ${isNew ? '' : `<div class="btn-row" style="margin-top:8px"><button type="button" class="btn danger" data-action="del-result" data-id="${v.id}">Löschen</button></div>`}
    </form>`, el => {
    const sel = $('[name=disciplineId]', el);
    const input = $('[name=value]', el);
    const updateHint = () => {
      const unit = unitOf(sel.value);
      $('#hint', el).textContent = UNITS[unit].hint;
      input.inputMode = unit === 'time' ? 'text' : 'decimal';
    };
    sel.onchange = updateHint;
    updateHint();
    $('#f', el).onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const d = discipline(fd.get('disciplineId'));
      const value = parseValue(fd.get('value'), d.unit);
      if (isNaN(value) || value <= 0) return toast('Ergebnis nicht erkannt. ' + UNITS[d.unit].hint);
      const prevBest = bestResult(d);
      put('results', { ...v, disciplineId: d.id, value, date: fd.get('date'), note: fd.get('note').trim() });
      const newBest = bestResult(d);
      closeSheet();
      commit();
      toast(newBest.id === v.id && (!prevBest || prevBest.id !== v.id) ? '🎉 Neue Bestleistung!' : 'Gespeichert');
    };
  });
}

function openDisciplineSheet(d) {
  const isNew = !d;
  const v = d ? { ...d } : { id: uid(), name: '', category: ui.pbCat, unit: ui.pbCat === 'kraft' ? 'weight' : 'distance' };
  const hasResults = !isNew && state.results.some(r => r.disciplineId === v.id);

  openSheet(`
    <h2>${isNew ? 'Neue Disziplin' : 'Disziplin bearbeiten'}</h2>
    <form id="f">
      <label class="field"><span>Name</span><input name="name" value="${esc(v.name)}" placeholder="z. B. Stabhochsprung (kurzer Anlauf)" required></label>
      <div class="row2">
        <label class="field"><span>Bereich</span><select name="category">${Object.entries(PB_CATS).map(([k, l]) => `<option value="${k}" ${k === v.category ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Messung</span><select name="unit" ${hasResults ? 'disabled' : ''}>${Object.entries(UNITS).map(([k, u]) => `<option value="${k}" ${k === v.unit ? 'selected' : ''}>${u.label}</option>`).join('')}</select></label>
      </div>
      ${hasResults ? '<div class="hint">Die Messart ist fest, weil schon Ergebnisse existieren.</div>' : ''}
      <button class="btn primary block" type="submit">Speichern</button>
      ${isNew ? '' : `<div class="btn-row" style="margin-top:8px"><button type="button" class="btn danger" data-action="del-discipline" data-id="${v.id}">Disziplin löschen</button></div>`}
    </form>`, el => {
    $('#f', el).onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      put('disciplines', { ...v, name: fd.get('name').trim(), category: fd.get('category'), unit: hasResults ? v.unit : fd.get('unit') });
      ui.pbCat = fd.get('category');
      closeSheet();
      commit();
    };
  });
}

function renderComps(seg) {
  setTop('Leistung', undefined, iconBtn('add-comp', ICON.plus));
  const t = todayStr();
  const upcoming = state.competitions.filter(c => c.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  const past = state.competitions.filter(c => c.date < t).sort((a, b) => b.date.localeCompare(a.date));

  const item = (c, isNext) => {
    const d = parseYmd(c.date);
    const n = daysBetween(t, c.date);
    const when = n < 0 ? fmtDate(c.date) : n === 0 ? 'Heute!' : n === 1 ? 'Morgen' : `in ${n} Tagen`;
    const detail = n < 0 ? c.results : c.goals;
    return `<div class="list-item" data-action="edit-comp" data-id="${c.id}">
        <div class="comp-date ${isNext ? 'next' : ''}"><div class="d">${d.getDate()}</div><div class="m">${MONTHS_SHORT[d.getMonth()]}</div></div>
        <div class="grow">
          <div class="title">${esc(c.name)}</div>
          <div class="sub">${[when, c.location].filter(Boolean).map(esc).join(' · ')}${detail ? '\n' + esc(detail) : ''}</div>
        </div>
      </div>`;
  };

  view.innerHTML = `${seg}
    <div class="grid-2">
      <div class="card">
        <div class="card-head"><h2>Anstehend</h2><span class="pill">${upcoming.length}</span></div>
        ${upcoming.map((c, i) => item(c, i === 0)).join('') || '<div class="empty">Kein Wettkampf geplant.</div>'}
      </div>
      <div class="card">
        <div class="card-head"><h2>Vergangen</h2><span class="pill">${past.length}</span></div>
        ${past.map(c => item(c, false)).join('') || '<div class="empty">Noch keine.</div>'}
      </div>
    </div>
    <button class="btn primary block" data-action="add-comp">+ Wettkampf</button>`;
}

function openCompSheet(c) {
  const isNew = !c;
  const v = c ? { ...c } : { id: uid(), name: '', date: todayStr(), location: '', goals: '', results: '' };
  openSheet(`
    <h2>${isNew ? 'Neuer Wettkampf' : 'Wettkampf bearbeiten'}</h2>
    <form id="f">
      <label class="field"><span>Name</span><input name="name" value="${esc(v.name)}" placeholder="z. B. Hessische Hallenmeisterschaften" required></label>
      <div class="row2">
        <label class="field"><span>Datum</span><input type="date" name="date" value="${v.date}" required></label>
        <label class="field"><span>Ort</span><input name="location" value="${esc(v.location)}"></label>
      </div>
      <label class="field"><span>Disziplinen & Ziele</span><textarea name="goals" placeholder="z. B. Stab: 4,40 m, Anfangshöhe 3,90 m">${esc(v.goals)}</textarea></label>
      <label class="field"><span>Ergebnisse & Notizen</span><textarea name="results" placeholder="Nach dem Wettkampf ausfüllen">${esc(v.results)}</textarea></label>
      <div class="hint">Tipp: Neue Bestleistungen zusätzlich unter „Bestleistungen“ eintragen, dann landen sie im Verlauf.</div>
      <button class="btn primary block" type="submit">Speichern</button>
      ${isNew ? '' : `<div class="btn-row" style="margin-top:8px"><button type="button" class="btn danger" data-action="del-comp" data-id="${v.id}">Löschen</button></div>`}
    </form>`, el => {
    $('#f', el).onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      put('competitions', {
        ...v,
        name: fd.get('name').trim(),
        date: fd.get('date'),
        location: fd.get('location').trim(),
        goals: fd.get('goals').trim(),
        results: fd.get('results').trim()
      });
      closeSheet();
      commit();
      toast('Gespeichert');
    };
  });
}

// ---------- Ansicht: Notizen (Infos + Technik-Journal) ----------

function renderNotes() {
  setTop('Notizen', undefined, ui.notesView === 'infos' ? iconBtn('add-note', ICON.plus) : '');
  const seg = `<div class="segmented">
      <button class="${ui.notesView === 'infos' ? 'active' : ''}" data-action="notes-view" data-v="infos">Infos & ToDos</button>
      <button class="${ui.notesView === 'journal' ? 'active' : ''}" data-action="notes-view" data-v="journal">Journal</button>
      <button class="${ui.notesView === 'recaps' ? 'active' : ''}" data-action="notes-view" data-v="recaps">Recaps</button>
    </div>`;

  if (ui.notesView === 'recaps') {
    view.innerHTML = `${seg}
      <div class="chips">${Object.entries(RECAP_FILTERS).map(([k, l]) => `<button class="chip ${ui.recapFilter === k ? 'active' : ''}" data-action="recap-filter" data-f="${k}">${l}</button>`).join('')}</div>
      <input class="search" id="q" type="search" placeholder="Recaps durchsuchen …" value="${esc(ui.recapQuery)}">
      ${gradeChartCard()}
      <div id="list"></div>`;
    const draw = () => { $('#list').innerHTML = recapList(); };
    $('#q').oninput = e => { ui.recapQuery = e.target.value; draw(); };
    return draw();
  }

  if (ui.notesView === 'journal') {
    view.innerHTML = `${seg}
      <input class="search" id="q" type="search" placeholder="Journal durchsuchen …" value="${esc(ui.journalQuery)}">
      <div id="list"></div>`;
    const draw = () => { $('#list').innerHTML = journalList(); };
    $('#q').oninput = e => { ui.journalQuery = e.target.value; draw(); };
    return draw();
  }

  view.innerHTML = `${seg}
    <div class="chips">
      <button class="chip ${ui.noteCat === 'all' ? 'active' : ''}" data-action="note-cat" data-cat="all">Alle</button>
      ${Object.entries(NOTE_CATS).map(([k, l]) => `<button class="chip ${ui.noteCat === k ? 'active' : ''}" data-action="note-cat" data-cat="${k}">${l}</button>`).join('')}
    </div>
    <input class="search" id="q" type="search" placeholder="Suchen …" value="${esc(ui.noteQuery)}">
    <div id="list"></div>
    <button class="btn primary block" data-action="add-note">+ Notiz</button>`;
  const draw = () => { $('#list').innerHTML = notesList(); };
  $('#q').oninput = e => { ui.noteQuery = e.target.value; draw(); };
  draw();
}

const matches = (q, ...fields) => !q || fields.join(' ').toLowerCase().includes(q.toLowerCase());

function noteItem(n) {
  const isTodo = n.cat === 'todo';
  return `<div class="list-item ${n.done ? 'done' : ''}" data-action="edit-note" data-id="${n.id}">
      ${isTodo ? `<button class="check sm ${n.done ? 'on' : ''}" data-action="toggle-note" data-id="${n.id}" aria-label="Erledigt"></button>` : ''}
      <div class="grow">
        <div class="title">${n.pinned ? '📌 ' : ''}${esc(n.title || '(ohne Titel)')}</div>
        ${n.body ? `<div class="sub">${esc(n.body)}</div>` : ''}
      </div>
      ${!isTodo ? `<span class="pill">${NOTE_CATS[n.cat] || ''}</span>` : ''}
    </div>`;
}

function notesList() {
  const list = state.notes
    .filter(n => (ui.noteCat === 'all' || n.cat === ui.noteCat) && matches(ui.noteQuery, n.title, n.body))
    .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
  if (!list.length) return `<div class="card"><div class="empty">${state.notes.length ? 'Nichts gefunden.' : 'Hier kannst du dir Anläufe, Staffelwechsel, ToDos und alles andere merken.'}</div></div>`;

  const groups = ui.noteCat === 'all' ? Object.keys(NOTE_CATS) : [ui.noteCat];
  return `<div class="grid-2">${groups.map(cat => {
    const items = list.filter(n => n.cat === cat);
    if (!items.length) return '';
    return `<div class="card"><div class="card-head"><h2>${NOTE_CATS[cat]}</h2><span class="pill">${items.filter(n => !n.done).length}</span></div>${items.map(noteItem).join('')}</div>`;
  }).join('')}</div>`;
}

function journalList() {
  const list = state.sessions
    .filter(s => s.cat === 'technik' && (s.journal || s.content || s.notes) && matches(ui.journalQuery, s.topic, s.journal, s.content, s.notes))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) return `<div class="card"><div class="empty">${ui.journalQuery ? 'Nichts gefunden.' : 'Sobald du bei Technik-Einheiten Gedanken notierst, erscheinen sie hier gesammelt.'}</div></div>`;
  return list.map(s => `<div class="card" data-action="edit-session" data-id="${s.id}" style="cursor:pointer">
      <div class="card-head"><h2>${esc(s.topic || 'Technik')}</h2><span class="muted small">${fmtDate(s.date)}</span></div>
      ${s.content ? `<div class="small muted" style="white-space:pre-line;margin-bottom:6px">${esc(s.content)}</div>` : ''}
      ${s.journal ? `<div style="white-space:pre-line">💭 ${esc(s.journal)}</div>` : ''}
      ${s.notes ? `<div class="small" style="white-space:pre-line;margin-top:6px">${esc(s.notes)}</div>` : ''}
    </div>`).join('');
}

// ---------- Recaps & Analysen ----------

const RECAP_FILTERS = { all: 'Alle', week: 'Wochen', month: 'Monate', own: 'Eigene Analysen' };
const recapKind = a => a.source === 'auto' ? (a.kind === 'month' ? 'month' : 'week') : 'own';
const RECAP_BADGE = { week: '🔁 Woche', month: '🔁 Monat', own: '🤖 Eigene' };

// Note aus dem Kurzfazit lesen, z. B. „Note 7/10“, „Note: 7,5 von 10“, „**7/10**“
function recapGrade(text) {
  const m = String(text).match(/Note[^0-9\n]{0,12}(\d{1,2}(?:[.,]\d)?)\s*(?:\/|von)\s*10/i) || String(text).match(/\b(\d{1,2}(?:[.,]\d)?)\s*\/\s*10\b/);
  const v = m ? parseFloat(m[1].replace(',', '.')) : NaN;
  return v >= 0 && v <= 10 ? v : null;
}

function recapPreview(text) {
  return (text.split(/\n#+\s/)[0] || '').replace(/^#+.*\n/, '').replace(/[*#]/g, '').trim();
}

function recapList() {
  const list = state.analyses
    .filter(a => (ui.recapFilter === 'all' || recapKind(a) === ui.recapFilter) && matches(ui.recapQuery, a.label, a.text, a.question))
    .sort((a, b) => (b.to || '').localeCompare(a.to || '') || b.createdAt - a.createdAt);
  if (!list.length) {
    return `<div class="card"><div class="empty">${state.analyses.length ? 'Nichts gefunden.'
      : 'Noch keine Recaps. Claude schreibt sie automatisch jeden Sonntag (Woche) und am Monatsletzten (Monat). Eigene Analysen machst du unter Auswertung.'}</div></div>`;
  }
  let lastMonth = '';
  return list.map(a => {
    const month = a.to ? `${MONTHS[parseYmd(a.to).getMonth()]} ${parseYmd(a.to).getFullYear()}` : '';
    const head = month && month !== lastMonth ? `<div class="recap-month">${month}</div>` : '';
    lastMonth = month || lastMonth;
    const grade = recapGrade(a.text);
    const preview = recapPreview(a.text);
    return `${head}<div class="card recap-item" data-action="ai-open" data-id="${a.id}">
        <div class="card-head">
          <h2>${esc(a.label)}</h2>
          ${grade !== null ? `<span class="grade" style="background:${gradeColor(grade)}">${trimNum(grade)}</span>` : ''}
        </div>
        <div class="meta">${RECAP_BADGE[recapKind(a)]}${a.question ? ' · ' + esc(a.question.slice(0, 60)) : ''}</div>
        ${preview ? `<div class="sub" style="margin-top:6px">${esc(preview.slice(0, 220))}${preview.length > 220 ? ' …' : ''}</div>` : ''}
      </div>`;
  }).join('');
}

// Ampel für die Note: rot < 5, gelb < 7, grün ab 7 (mit Zahl als Text, nie Farbe allein)
const gradeColor = g => g >= 7 ? 'var(--good)' : g >= 5 ? '#c98500' : 'var(--danger)';

function gradeChartCard() {
  const pts = state.analyses
    .filter(a => recapKind(a) === (ui.recapFilter === 'month' ? 'month' : 'week') && a.to && recapGrade(a.text) !== null)
    .sort((a, b) => a.to.localeCompare(b.to))
    .map(a => ({ date: a.to, value: recapGrade(a.text), tip: `${a.label}\nNote ${trimNum(recapGrade(a.text))}/10` }));
  if (pts.length < 2 || ui.recapFilter === 'own') return '';
  const avg = pts.reduce((s, p) => s + p.value, 0) / pts.length;
  return `<div class="card">
      <div class="card-head"><h2>Notenverlauf (${ui.recapFilter === 'month' ? 'Monate' : 'Wochen'})</h2><span class="muted small">Ø ${trimNum(avg)} · ${pts.length} Recaps</span></div>
      ${lineChart(pts, { unit: 'points', label: v => trimNum(Math.round(v * 10) / 10) })}
    </div>`;
}

function openNoteSheet(n, cat) {
  const isNew = !n;
  const v = n ? { ...n } : { id: uid(), cat: cat && cat !== 'all' ? cat : 'allgemein', title: '', body: '', pinned: false, done: false };
  openSheet(`
    <h2>${isNew ? 'Neue Notiz' : 'Notiz bearbeiten'}</h2>
    <form id="f">
      <div class="row2">
        <label class="field"><span>Kategorie</span><select name="cat">${Object.entries(NOTE_CATS).map(([k, l]) => `<option value="${k}" ${k === v.cat ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="toggle" style="margin-top:24px"><input type="checkbox" name="pinned" ${v.pinned ? 'checked' : ''}> Anpinnen</label>
      </div>
      <label class="field"><span>Titel</span><input name="title" value="${esc(v.title)}" placeholder="z. B. Anlauf 14 Schritte" required></label>
      <label class="field"><span>Text</span><textarea name="body" style="min-height:160px" placeholder="z. B. Startmarke 31,80 m, Zwischenmarke 4 Schritte vor Einstich …">${esc(v.body)}</textarea></label>
      <button class="btn primary block" type="submit">Speichern</button>
      ${isNew ? '' : `<div class="btn-row" style="margin-top:8px"><button type="button" class="btn danger" data-action="del-note" data-id="${v.id}">Löschen</button></div>`}
    </form>`, el => {
    $('#f', el).onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      put('notes', { ...v, cat: fd.get('cat'), title: fd.get('title').trim(), body: fd.get('body').trim(), pinned: fd.get('pinned') === 'on' });
      closeSheet();
      commit();
    };
  });
}

// ---------- Ansicht: Auswertung ----------

function renderStats() {
  setTop('Auswertung', ui.tab === 'stats' && innerWidth < 900 ? iconBtn('goto', ICON.back, 'data-tab="more"') : undefined);
  const weeks = ui.statWeeks;
  const t = todayStr();
  const firstWeek = addDays(weekStart(t), -(weeks - 1) * 7);
  const inRange = state.sessions.filter(s => s.date >= firstWeek && s.date <= t && s.done);
  const minutes = inRange.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  const rpes = inRange.filter(s => s.rpe).map(s => s.rpe);
  const days = daysBetween(firstWeek, t) + 1;
  let questCount = 0, sickCount = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(firstWeek, i);
    if (questDone(d)) questCount++;
    else if (isSickDay(d)) sickCount++;
  }
  const questDays = Math.max(1, days - sickCount);

  const weekList = Array.from({ length: weeks }, (_, i) => addDays(firstWeek, i * 7));
  const perWeek = weekList.map(ws => {
    const end = addDays(ws, 6);
    const ss = inRange.filter(s => s.date >= ws && s.date <= end);
    const row = { ws, total: 0, load: 0, count: ss.length };
    for (const k of Object.keys(CATS)) row[k] = ss.filter(s => s.cat === k).reduce((a, s) => a + (Number(s.duration) || 0), 0);
    row.total = Object.keys(CATS).reduce((a, k) => a + row[k], 0);
    row.load = ss.reduce((a, s) => a + (Number(s.duration) || 0) * (s.rpe || 0), 0);
    return row;
  });

  const rangeSeg = `<div class="segmented" style="max-width:420px">${[4, 12, 26, 52].map(w => `<button class="${weeks === w ? 'active' : ''}" data-action="stat-weeks" data-w="${w}">${w} Wochen</button>`).join('')}</div>`;

  const kpis = `<div class="kpis grid-4">
      <div class="kpi"><div class="v">${inRange.length}</div><div class="l">Einheiten erledigt</div><div class="s">Ø ${trimNum(inRange.length / weeks)} pro Woche</div></div>
      <div class="kpi"><div class="v">${fmtMinutes(minutes)}</div><div class="l">Trainingszeit</div><div class="s">Ø ${fmtMinutes(minutes / weeks)} pro Woche</div></div>
      <div class="kpi"><div class="v">${rpes.length ? trimNum(rpes.reduce((a, b) => a + b, 0) / rpes.length) : '–'}</div><div class="l">Ø Anstrengung (RPE)</div><div class="s">${rpes.length} Einheiten bewertet</div></div>
      <div class="kpi"><div class="v">${Math.round(questCount / questDays * 100)} %</div><div class="l">Daily Quests geschafft</div><div class="s">${questCount} von ${questDays} Tagen${sickCount ? ` · 🤒 ${sickCount} krank` : ''}</div></div>
    </div>`;

  const catTotals = Object.entries(CATS).map(([k, c]) => {
    const ss = inRange.filter(s => s.cat === k);
    return { k, c, count: ss.length, min: ss.reduce((a, s) => a + (Number(s.duration) || 0), 0) };
  });
  const maxMin = Math.max(1, ...catTotals.map(x => x.min));
  const dist = catTotals.map(x => `<div class="hbar" data-tip="${x.c.label}\n${x.count} Einheiten · ${fmtMinutes(x.min)}">
      <span>${x.c.label}</span>
      <div class="track"><div class="fill" style="width:${x.min / maxMin * 100}%;background:${x.c.color}"></div></div>
      <span class="num">${fmtMinutes(x.min)}</span>
    </div>`).join('');

  const strength = strengthCard();
  const pbTable = pbTableCard();

  view.innerHTML = `${aiCard()}${rangeSeg}${kpis}
    <div class="grid-2">
      <div class="card">
        <div class="card-head"><h2>Trainingszeit pro Woche</h2><span class="muted small">Minuten</span></div>
        ${stackedWeekChart(perWeek)}
        <div class="legend">${Object.values(CATS).map(c => `<span><i style="background:${c.color}"></i>${c.label}</span>`).join('')}</div>
        <details class="tbl"><summary>Als Tabelle</summary><div class="table-wrap"><table class="data">
          <tr><th>Woche ab</th>${Object.values(CATS).map(c => `<th>${c.label}</th>`).join('')}<th>Gesamt</th></tr>
          ${perWeek.map(r => `<tr><td>${fmtDateShort(r.ws)}</td>${Object.keys(CATS).map(k => `<td>${r[k]}</td>`).join('')}<td><b>${r.total}</b></td></tr>`).join('')}
        </table></div></details>
      </div>
      <div class="card">
        <div class="card-head"><h2>Belastung pro Woche</h2><span class="muted small">Minuten × RPE</span></div>
        ${loadChart(perWeek)}
        <div class="muted small" style="margin-top:8px">Hilft, Belastungsspitzen zu erkennen (z. B. vor Wettkämpfen entlasten). Nur Einheiten mit Dauer und RPE zählen.</div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Verteilung nach Kategorie</h2></div>
        ${dist}
        <div class="muted small">${catTotals.map(x => `${x.c.label}: ${x.count}×`).join(' · ')}</div>
      </div>
      ${strength}
    </div>
    ${pbTable}
    ${sessionsTableCard()}`;
}

function roundedTopRect(x, y, w, h, r) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function niceMax(v) {
  if (v <= 0) return 60;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return [1, 2, 2.5, 5, 10].map(m => m * p).find(m => m >= v);
}

function weekAxis(rows, X, bw, H) {
  const every = Math.ceil(rows.length / 6);
  return rows.map((r, i) => i % every === 0 ? `<text class="axis" x="${(X(i) + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${fmtDateShort(r.ws)}</text>` : '').join('');
}

function stackedWeekChart(rows) {
  const W = 340, H = 200, pl = 36, pr = 6, pt = 10, pb = 24;
  const max = niceMax(Math.max(...rows.map(r => r.total)));
  const slot = (W - pl - pr) / rows.length;
  const bw = Math.min(26, slot * 0.7);
  const X = i => pl + i * slot + (slot - bw) / 2;
  const Y = v => H - pb - v / max * (H - pt - pb);
  let svg = '';
  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4, y = Y(v).toFixed(1);
    svg += `<line class="${i ? 'grid' : 'base'}" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/><text class="axis" x="${pl - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${Math.round(v)}</text>`;
  }
  rows.forEach((r, i) => {
    let acc = 0;
    const segs = Object.keys(CATS).filter(k => r[k] > 0);
    segs.forEach((k, si) => {
      const y0 = Y(acc), y1 = Y(acc + r[k]);
      acc += r[k];
      // 2px Lücke zum Segment darunter
      const h = Math.max(1, y0 - y1 - (si > 0 ? 2 : 0));
      const tipText = `Woche ab ${fmtDateShort(r.ws)}\n${CATS[k].label}: ${r[k]} min\nGesamt: ${r.total} min`;
      const d = si === segs.length - 1 ? roundedTopRect(X(i), y1, bw, h, 4) : `M${X(i)},${y1}h${bw}v${h}h${-bw}Z`;
      svg += `<path d="${d}" style="fill:${CATS[k].color}" data-tip="${tipText}"/>`;
    });
    if (!segs.length) svg += `<rect class="hit" x="${X(i)}" y="${pt}" width="${bw}" height="${H - pt - pb}" data-tip="Woche ab ${fmtDateShort(r.ws)}\nKein Training eingetragen"/>`;
  });
  svg += weekAxis(rows, X, bw, H);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trainingsminuten pro Woche nach Kategorie">${svg}</svg>`;
}

function loadChart(rows) {
  const W = 340, H = 200, pl = 44, pr = 6, pt = 10, pb = 24;
  const max = niceMax(Math.max(...rows.map(r => r.load)));
  const slot = (W - pl - pr) / rows.length;
  const bw = Math.min(26, slot * 0.7);
  const X = i => pl + i * slot + (slot - bw) / 2;
  const Y = v => H - pb - v / max * (H - pt - pb);
  const avg = rows.reduce((a, r) => a + r.load, 0) / rows.length;
  let svg = '';
  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4, y = Y(v).toFixed(1);
    svg += `<line class="${i ? 'grid' : 'base'}" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/><text class="axis" x="${pl - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${Math.round(v)}</text>`;
  }
  rows.forEach((r, i) => {
    const y = Y(r.load), h = Math.max(0, H - pb - y);
    const tipText = `Woche ab ${fmtDateShort(r.ws)}\nBelastung: ${Math.round(r.load)}\n${r.count} Einheiten`;
    svg += h > 0
      ? `<path d="${roundedTopRect(X(i), y, bw, h, 4)}" style="fill:var(--text-2)" data-tip="${tipText}"/>`
      : `<rect class="hit" x="${X(i)}" y="${pt}" width="${bw}" height="${H - pt - pb}" data-tip="${tipText}"/>`;
  });
  if (avg > 0) {
    const ya = Y(avg).toFixed(1);
    svg += `<line x1="${pl}" x2="${W - pr}" y1="${ya}" y2="${ya}" style="stroke:var(--accent);stroke-width:1.5;stroke-dasharray:4 3"/>
      <text class="axis" x="${W - pr}" y="${Number(ya) - 5}" text-anchor="end" style="fill:var(--accent)">Ø ${Math.round(avg)}</text>`;
  }
  svg += weekAxis(rows, X, bw, H);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Belastung pro Woche">${svg}</svg>`;
}

// Gewichtsverlauf je Kraftübung, aus den geplanten/abgehakten Übungen der Krafteinheiten
function strengthSeries() {
  const series = {};
  for (const s of state.sessions) {
    if (s.cat !== 'kraft') continue;
    for (const e of s.exercises || []) {
      const w = parseFloat(String(e.weight).replace(',', '.'));
      if (!e.name || isNaN(w)) continue;
      const key = e.name.trim().toLowerCase();
      const ser = series[key] || (series[key] = { name: e.name.trim(), points: {} });
      if (!ser.points[s.date] || ser.points[s.date].value < w) ser.points[s.date] = { date: s.date, value: w, sets: e.sets };
    }
  }
  return Object.values(series)
    .map(x => ({ name: x.name, points: Object.values(x.points).sort((a, b) => a.date.localeCompare(b.date)) }))
    .filter(x => x.points.length >= 1)
    .sort((a, b) => b.points.length - a.points.length);
}

function strengthCard() {
  const series = strengthSeries();
  if (!series.length) {
    return `<div class="card"><div class="card-head"><h2>Kraft-Entwicklung</h2></div>
      <div class="empty">Trag bei Krafteinheiten Übungen mit Gewicht ein, dann siehst du hier den Verlauf je Übung.</div></div>`;
  }
  const sel = series.find(x => x.name === ui.statExercise) || series[0];
  return `<div class="card">
      <div class="card-head"><h2>Kraft-Entwicklung</h2>
        <select class="btn small" data-change="stat-exercise">${series.map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      </div>
      ${lineChart(sel.points.map(p => ({ date: p.date, value: p.value, tip: `${sel.name}: ${trimNum(p.value)} kg${p.sets ? ' · ' + p.sets : ''}\n${fmtDate(p.date)}` })), { unit: 'weight', color: 'var(--c-kraft)' })}
      <div class="muted small" style="margin-top:6px">Höchstes Gewicht pro Einheit · ${sel.points.length} Einträge</div>
    </div>`;
}

function pbTableCard() {
  const rows = state.disciplines.map(d => {
    const rs = resultsFor(d.id);
    if (!rs.length) return null;
    const best = bestResult(d);
    // vorherige Bestleistung = beste vor dem Datum der aktuellen
    let prev = null;
    for (const r of rs) if (r.id !== best.id && (r.date < best.date || (r.date === best.date && r.created < best.created)) && (!prev || isBetter(r.value, prev.value, d.unit))) prev = r;
    const diff = prev ? Math.abs(best.value - prev.value) : null;
    return `<tr class="click" data-action="open-pb-from-stats" data-id="${d.id}">
        <td><b>${esc(d.name)}</b></td><td>${fmtValue(best.value, d.unit)}</td><td>${fmtDate(best.date)}</td>
        <td>${prev ? fmtValue(prev.value, d.unit) : '–'}</td>
        <td>${diff ? (d.unit === 'time' ? '−' + fmtTime(diff) : '+' + fmtValue(diff, d.unit)) : '–'}</td>
        <td>${rs.length}</td>
      </tr>`;
  }).filter(Boolean);
  return `<div class="card">
      <div class="card-head"><h2>Bestleistungen im Überblick</h2></div>
      ${rows.length ? `<div class="table-wrap"><table class="data">
        <tr><th>Disziplin</th><th>PB</th><th>Datum</th><th>Vorherige PB</th><th>Verbesserung</th><th>Ergebnisse</th></tr>
        ${rows.join('')}</table></div>` : '<div class="empty">Noch keine Ergebnisse eingetragen.</div>'}
    </div>`;
}

function sessionsTableCard() {
  const list = state.sessions
    .filter(s => (ui.tableCat === 'all' || s.cat === ui.tableCat) &&
      matches(ui.tableQuery, s.topic, s.content, s.journal, s.notes, (s.exercises || []).map(e => e.name).join(' ')))
    .sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="card">
      <div class="card-head"><h2>Alle Einheiten</h2><button class="btn small" data-action="export-csv">CSV exportieren</button></div>
      <div class="chips">
        <button class="chip ${ui.tableCat === 'all' ? 'active' : ''}" data-action="table-cat" data-cat="all">Alle</button>
        ${Object.entries(CATS).map(([k, c]) => `<button class="chip ${ui.tableCat === k ? 'active' : ''}" data-action="table-cat" data-cat="${k}">${c.label}</button>`).join('')}
      </div>
      <input class="search" id="tq" type="search" placeholder="Thema, Inhalt, Journal, Übung …" value="${esc(ui.tableQuery)}">
      <div class="table-wrap"><table class="data">
        <tr><th>Datum</th><th>Kategorie</th><th>Thema</th><th>Dauer</th><th>RPE</th><th>Inhalt / Notizen</th></tr>
        ${list.slice(0, 200).map(s => `<tr class="click" data-action="edit-session" data-id="${s.id}">
          <td>${fmtDateShort(s.date)}${String(parseYmd(s.date).getFullYear()).slice(2)}</td>
          <td><span class="pill cat-pill" style="background:${CATS[s.cat].color}">${CATS[s.cat].label}</span>${s.done ? '' : ' <span class="muted small">geplant</span>'}</td>
          <td>${esc(s.topic)}</td><td>${s.duration ? s.duration + ' min' : ''}</td><td>${s.rpe || ''}</td>
          <td class="small">${esc(sessionText(s).slice(0, 140))}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="empty">Keine Einheiten gefunden.</td></tr>'}
      </table></div>
    </div>`;
}

function sessionText(s) {
  const exs = (s.exercises || []).map(e => [e.name, e.sets, e.weight && e.weight + ' kg'].filter(Boolean).join(' ')).join('; ');
  return [s.content, exs, s.journal, s.notes].filter(Boolean).join(' | ');
}

function exportCsv() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Datum', 'Kategorie', 'Thema', 'Ort', 'Dauer (min)', 'RPE', 'Erledigt', 'Inhalt', 'Übungen', 'Journal', 'Notizen']];
  for (const s of [...state.sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([s.date, CATS[s.cat].label, s.topic, LOCATIONS[s.location] || '', s.duration || '', s.rpe || '', s.done ? 'ja' : 'nein', s.content,
      (s.exercises || []).map(e => [e.name, e.sets, e.weight && e.weight + ' kg'].filter(Boolean).join(' ')).join('; '), s.journal, s.notes]);
  }
  download(`trainingstagebuch-${todayStr()}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv');
}

// ---------- KI-Analyse ----------
// Kostenlos über die Claude-App: Die App baut die Anfrage, du schickst sie an Claude
// und fügst die Antwort zum Speichern wieder ein.

const AI_RANGES = { lastMonth: 'Letzter Monat', thisMonth: 'Dieser Monat', last4w: 'Letzte 4 Wochen', custom: 'Eigener Zeitraum' };

function aiPeriod() {
  const t = todayStr();
  const d = parseYmd(t);
  if (ui.aiRange === 'thisMonth') return { from: t.slice(0, 8) + '01', to: t, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()} (bis heute)` };
  if (ui.aiRange === 'last4w') return { from: addDays(t, -27), to: t, label: 'Letzte 4 Wochen' };
  if (ui.aiRange === 'custom' && ui.aiFrom && ui.aiTo && ui.aiFrom <= ui.aiTo) {
    return { from: ui.aiFrom, to: ui.aiTo, label: `${fmtDate(ui.aiFrom)} – ${fmtDate(ui.aiTo)}` };
  }
  if (ui.aiRange === 'custom') return null;
  const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const last = new Date(d.getFullYear(), d.getMonth(), 0);
  return { from: ymd(first), to: ymd(last), label: `${MONTHS[first.getMonth()]} ${first.getFullYear()}` };
}

const AI_SYSTEM = `Du bist ein erfahrener Leichtathletik-Trainer mit Schwerpunkt Stabhochsprung und analysierst das Trainingstagebuch eines Athleten. Du sprichst ihn direkt mit „du“ an, auf Deutsch.

Deine Aufgabe: Bewerte den angegebenen Zeitraum ehrlich und konkret: Was lief gut, was fehlt, welche Muster zeigen sich? Stütze jede Aussage auf die gelieferten Daten (Einheiten, Inhalte, Journal-Einträge, Notizen, RPE, Daily Quests, Ergebnisse, Wettkämpfe) und nenne Beispiele mit Datum. Erfinde nichts. Wenn Daten fehlen oder lückenhaft sind (z. B. keine Dauer oder RPE eingetragen), sag das kurz und berücksichtige es in deiner Einschätzung. Krankheitstage (bei den Kennzahlen aufgeführt) sind bewusst markiert: Ausgefallene Einheiten an diesen Tagen und kurz danach sind keine Disziplinfrage. Bewerte stattdessen Erholung und Wiedereinstieg und berücksichtige sie bei der Note. Beachte die Notizen zu den Einheiten: Wurde an einem Krankheitstag trotzdem trainiert, aber bewusst verkürzt (z. B. „nur Treppe wegen Kopfweh“), ist das kein zu geringer Umfang, sondern vernünftiges Hören auf den Körper. Ein erhöhter RPE an solchen Tagen ist krankheitsbedingt und keine Belastungsspitze. Auch Gründe für ausgefallene Einheiten (z. B. „keine Zeit“) stehen in den Notizen und sollen einfließen. Bei Schmerzen oder Verletzungshinweisen gibst du keine Diagnose, sondern empfiehlst, das mit Physio oder Arzt abzuklären.

Gliedere deine Antwort in Markdown mit diesen Abschnitten:
## Kurzfazit
2–3 Sätze und eine Gesamtnote von 1 bis 10 für den Zeitraum, mit Begründung.
## Umfang & Struktur
Verteilung Grundlagen/Kraft/Technik, Regelmäßigkeit, Wochenrhythmus, Vergleich zum Vorzeitraum.
## Belastung & Erholung
RPE-Verlauf, Belastungsspitzen, Ruhetage, Hinweise auf Über- oder Unterforderung.
## Technik
Muster und wiederkehrende Themen aus Inhalten und Journal, Fortschritte, offene Baustellen.
## Kraft
Übungsauswahl, Gewichtsentwicklung, Regelmäßigkeit.
## Blick auf die Wettkämpfe
Passt das Training zu den anstehenden Wettkämpfen (Abstand, Periodisierung, Formaufbau)? Wenn keine anstehen, nenne, worauf der Aufbau jetzt zielen sollte.
## Empfehlungen
3 bis 5 konkrete, umsetzbare Punkte für die nächsten 2–4 Wochen.

Schreib kompakt und praxisnah, wie ein Trainer im Gespräch. Keine Floskeln.`;

function sessionLine(s, t) {
  const c = CATS[s.cat] || CATS.grundlagen;
  const status = s.done ? 'erledigt' : s.date < t ? 'NICHT erledigt (ausgefallen?)' : 'geplant';
  const head = [
    `${s.date} ${DOW[(parseYmd(s.date).getDay() + 6) % 7]}`,
    c.label + (s.cat === 'kraft' && s.location ? ` (${LOCATIONS[s.location]})` : ''),
    s.topic ? `„${s.topic}“` : '',
    s.duration ? s.duration + ' min' : 'Dauer ?',
    s.rpe ? 'RPE ' + s.rpe : 'RPE ?',
    status
  ].filter(Boolean).join(' · ');
  const lines = [`- ${head}`];
  if (s.content) lines.push(`  Inhalt: ${s.content.replace(/\n/g, ' / ')}`);
  if ((s.exercises || []).length) {
    lines.push('  Übungen: ' + s.exercises.map(e => [e.name, e.sets, e.weight && e.weight + ' kg', e.done ? '✓' : '✗'].filter(Boolean).join(' ')).join('; '));
  }
  if (s.journal) lines.push(`  Journal: ${s.journal.replace(/\n/g, ' / ')}`);
  if (s.notes) lines.push(`  Notizen: ${s.notes.replace(/\n/g, ' / ')}`);
  return lines.join('\n');
}

function periodStats(from, to) {
  const ss = state.sessions.filter(s => s.date >= from && s.date <= to && s.done);
  const perCat = Object.entries(CATS).map(([k, c]) => {
    const x = ss.filter(s => s.cat === k);
    return `${c.label} ${x.length}× / ${x.reduce((a, s) => a + (Number(s.duration) || 0), 0)} min`;
  }).join(', ');
  const rpes = ss.filter(s => s.rpe).map(s => s.rpe);
  const days = daysBetween(from, to) + 1;
  let quests = 0;
  const sick = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    if (questDone(d)) quests++;
    else if (isSickDay(d)) sick.push(d);
  }
  return `${ss.length} erledigte Einheiten (${perCat}); Ø RPE ${rpes.length ? trimNum(rpes.reduce((a, b) => a + b, 0) / rpes.length) : '–'}; Daily Quests ${quests}/${days - sick.length} Tage; Krankheitstage: ${sick.length ? sick.join(', ') : 'keine'}`;
}

function buildAiPrompt(p, question) {
  const t = todayStr();
  const len = daysBetween(p.from, p.to) + 1;
  const prevTo = addDays(p.from, -1), prevFrom = addDays(p.from, -len);
  const sessions = state.sessions.filter(s => s.date >= p.from && s.date <= p.to).sort((a, b) => a.date.localeCompare(b.date));

  const weeks = [];
  for (let ws = weekStart(p.from); ws <= p.to; ws = addDays(ws, 7)) {
    const we = addDays(ws, 6);
    const ss = sessions.filter(s => s.date >= ws && s.date <= we && s.done);
    const min = ss.reduce((a, s) => a + (Number(s.duration) || 0), 0);
    const load = ss.reduce((a, s) => a + (Number(s.duration) || 0) * (s.rpe || 0), 0);
    weeks.push(`- Woche ab ${ws}: ${ss.length} Einheiten, ${min} min, Belastung (min×RPE) ${load}`);
  }

  const resultsIn = state.results.filter(r => r.date >= p.from && r.date <= p.to)
    .map(r => { const d = discipline(r.disciplineId); return d ? `- ${r.date} ${d.name}: ${fmtValue(r.value, d.unit)}${r.note ? ' (' + r.note + ')' : ''}` : ''; })
    .filter(Boolean);
  const pbs = state.disciplines.map(d => { const b = bestResult(d); return b ? `- ${d.name}: ${fmtValue(b.value, d.unit)} (${b.date})` : ''; }).filter(Boolean);
  const compsIn = state.competitions.filter(c => c.date >= p.from && c.date <= p.to)
    .map(c => `- ${c.date} ${c.name}${c.location ? ', ' + c.location : ''}${c.goals ? ' | Ziele: ' + c.goals.replace(/\n/g, ' / ') : ''}${c.results ? ' | Ergebnis: ' + c.results.replace(/\n/g, ' / ') : ''}`);
  const compsNext = state.competitions.filter(c => c.date > p.to && c.date >= t && daysBetween(t, c.date) <= 180)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(c => `- ${c.date} (in ${daysBetween(t, c.date)} Tagen) ${c.name}${c.goals ? ' | Ziele: ' + c.goals.replace(/\n/g, ' / ') : ''}`);
  const notes = state.notes.filter(n => !n.done)
    .map(n => `- [${NOTE_CATS[n.cat] || n.cat}] ${n.title}${n.body ? ': ' + n.body.replace(/\n/g, ' / ') : ''}`);
  const tpl = WEEK_ORDER.filter(wd => state.settings.weekTemplate[wd])
    .map(wd => { const x = state.settings.weekTemplate[wd]; return `${DOW_LONG[wd]}: ${CATS[x.cat].label}${x.topic ? ' (' + x.topic + ')' : ''}`; }).join('; ');

  return `# Trainingstagebuch: Analyse für ${p.label}
Zeitraum: ${p.from} bis ${p.to} (${len} Tage). Heute ist ${t}.

## Athlet
Leichtathlet beim asc darmstadt, Hauptdisziplin Stabhochsprung. Trainiert normalerweise Mo–Fr, manchmal Sa. Kategorien: Grundlagen (Lauf, Athletik, allgemein), Kraft, Technik (meist Stabhochsprung).
Feste Wochenvorlage: ${tpl || 'keine'}.

## Kennzahlen
Dieser Zeitraum: ${periodStats(p.from, p.to)}
Vorzeitraum (${prevFrom} bis ${prevTo}): ${periodStats(prevFrom, prevTo)}

## Wochenübersicht
${weeks.join('\n') || '- keine Daten'}

## Alle Einheiten im Zeitraum (${sessions.length})
${sessions.map(s => sessionLine(s, t)).join('\n') || '- keine Einheiten eingetragen'}

## Ergebnisse im Zeitraum
${resultsIn.join('\n') || '- keine'}

## Aktuelle Bestleistungen
${pbs.join('\n') || '- keine eingetragen'}

## Wettkämpfe im Zeitraum
${compsIn.join('\n') || '- keine'}

## Anstehende Wettkämpfe (nächste 6 Monate)
${compsNext.join('\n') || '- keine eingetragen'}

## Offene Notizen & ToDos des Athleten
${notes.join('\n') || '- keine'}
${question ? `\n## Frage des Athleten\n${question}\n` : ''}`;
}

// Kleiner Markdown-Renderer für die Antwort (Überschriften, Listen, fett, kursiv)
function md(src) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  let html = '', list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of src.split('\n')) {
    const line = raw.trimEnd();
    let m;
    if ((m = line.match(/^#{1,2}\s+(.*)/))) { close(); html += `<h3>${inline(m[1])}</h3>`; }
    else if ((m = line.match(/^#{3,6}\s+(.*)/))) { close(); html += `<h4>${inline(m[1])}</h4>`; }
    else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
    else if (!line.trim()) close();
    else { close(); html += `<p>${inline(line)}</p>`; }
  }
  close();
  return html;
}

function aiCard() {
  const p = aiPeriod();
  const count = p ? state.sessions.filter(s => s.date >= p.from && s.date <= p.to).length : 0;
  const saved = [...state.analyses].sort((a, b) => b.createdAt - a.createdAt);
  return `<div class="card ai-card">
      <div class="card-head"><h2>🤖 KI-Analyse mit Claude</h2></div>
      <p class="small muted" style="margin-top:0">Claude liest alle Einheiten, Journal-Einträge, Notizen, Ergebnisse und Wettkämpfe des Zeitraums und gibt dir eine Einschätzung wie ein Trainer. Läuft kostenlos über deine Claude-App.</p>
      <div class="chips">${Object.entries(AI_RANGES).map(([k, l]) => `<button class="chip ${ui.aiRange === k ? 'active' : ''}" data-action="ai-range" data-r="${k}">${l}</button>`).join('')}</div>
      ${ui.aiRange === 'custom' ? `<div class="row2">
          <label class="field"><span>Von</span><input type="date" id="aiFrom" value="${ui.aiFrom}"></label>
          <label class="field"><span>Bis</span><input type="date" id="aiTo" value="${ui.aiTo}"></label>
        </div>` : ''}
      <label class="field"><span>Worauf soll Claude besonders achten? (optional)</span>
        <textarea id="aiQuestion" style="min-height:60px" placeholder="z. B. Bin ich gut auf die Hallensaison vorbereitet? Trainiere ich genug Technik?">${esc(ui.aiQuestion)}</textarea></label>
      <div class="muted small" style="margin-bottom:10px">${p ? `${p.label}: ${count} Einheit(en)` : 'Bitte Zeitraum wählen'}</div>
      <div class="btn-row">
        <button class="btn primary" data-action="ai-send" ${!p || !count ? 'disabled' : ''}>1. In Claude analysieren</button>
        <button class="btn" data-action="ai-paste" ${!p ? 'disabled' : ''}>2. Antwort speichern</button>
      </div>
      ${saved.length ? `<div style="margin-top:14px">
        <div class="card-head" style="margin-bottom:4px"><span class="muted small">Zuletzt</span><a href="#" class="small" data-action="all-recaps">Alle Recaps →</a></div>
        ${saved.slice(0, 3).map(a => `<div class="list-item" data-action="ai-open" data-id="${a.id}">
            <div class="grow"><div class="title">${a.source === 'auto' ? '🔁 ' : ''}${esc(a.label)}</div>
            <div class="meta">${new Date(a.createdAt).toLocaleDateString('de-DE')}${a.question ? ' · ' + esc(a.question.slice(0, 60)) : ''}</div></div>
          </div>`).join('')}
      </div>` : ''}
    </div>`;
}

function aiSheetHtml(title, sub, body, id) {
  return `<h2>${esc(title)}</h2>
    <div class="muted small" style="margin:-8px 0 12px">${sub}</div>
    <div class="md" id="aiOut">${body}</div>
    ${id ? `<div class="btn-row" style="margin-top:16px">
      <button type="button" class="btn" data-action="ai-copy-result" data-id="${id}">Text kopieren</button>
      <button type="button" class="btn danger" data-action="ai-delete" data-id="${id}">Löschen</button>
    </div>` : ''}`;
}

const aiFullPrompt = p => `${AI_SYSTEM}\n\n---\n\n${buildAiPrompt(p, ui.aiQuestion.trim())}`;

// Schritt 1: Anfrage an die Claude-App teilen (Handy) bzw. kopieren und claude.ai öffnen (Laptop)
async function sendAiPrompt() {
  const p = aiPeriod();
  if (!p) return;
  const full = aiFullPrompt(p);
  const canShare = !!navigator.share && innerWidth < 900;
  let copied = false;
  try { await navigator.clipboard.writeText(full); copied = true; } catch (e) { /* z. B. ohne Berechtigung */ }

  openSheet(`<h2>Analyse: ${esc(p.label)}</h2>
    ${copied ? '<p>📋 Die Anfrage mit allen Trainingsdaten ist <b>kopiert</b>.</p>' : `<p class="small muted">Automatisches Kopieren ging nicht. Text markieren und kopieren:</p>
      <textarea style="width:100%;min-height:200px" readonly>${esc(full)}</textarea>`}
    <ol class="steps">
      <li>In Claude einen <b>neuen Chat</b> starten, einfügen und abschicken.</li>
      <li>Claudes Antwort kopieren (unter der Antwort auf das Kopier-Symbol tippen).</li>
      <li>Hier mit <b>„2. Antwort speichern“</b> einfügen, dann ist sie in der App gespeichert und auf allen Geräten.</li>
    </ol>
    <div class="btn-row">
      ${canShare ? '<button type="button" class="btn primary" data-action="ai-share">An Claude-App teilen</button>' : ''}
      <a class="btn ${canShare ? '' : 'primary'}" href="https://claude.ai/new" target="_blank" rel="noopener">claude.ai öffnen</a>
    </div>`);
}

async function shareAiPrompt() {
  const p = aiPeriod();
  if (!p) return;
  try {
    await navigator.share({ title: `Trainingsanalyse ${p.label}`, text: aiFullPrompt(p) });
  } catch (e) { /* abgebrochen */ }
}

// Schritt 2: Claudes Antwort einfügen und als Analyse speichern
function openAiPasteSheet() {
  const p = aiPeriod();
  if (!p) return;
  openSheet(`<h2>Antwort speichern</h2>
    <div class="muted small" style="margin:-8px 0 12px">Zeitraum: ${esc(p.label)}</div>
    <form id="f">
      <label class="field"><span>Claudes Antwort</span>
        <textarea name="text" style="min-height:260px" placeholder="Hier die kopierte Antwort von Claude einfügen …" required></textarea></label>
      <button type="button" class="btn block" id="pasteBtn" style="margin-bottom:8px">Aus Zwischenablage einfügen</button>
      <button class="btn primary block" type="submit">Speichern</button>
    </form>`, el => {
    const ta = $('[name=text]', el);
    $('#pasteBtn', el).onclick = async () => {
      try { ta.value = await navigator.clipboard.readText(); } catch (e) { toast('Bitte lange ins Feld tippen und „Einfügen“ wählen'); }
    };
    $('#f', el).onsubmit = e => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      const analysis = { id: uid(), from: p.from, to: p.to, label: p.label, question: ui.aiQuestion.trim(), text, createdAt: Date.now() };
      put('analyses', analysis);
      commit();
      openSheet(aiSheetHtml(`Analyse: ${p.label}`, `${new Date(analysis.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} · gespeichert`, md(text), analysis.id));
    };
  });
}

// ---------- Ansicht: Mehr ----------

function renderMore() {
  setTop('Mehr');
  const tpl = state.settings.weekTemplate;
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }));
  const statusText = !syncConfigured() ? 'Nicht eingerichtet'
    : syncStatus === 'error' ? '⚠️ ' + syncError
    : syncStatus === 'offline' ? 'Offline, wird nachgeholt'
    : syncCfg.lastSync ? 'Zuletzt: ' + new Date(syncCfg.lastSync).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : 'Noch nie';

  view.innerHTML = `
    <button class="btn block mobile-only" style="margin-bottom:14px" data-action="goto" data-tab="stats">📊 Auswertung & 🤖 KI-Analyse öffnen</button>
    <div class="grid-2">
      <div>
        <div class="card">
          <div class="card-head"><h2>Sync Handy ↔ Laptop</h2><span class="pill">${esc(statusText)}</span></div>
          ${syncConfigured() ? `
            <p class="small muted" style="margin-top:0">Verbunden mit <b>${esc(syncCfg.owner)}/${esc(syncCfg.repo)}</b>. Änderungen werden automatisch abgeglichen.</p>
            <div class="btn-row">
              <button class="btn primary" data-action="sync-now">Jetzt synchronisieren</button>
              <button class="btn" data-action="sync-setup">Ändern</button>
            </div>` : `
            <p class="small muted" style="margin-top:0">Gleicht deine Daten über ein <b>privates</b> GitHub-Repo zwischen Handy und Laptop ab. Nur du hast Zugriff.</p>
            <button class="btn primary block" data-action="sync-setup">Sync einrichten</button>`}
        </div>

        <div class="card">
          <div class="card-head"><h2>Daily-Quest-Pool</h2><button class="btn small" data-action="add-quest">+ Übung</button></div>
          <p class="small muted" style="margin-top:0">Jeden Tag wird eine dieser Übungen zufällig als Quest gezogen.</p>
          ${state.quests.map(q => `<div class="list-item" data-action="edit-quest" data-id="${q.id}">
              <div class="grow"><div class="title">${isSickQuest(q) ? '🤒 ' : ''}${esc(q.name)}</div>${isSickQuest(q) ? '<div class="sub">Markiert Krankheitstage, wird nie zufällig gezogen</div>' : q.target ? `<div class="sub">${esc(q.target)}</div>` : ''}</div>
            </div>`).join('') || '<div class="empty">Keine Übungen.</div>'}
        </div>
      </div>
      <div>
        <div class="card">
          <div class="card-head"><h2>Wochenvorlage</h2></div>
          <p class="small muted" style="margin-top:0">Im Kalender mit „Wochenvorlage einfügen“ übernehmen.</p>
          ${WEEK_ORDER.map(wd => {
            const x = tpl[wd];
            return `<div class="list-item" data-action="edit-template" data-wd="${wd}">
                <span class="type-bar" style="background:${x ? CATS[x.cat].color : 'var(--surface-2)'}"></span>
                <div class="grow"><div class="title">${DOW_LONG[wd]}</div>
                <div class="sub">${x ? esc([CATS[x.cat].label, x.topic, x.cat === 'kraft' ? LOCATIONS[x.location] : ''].filter(Boolean).join(' · ')) : 'frei planen'}</div></div>
              </div>`;
          }).join('')}
        </div>

        <div class="card">
          <div class="card-head"><h2>Backup</h2></div>
          <p class="small muted" style="margin-top:0">Zusätzliche Sicherung als Datei. Beim Einspielen werden die Daten zusammengeführt, nicht ersetzt.</p>
          <p class="small">Letztes Backup: <b>${state.lastBackup ? fmtDate(state.lastBackup) : 'noch nie'}</b></p>
          <div class="btn-row">
            <button class="btn" data-action="export-download">Herunterladen</button>
            ${canShare ? '<button class="btn" data-action="export-share">Teilen …</button>' : ''}
            <button class="btn" data-action="import">Einspielen</button>
          </div>
          <input type="file" id="importFile" accept="application/json,.json" hidden>
        </div>

        <div class="card">
          <div class="card-head"><h2>Daten</h2></div>
          <button class="btn danger block" data-action="reset">Alle Einträge löschen</button>
        </div>
      </div>
    </div>
    <p class="muted small" style="text-align:center">Trainingstagebuch · asc darmstadt</p>`;

  $('#importFile').onchange = e => importBackup(e.target.files[0]);
}

function openSyncSheet() {
  openSheet(`
    <h2>Sync einrichten</h2>
    <ol class="steps">
      <li>Auf github.com ein <b>privates</b> Repo anlegen, z. B. <code>trainingstagebuch-daten</code>.</li>
      <li>Unter <i>Settings → Developer settings → Fine-grained tokens</i> einen Token erstellen: nur dieses Repo, Berechtigung <b>Contents: Read and write</b>.</li>
      <li>Hier eintragen, auf Handy <b>und</b> Laptop.</li>
    </ol>
    <form id="f">
      <div class="row2">
        <label class="field"><span>GitHub-Benutzername</span><input name="owner" value="${esc(syncCfg.owner)}" autocapitalize="off" autocomplete="off" required></label>
        <label class="field"><span>Repo-Name</span><input name="repo" value="${esc(syncCfg.repo || 'trainingstagebuch-daten')}" autocapitalize="off" autocomplete="off" required></label>
      </div>
      <label class="field"><span>Token</span><input name="token" type="password" value="${esc(syncCfg.token)}" autocomplete="off" placeholder="github_pat_…" required></label>
      <div class="hint">Der Token bleibt nur auf diesem Gerät gespeichert und wird nicht mit synchronisiert.</div>
      <button class="btn primary block" type="submit">Verbinden & synchronisieren</button>
      ${syncConfigured() ? '<div class="btn-row" style="margin-top:8px"><button type="button" class="btn danger" data-action="sync-disconnect">Sync trennen</button></div>' : ''}
    </form>`, el => {
    $('#f', el).onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      syncCfg = { owner: fd.get('owner').trim(), repo: fd.get('repo').trim(), token: fd.get('token').trim() };
      const btn = $('[type=submit]', el);
      btn.disabled = true;
      btn.textContent = 'Prüfe Verbindung …';
      try {
        const repo = await testSyncConnection();
        if (!repo.private && !confirm('Achtung: Dieses Repo ist ÖFFENTLICH, dann könnte jeder deine Daten sehen. Trotzdem verwenden?')) {
          btn.disabled = false;
          btn.textContent = 'Verbinden & synchronisieren';
          return;
        }
        saveSyncCfg();
        closeSheet();
        await runSync(true);
        render();
      } catch (err) {
        toast('Verbindung fehlgeschlagen: ' + (err.message || 'Netzwerkfehler'));
        btn.disabled = false;
        btn.textContent = 'Verbinden & synchronisieren';
      }
    };
  });
}

function openQuestSheet(q) {
  const isNew = !q;
  const v = q ? { ...q } : { id: uid(), name: '', target: '' };
  openSheet(`
    <h2>${isNew ? 'Neue Quest-Übung' : 'Quest-Übung bearbeiten'}</h2>
    <form id="f">
      <label class="field"><span>Übung</span><input name="name" value="${esc(v.name)}" placeholder="z. B. Liegestütz" required></label>
      <label class="field"><span>Umfang / Details</span><input name="target" value="${esc(v.target)}" placeholder="z. B. 3 × 20"></label>
      <button class="btn primary block" type="submit">Speichern</button>
      ${isNew ? '' : `<div class="btn-row" style="margin-top:8px"><button type="button" class="btn danger" data-action="del-quest" data-id="${v.id}">Löschen</button></div>`}
    </form>`, el => {
    $('#f', el).onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      put('quests', { ...v, name: fd.get('name').trim(), target: fd.get('target').trim() });
      closeSheet();
      commit();
    };
  });
}

function openTemplateSheet(wd) {
  const x = state.settings.weekTemplate[wd] || { cat: '', topic: '', location: 'zuhause' };
  openSheet(`
    <h2>Vorlage: ${DOW_LONG[wd]}</h2>
    <form id="f">
      <label class="field"><span>Kategorie</span><select name="cat">
        <option value="">– frei planen –</option>
        ${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${k === x.cat ? 'selected' : ''}>${c.label}</option>`).join('')}
      </select></label>
      <label class="field"><span>Thema</span><input name="topic" value="${esc(x.topic)}" placeholder="z. B. Kraftraum"></label>
      <label class="field"><span>Ort (nur bei Kraft)</span><select name="location">${Object.entries(LOCATIONS).map(([k, l]) => `<option value="${k}" ${k === x.location ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="btn primary block" type="submit">Speichern</button>
    </form>`, el => {
    $('#f', el).onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const tpl = { ...state.settings.weekTemplate };
      if (fd.get('cat')) tpl[wd] = { cat: fd.get('cat'), topic: fd.get('topic').trim(), location: fd.get('location') };
      else delete tpl[wd];
      state.settings = { ...state.settings, weekTemplate: tpl, updatedAt: Date.now() };
      closeSheet();
      commit();
    };
  });
}

function backupFile() {
  return new File([JSON.stringify(state, null, 2)], `trainingstagebuch-backup-${todayStr()}.json`, { type: 'application/json' });
}

function markBackup() {
  state.lastBackup = todayStr();
  commit();
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.sessions) || !Array.isArray(data.disciplines)) throw new Error('format');
      if (!confirm('Backup einspielen? Es wird mit den vorhandenen Daten zusammengeführt.')) return;
      state = mergeStates(state, data);
      commit();
      toast('Backup eingespielt');
    } catch (e) {
      toast('Das ist keine gültige Backup-Datei');
    }
  };
  reader.readAsText(file);
}

// ---------- Aktionen ----------

const findIn = (coll, id) => state[coll].find(x => x.id === id);

const actions = {
  'goto': ds => { ui.tab = ds.tab; ui.pbDetail = null; render(); scrollTo(0, 0); },

  'add-session': ds => openSessionSheet(null, ds.date || ui.selDate),
  'edit-session': ds => openSessionSheet(findIn('sessions', ds.id)),
  'toggle-session': ds => {
    const s = findIn('sessions', ds.id);
    put('sessions', { ...s, done: !s.done });
    commit();
  },
  'dup-session': ds => {
    const s = findIn('sessions', ds.id);
    openSessionSheet({ ...s, id: uid(), date: addDays(s.date, 7), done: false, rpe: null,
      exercises: (s.exercises || []).map(e => ({ ...e, id: uid(), done: false })) }, null, true);
    toast('Kopie: Datum anpassen und speichern');
  },
  'del-session': ds => {
    if (!confirm('Einheit löschen?')) return;
    remove('sessions', ds.id);
    closeSheet();
    commit();
  },
  'apply-template-day': ds => {
    const s = templateSession(ds.date);
    if (s) { put('sessions', s); commit(); openSessionSheet(s); }
  },
  'apply-template-week': ds => applyTemplateWeek(ds.date),

  'toggle-quest': ds => {
    const done = !questDone(ds.date);
    setQuestLog(ds.date, { done });
    commit();
    if (done) toast(`🔥 Quest geschafft! Streak: ${questStreak()}`);
  },
  'sick-quest': ds => {
    const sq = state.quests.find(isSickQuest);
    setQuestLog(ds.date, { ...(sq ? { questId: sq.id } : {}), sick: true, done: false });
    commit();
    toast('🤒 Gute Besserung! Dein Streak pausiert.');
  },
  'unsick-quest': ds => {
    const q = autoQuest(ds.date);
    setQuestLog(ds.date, { questId: q && q.id, sick: false, done: false });
    commit();
  },
  'reroll-quest': ds => {
    const cur = questFor(ds.date);
    const others = state.quests.filter(q => q.id !== (cur && cur.id) && !isSickQuest(q));
    setQuestLog(ds.date, { questId: others[Math.floor(Math.random() * others.length)].id, done: false });
    commit();
  },

  'select-day': ds => {
    ui.selDate = ds.date;
    ui.calMonth = ds.date.slice(0, 8) + '01';
    render();
  },
  'cal-prev': () => { const d = parseYmd(ui.calMonth); d.setMonth(d.getMonth() - 1); ui.calMonth = ymd(d); render(); },
  'cal-next': () => { const d = parseYmd(ui.calMonth); d.setMonth(d.getMonth() + 1); ui.calMonth = ymd(d); render(); },
  'cal-today': () => { ui.selDate = todayStr(); ui.calMonth = ui.selDate.slice(0, 8) + '01'; render(); },

  'perf-view': ds => { ui.perfView = ds.v; ui.pbDetail = null; render(); },
  'pb-cat': ds => { ui.pbCat = ds.cat; render(); },
  'open-pb': ds => {
    ui.pbDetail = ds.id;
    history.pushState({ detail: true }, '');
    render();
    scrollTo(0, 0);
  },
  'open-pb-from-stats': ds => { ui.tab = 'perf'; ui.perfView = 'pbs'; actions['open-pb'](ds); },
  'pb-back': () => {
    if (history.state && history.state.detail) history.back();
    else { ui.pbDetail = null; render(); }
  },
  'add-discipline': () => openDisciplineSheet(null),
  'edit-discipline': ds => openDisciplineSheet(discipline(ds.id)),
  'del-discipline': ds => {
    const rs = state.results.filter(r => r.disciplineId === ds.id);
    if (!confirm(rs.length ? `Disziplin und ${rs.length} Ergebnis(se) löschen?` : 'Disziplin löschen?')) return;
    remove('disciplines', ds.id);
    rs.forEach(r => remove('results', r.id));
    closeSheet();
    if (ui.pbDetail === ds.id) actions['pb-back']();
    commit();
  },
  'add-result': ds => openResultSheet(null, ds.id),
  'edit-result': ds => openResultSheet(findIn('results', ds.id)),
  'del-result': ds => {
    if (!confirm('Ergebnis löschen?')) return;
    remove('results', ds.id);
    closeSheet();
    commit();
  },

  'add-comp': () => openCompSheet(null),
  'edit-comp': ds => openCompSheet(findIn('competitions', ds.id)),
  'del-comp': ds => {
    if (!confirm('Wettkampf löschen?')) return;
    remove('competitions', ds.id);
    closeSheet();
    commit();
  },

  'notes-view': ds => { ui.notesView = ds.v; render(); },
  'note-cat': ds => { ui.noteCat = ds.cat; render(); },
  'recap-filter': ds => { ui.recapFilter = ds.f; render(); },
  'all-recaps': () => { ui.tab = 'notes'; ui.notesView = 'recaps'; render(); scrollTo(0, 0); },
  'add-note': () => openNoteSheet(null, ui.noteCat),
  'edit-note': ds => openNoteSheet(findIn('notes', ds.id)),
  'toggle-note': ds => {
    const n = findIn('notes', ds.id);
    put('notes', { ...n, done: !n.done });
    commit();
  },
  'del-note': ds => {
    if (!confirm('Notiz löschen?')) return;
    remove('notes', ds.id);
    closeSheet();
    commit();
  },

  'stat-weeks': ds => { ui.statWeeks = Number(ds.w); render(); },
  'ai-range': ds => { ui.aiRange = ds.r; render(); },
  'ai-send': () => sendAiPrompt(),
  'ai-share': () => shareAiPrompt(),
  'ai-paste': () => openAiPasteSheet(),
  'ai-open': ds => {
    const a = findIn('analyses', ds.id);
    markRecapSeen(a.id);
    if (ui.tab === 'today') render();
    openSheet(aiSheetHtml(`Analyse: ${a.label}`, `${new Date(a.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}${a.question ? ' · Frage: ' + esc(a.question) : ''}`, md(a.text), a.id));
  },
  'ai-copy-result': async ds => {
    try { await navigator.clipboard.writeText(findIn('analyses', ds.id).text); toast('Text kopiert'); } catch (e) { toast('Kopieren nicht möglich'); }
  },
  'ai-delete': ds => {
    if (!confirm('Analyse löschen?')) return;
    remove('analyses', ds.id);
    closeSheet();
    commit();
  },
  'table-cat': ds => { ui.tableCat = ds.cat; render(); },
  'export-csv': () => exportCsv(),

  'sync-setup': () => openSyncSheet(),
  'sync-now': () => runSync(true),
  'sync-disconnect': () => {
    if (!confirm('Sync auf diesem Gerät trennen? Die Daten bleiben hier und im Repo erhalten.')) return;
    syncCfg = {};
    saveSyncCfg();
    syncStatus = 'off';
    updateSyncDot();
    closeSheet();
    render();
  },

  'add-quest': () => openQuestSheet(null),
  'edit-quest': ds => openQuestSheet(quest(ds.id)),
  'del-quest': ds => {
    if (!confirm('Übung aus dem Quest-Pool löschen?')) return;
    remove('quests', ds.id);
    closeSheet();
    commit();
  },
  'edit-template': ds => openTemplateSheet(Number(ds.wd)),

  'export-download': () => {
    const file = backupFile();
    download(file.name, file, 'application/json');
    markBackup();
    toast('Backup gespeichert (Downloads)');
  },
  'export-share': async () => {
    try {
      await navigator.share({ files: [backupFile()], title: 'Trainingstagebuch Backup' });
      markBackup();
    } catch (e) { /* abgebrochen */ }
  },
  'import': () => $('#importFile').click(),
  'reset': () => {
    if (!confirm('Wirklich ALLE Einheiten, Ergebnisse, Wettkämpfe und Notizen löschen? Bei aktivem Sync auch auf den anderen Geräten.')) return;
    if (!confirm('Ganz sicher? Mach vorher besser ein Backup.')) return;
    for (const c of ['sessions', 'results', 'competitions', 'notes']) [...state[c]].forEach(x => remove(c, x.id));
    for (const d of Object.keys(state.questLog)) state.questLog[d] = { ...state.questLog[d], done: false, updatedAt: Date.now() };
    commit();
    toast('Alle Einträge gelöscht');
  }
};

document.addEventListener('click', e => {
  const tab = e.target.closest('.tabbar button');
  if (tab) {
    ui.tab = tab.dataset.tab;
    ui.pbDetail = null;
    render();
    scrollTo(0, 0);
    return;
  }
  if (e.target.closest('#syncDot')) return runSync(true);
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) {
    if (el.tagName === 'A') e.preventDefault();
    fn(el.dataset, el);
  }
});

document.addEventListener('change', e => {
  if (e.target.dataset.change === 'stat-exercise') { ui.statExercise = e.target.value; render(); }
});

// Felder der KI-Analyse: nur merken, nicht neu zeichnen (Fokus bleibt)
document.addEventListener('input', e => {
  if (e.target.id === 'aiQuestion') ui.aiQuestion = e.target.value;
});
document.addEventListener('change', e => {
  if (e.target.id === 'aiFrom' || e.target.id === 'aiTo') {
    ui[e.target.id] = e.target.value;
    render();
  }
});

// Suchfeld der Einheiten-Tabelle: nur die Tabelle neu zeichnen, damit der Fokus bleibt
document.addEventListener('input', e => {
  if (e.target.id !== 'tq') return;
  ui.tableQuery = e.target.value;
  const pos = e.target.selectionStart;
  render();
  const inp = $('#tq');
  inp.focus();
  inp.setSelectionRange(pos, pos);
});

// ---------- Start ----------

function render() {
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.tab));
  ({ today: renderToday, calendar: renderCalendar, stats: renderStats, perf: renderPerf, notes: renderNotes, more: renderMore })[ui.tab]();
  updateSyncDot();
}

// Beim Zurückkehren in die App: neu zeichnen (Mitternacht) und Änderungen vom anderen Gerät holen
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (!sheetOpen) render();
  runSync(false);
});
window.addEventListener('online', () => runSync(false));

// Beim Wechsel zwischen Handy- und Laptop-Breite neu zeichnen
let wasWide = innerWidth >= 900;
window.addEventListener('resize', () => {
  const wide = innerWidth >= 900;
  if (wide !== wasWide && !sheetOpen) render();
  wasWide = wide;
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// Bittet den Browser, die Daten nicht automatisch zu löschen
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

render();
runSync(false);
