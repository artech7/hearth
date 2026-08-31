"use strict";

const root = document.getElementById("root");
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const COLORS = ["ochre", "clay", "sage", "slate", "plum"];

const S = {
  view: "loading",
  profiles: [],
  pick: null,
  pin: "",
  err: "",
  state: null,
  tab: 0,
  focus: null,
  fetchedAt: 0,
  form: null,
  entering: false,
  lastKey: "",
  bump: false,
  justDone: [],
  month: null,
  monthData: null,
  selecting: false,
  picking: false,
  sel: [],
  toast: "",
  taskKind: "study",
  day: null,        // null means today
  dayData: null,    // fetched view for a non-current day
};

/* ---------- theme ---------- */

const THEMES = ["system", "light", "dark"];

function currentTheme() {
  try {
    const saved = localStorage.getItem("hearth-theme");
    return THEMES.includes(saved) ? saved : "system";
  } catch (err) {
    return "system";
  }
}

// Old browsers and some webviews have no matchMedia; theming must not take
// the whole app down with it.
function darkMedia() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
}

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  const mq = darkMedia();
  const dark = mode === "dark" || (mode === "system" && !!mq && mq.matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#262B27" : "#DDE3DD");
}

function cycleTheme() {
  const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
  try { localStorage.setItem("hearth-theme", next); } catch (err) { /* private mode */ }
  applyTheme(next);
  return next;
}

applyTheme(currentTheme());
const themeMedia = darkMedia();
if (themeMedia && themeMedia.addEventListener) {
  themeMedia.addEventListener("change", () => {
    if (currentTheme() === "system") applyTheme("system");
  });
}

/* ---------- helpers ---------- */

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const initials = name => name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();

const clock = ms => {
  const s = Math.max(0, Math.round(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
};

const el = sel => document.querySelector(sel);

async function post(route, body) {
  const res = await fetch("/api/" + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

async function get(route) {
  const res = await fetch("/api/" + route, { headers: { "Accept": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function toast(msg) {
  S.toast = msg;
  render();
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { S.toast = ""; render(); }, 2600);
}

function setState(data) {
  if (S.state && S.state.me && data.me && typeof data.me.points === "number"
      && S.state.me.points !== data.me.points) S.bump = true;
  if (data.tasks && S.state) notifyFinished(data.tasks);
  else if (data.tasks) data.tasks.forEach(t => chimed.add("seen:" + (t.key || t.id)));
  S.state = data;
  S.fetchedAt = Date.now();
  S.view = data.me.role === "admin" ? "admin" : "child";
}

// The selected day: live state when it's today, a fetched snapshot otherwise.
function dayView() {
  const st = S.state;
  if (!S.day || S.day === st.date) {
    return { date: st.date, live: true, tasks: st.tasks, board: st.board, week: st.week };
  }
  if (S.dayData && S.dayData.date === S.day) return S.dayData;
  return { date: S.day, live: false, tasks: [], board: [], week: st.week, loading: true };
}

/* ---------- live elapsed ---------- */

function liveElapsed(task) {
  return task.elapsedMs + (task.running ? Date.now() - S.fetchedAt : 0);
}

function taskById(id) {
  if (!S.state) return null;
  const pool = S.state.tasks || (S.state.board || []).flatMap(b => b.tasks);
  return pool.find(t => t.id === id) || null;
}

/* ---------- svg bits ---------- */

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 8v9H5v-9h14zM7 12v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z"/></svg>',
  chevL: '<svg viewBox="0 0 24 24"><path d="M15.4 4.6 13.9 3l-9 9 9 9 1.5-1.6L8 12z"/></svg>',
  chevR: '<svg viewBox="0 0 24 24"><path d="M8.6 3 7.1 4.6 14 12l-6.9 7.4L8.6 21l9-9z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/></svg>',
  system: '<svg viewBox="0 0 24 24"><path d="M4 5h16v10H4zm0 12h16v2H4z"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5h0v3h0zm-1 0h2v3h-2zm0 19h2v3h-2zM2 11h3v2H2zm17 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zM16.3 17.7l1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M12.3 3a7.5 7.5 0 1 0 8.7 9.6A6.5 6.5 0 0 1 12.3 3z"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><path d="M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2zM9 7a3 3 0 0 1 6 0v2H9V7z"/></svg>',
};

function ringSvg(pct, r, sw) {
  const c = 2 * Math.PI * r;
  const size = (r + sw) * 2;
  return `<svg viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--track)" stroke-width="${sw}"></circle>
    <circle class="js-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--accent)" stroke-width="${sw}"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"></circle>
  </svg>`;
}

/* ---------- login ---------- */

function loginView() {
  if (!S.pick) {
    return `<div class="login"><div class="panel">
      <div class="spread" style="margin-bottom:18px">
        <p class="eyebrow" style="margin:0">Hearth</p>
        ${themeButton()}
      </div>
      <h2 style="margin:0 0 20px;font-size:19px;font-weight:600;letter-spacing:-.02em">Who's here?</h2>
      <div class="profile-grid">
        ${S.profiles.map(p => `
          <button class="profile" data-act="pick" data-id="${p.id}">
            <span class="avatar" data-color="${esc(p.color)}">${esc(initials(p.name))}</span>
            <span class="nm">${esc(p.name)}</span>
            <span class="rl">${p.role === "admin" ? "parent" : "child"}</span>
          </button>`).join("")}
      </div>
    </div></div>`;
  }

  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return `<div class="login"><div class="panel">
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
      <span class="avatar lg" data-color="${esc(S.pick.color)}">${esc(initials(S.pick.name))}</span>
      <div style="font-size:16px;font-weight:500">${esc(S.pick.name)}</div>
      <div class="rl mono" style="font-size:10px;letter-spacing:.1em;color:var(--muted)">enter pin</div>
    </div>
    <div class="pin-dots">
      ${[0, 1, 2, 3].map(i => `<i class="${i < S.pin.length ? "filled" : ""}"></i>`).join("")}
    </div>
    <p class="err">${esc(S.err)}</p>
    <div class="keypad" style="margin-top:14px">
      ${keys.map(k => `<button data-act="digit" data-d="${k}">${k}</button>`).join("")}
      <button class="util" data-act="unpick">Back</button>
      <button data-act="digit" data-d="0">0</button>
      <button class="util" data-act="del">Delete</button>
    </div>
  </div></div>`;
}

async function submitPin() {
  try {
    await post("login", { userId: S.pick.id, pin: S.pin });
    S.pin = ""; S.err = ""; S.pick = null;
    setState(await get("state"));
    render();
  } catch (e) {
    S.err = e.message;
    S.pin = "";
    render();
  }
}


// Reward icons. Drawn here rather than pulled from a library so the app keeps
// working with no network and no third-party assets. Solid silhouettes on a
// 24x24 grid, which is what survives being shrunk into a medallion.
const REWARD_ICONS = [
  { id: "film", name: "Movie", words: ["movie", "film", "cinema", "netflix", "show"],
    d: "M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm2 2v2h2V6H5zm12 0v2h2V6h-2zM5 10v4h14v-4H5zm0 6v2h2v-2H5zm12 0v2h2v-2h-2z" },

  { id: "popcorn", name: "Popcorn", words: ["popcorn", "snack", "treat"],
    d: "M6 9h12l-1.3 11.1a1 1 0 0 1-1 .9H8.3a1 1 0 0 1-1-.9L6 9zm1.2-2a2.6 2.6 0 0 1 2.2-3.4A2.7 2.7 0 0 1 12 2a2.7 2.7 0 0 1 2.6 1.6A2.6 2.6 0 0 1 16.8 7H7.2z" },

  { id: "gamepad", name: "Game", words: ["game", "gaming", "xbox", "playstation", "console", "video game"],
    d: "M7 7h10a5 5 0 0 1 5 5.2l-.3 4.3A2.6 2.6 0 0 1 19 19a2.6 2.6 0 0 1-2.2-1.2L15.4 16H8.6l-1.4 1.8A2.6 2.6 0 0 1 5 19a2.6 2.6 0 0 1-2.7-2.5L2 12.2A5 5 0 0 1 7 7zm-1 3v1.5H4.5v2H6V15h2v-1.5h1.5v-2H8V10H6zm9 .5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm2.5 3a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5z" },

  { id: "screen", name: "Screen time", words: ["screen", "tablet", "ipad", "phone", "youtube", "tv"],
    d: "M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v9h16V6H4z" },

  { id: "dinner", name: "Pick a meal", words: ["dinner", "lunch", "breakfast", "meal", "food", "cook", "menu", "restaurant"],
    d: "M5 2h1.6l.5 7.2a2.2 2.2 0 0 1-1.3 2.2V22H4V11.4a2.2 2.2 0 0 1-1.3-2.2L3.2 2h1.6l.3 6h.6l.3-6zM16 2c2.6 0 4.5 3 4.5 7 0 2.8-1 4.6-2.5 5.3V22h-2.2V2H16z" },

  { id: "pizza", name: "Pizza", words: ["pizza", "takeaway", "takeout"],
    d: "M12 2c4.2 0 8 2 10 5L12 22 2 7c2-3 5.8-5 10-5zm0 3.2c-2.6 0-5 1-6.6 2.6l1.1 1.7A8 8 0 0 1 12 7.4c2.2 0 4.2.8 5.5 2.1l1.1-1.7A10 10 0 0 0 12 5.2zM10 11a1.4 1.4 0 1 0 0 2.8A1.4 1.4 0 0 0 10 11zm3.2 4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z" },

  { id: "icecream", name: "Ice cream", words: ["ice cream", "icecream", "dessert", "sundae", "gelato"],
    d: "M12 2a5 5 0 0 1 4.9 4.1A3.3 3.3 0 0 1 16.4 12H7.6a3.3 3.3 0 0 1-.5-5.9A5 5 0 0 1 12 2zM8.2 14h7.6l-3 8a1 1 0 0 1-1.6 0l-3-8z" },

  { id: "cake", name: "Cake", words: ["cake", "birthday", "baking", "bake"],
    d: "M11 2h2v3h-2V2zM7 7h10a3 3 0 0 1 3 3v1.4c-1 0-1.4.9-2.5.9s-1.6-.9-2.6-.9-1.5.9-2.6.9-1.6-.9-2.6-.9-1.5.9-2.6.9c-1 0-1.5-.9-2.5-.9V10a3 3 0 0 1 3-3zM4 14.2c1 0 1.5.8 2.5.8s1.6-.9 2.6-.9 1.5.9 2.6.9 1.6-.9 2.6-.9 1.5.9 2.6.9c1 0 1.5-.8 2.5-.8V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5.8z" },

  { id: "book", name: "Book", words: ["book", "reading", "read", "comic", "library", "story"],
    d: "M4 3h6a3 3 0 0 1 2 .8V21a3 3 0 0 0-2-.8H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm16 0a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-6a3 3 0 0 0-2 .8V3.8A3 3 0 0 1 14 3h6z" },

  { id: "music", name: "Music", words: ["music", "song", "spotify", "album", "concert"],
    d: "M20 3v12.5a3.5 3.5 0 1 1-2-3.16V7.6L10 9.4v8.1a3.5 3.5 0 1 1-2-3.16V6.2a1 1 0 0 1 .8-1l10-2.2A1 1 0 0 1 20 3z" },

  { id: "headphones", name: "Headphones", words: ["headphones", "audio", "podcast", "listen"],
    d: "M12 2a9 9 0 0 1 9 9v7a3 3 0 0 1-3 3h-2v-9h3v-1a7 7 0 1 0-14 0v1h3v9H6a3 3 0 0 1-3-3v-7a9 9 0 0 1 9-9z" },

  { id: "ball", name: "Sport", words: ["football", "soccer", "ball", "sport", "basketball", "match", "game night"],
    d: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3.2-3.4 2.4 1.3 4h4.2l1.3-4L12 5.2zM4.6 10.4l-.4 1.6a8 8 0 0 0 1.7 5l1.9-.4 1.3-4-3.2-2.3zm14.8 0-3.2 2.3 1.3 4 1.9.4a8 8 0 0 0 1.7-5l-.4-1.6zM9.2 17.6l-1 1.7a8 8 0 0 0 7.6 0l-1-1.7H9.2z" },

  { id: "bike", name: "Bike ride", words: ["bike", "cycle", "bicycle", "ride", "scooter"],
    d: "M5.5 14a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm13 0a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM14 3h4v2h-2.6l1.1 2.5 1.6 4H16l-1.3-3.3L11 11.6V17H9v-6.4l3.7-2.7L11.6 5H8V3h4z" },

  { id: "swim", name: "Swimming", words: ["swim", "pool", "beach", "water"],
    d: "M16.8 3.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM4.6 12.6l5.8-3.3 3 2.2 3.3-1.2.8 2.1-4.4 1.6-2.5-1.8-4.8 2.8-1.2-2.4zM2 17c1.4 0 2.2.5 2.9.9.6.4 1 .6 1.7.6s1.1-.2 1.7-.6c.7-.4 1.5-.9 2.9-.9s2.2.5 2.9.9c.6.4 1 .6 1.7.6s1.1-.2 1.7-.6c.7-.4 1.5-.9 2.9-.9v2.3c-.7 0-1.1.2-1.7.6-.7.4-1.5.9-2.9.9s-2.2-.5-2.9-.9c-.6-.4-1-.6-1.7-.6s-1.1.2-1.7.6c-.7.4-1.5.9-2.9.9s-2.2-.5-2.9-.9c-.6-.4-1-.6-1.7-.6V17z" },

  { id: "outdoors", name: "Outdoors", words: ["park", "outside", "walk", "hike", "camp", "forest"],
    d: "M12 2l5 8h-2.5l4 6H13v6h-2v-6H5.5l4-6H7l5-8z" },

  { id: "trip", name: "Trip out", words: ["trip", "drive", "car", "outing", "zoo", "museum", "day out"],
    d: "M6.5 5h11a2 2 0 0 1 1.9 1.4L21 11v7a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-11v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7l1.6-4.6A2 2 0 0 1 6.5 5zm-.4 2.5L5 11h14l-1.1-3.5H6.1zM6 13a1.4 1.4 0 1 0 0 2.8A1.4 1.4 0 0 0 6 13zm12 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z" },

  { id: "coin", name: "Pocket money", words: ["money", "cash", "coin", "pocket money", "allowance", "buy"],
    d: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm.9 3.5h-1.8v1.3c-1.7.2-2.9 1.2-2.9 2.8 0 1.9 1.6 2.5 3.1 2.9 1.4.4 1.9.7 1.9 1.3 0 .6-.6 1-1.5 1-1.1 0-1.8-.5-1.9-1.4H7.9c.1 1.7 1.3 2.7 3.2 2.9v1.3h1.8v-1.3c1.8-.2 3-1.3 3-2.9 0-1.9-1.6-2.5-3.2-2.9-1.3-.4-1.8-.6-1.8-1.2 0-.6.5-1 1.4-1 1 0 1.6.5 1.7 1.3h1.9c-.1-1.6-1.2-2.6-3-2.8V5.5z" },

  { id: "gift", name: "Gift", words: ["gift", "present", "surprise", "prize", "toy"],
    d: "M11 8H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.6A2.8 2.8 0 0 1 8 1.6c1.3 0 2.2.7 3 1.7l1 1.2 1-1.2c.8-1 1.7-1.7 3-1.7A2.8 2.8 0 0 1 19.4 5H21a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-8zM8 3.4c-.6 0-1 .4-1 .9s.4.7 1 .7h1.9L9.2 4c-.3-.4-.7-.6-1.2-.6zm8 0c-.5 0-.9.2-1.2.6l-.7 1H16c.6 0 1-.2 1-.7s-.4-.9-1-.9zM3.6 10H11v12H4.6a1 1 0 0 1-1-1V10zm9.4 0h7.4v11a1 1 0 0 1-1 1H13V10z" },

  { id: "bed", name: "Late bedtime", words: ["bed", "late", "sleepover", "stay up", "bedtime", "sleep"],
    d: "M2 6h2v6h8V8h6a4 4 0 0 1 4 4v6h-2v-3H4v3H2V6zm5 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" },

  { id: "paw", name: "Pet time", words: ["pet", "dog", "cat", "puppy", "walk the dog", "animal"],
    d: "M12 13.5c2.6 0 5.5 2.2 5.5 4.6 0 1.6-1.2 2.4-2.8 2.4-1 0-1.9-.4-2.7-.4s-1.7.4-2.7.4c-1.6 0-2.8-.8-2.8-2.4 0-2.4 2.9-4.6 5.5-4.6zM6.2 8.4c1.2 0 2 1.2 1.9 2.7-.1 1.5-1.1 2.7-2.3 2.7s-2-1.2-1.9-2.7c.1-1.5 1.1-2.7 2.3-2.7zm11.6 0c1.2 0 2.2 1.2 2.3 2.7.1 1.5-.7 2.7-1.9 2.7s-2.2-1.2-2.3-2.7c-.1-1.5.7-2.7 1.9-2.7zM9.6 3c1.2 0 2.1 1.3 2.1 2.9s-.9 2.9-2.1 2.9-2.1-1.3-2.1-2.9S8.4 3 9.6 3zm4.8 0c1.2 0 2.1 1.3 2.1 2.9s-.9 2.9-2.1 2.9-2.1-1.3-2.1-2.9S13.2 3 14.4 3z" },

  { id: "ticket", name: "Ticket", words: ["ticket", "event", "show", "theatre", "theater", "match ticket"],
    d: "M3 5h18a1 1 0 0 1 1 1v3.5a2.5 2.5 0 0 0 0 5V18a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3.5a2.5 2.5 0 0 0 0-5V6a1 1 0 0 1 1-1zm12 2v2h2V7h-2zm0 4v2h2v-2h-2zm0 4v2h2v-2h-2z" },

  { id: "clock", name: "Extra time", words: ["time", "extra", "hour", "minutes", "later"],
    d: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 4v7l5.2 3.1 1-1.7-4.2-2.5V6h-2z" },

  { id: "star", name: "Something special", words: ["special", "treat", "reward", "choice", "wish"],
    d: "M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6 12 2z" },

  { id: "flame", name: "Hearth", words: [],
    d: "M12 2c1 5 6 6.4 6 11a6 6 0 0 1-12 0c0-3 2.6-4.4 3.5-7 1.4 1.8 2.5-.8 2.5-4zm0 10c.4 2.2 2.5 2.8 2.5 4.7a2.5 2.5 0 0 1-5 0c0-1.5 2-2.2 2.5-4.7z" },
];

// A reward with no icon chosen gets the closest match to its name.
function guessIcon(title) {
  const t = String(title || "").toLowerCase();
  let best = null;
  for (const icon of REWARD_ICONS) {
    for (const w of icon.words) {
      if (t.includes(w) && (!best || w.length > best.len)) best = { id: icon.id, len: w.length };
    }
  }
  return best ? best.id : "star";
}

function iconFor(title, chosen) {
  return REWARD_ICONS.find(i => i.id === chosen)
    || REWARD_ICONS.find(i => i.id === guessIcon(title))
    || REWARD_ICONS[REWARD_ICONS.length - 1];
}

function iconSvg(icon, size) {
  return `<svg viewBox="0 0 24 24" width="${size || 24}" height="${size || 24}"
    aria-hidden="true"><path d="${icon.d}"/></svg>`;
}

/* ---------- reward scenes ---------- */

// Each reward gets a scene generated from its own name, so a reward added
// later gets its own artwork without anyone drawing anything.
function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let s = seed || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const SKIES = [
  { id: "midnight", name: "Midnight", from: "#12305C", to: "#2E5E7E" },
  { id: "slate",    name: "Slate",    from: "#1B2E4A", to: "#4A5F78" },
  { id: "ink",      name: "Ink",      from: "#0E1420", to: "#2B3B55" },
  { id: "ice",      name: "Ice",      from: "#152B33", to: "#4E8092" },
  { id: "pine",     name: "Pine",     from: "#0F2E3A", to: "#356A63" },
  { id: "aurora",   name: "Aurora",   from: "#08221F", to: "#1F6B57" },
  { id: "moss",     name: "Moss",     from: "#17281B", to: "#46704A" },
  { id: "plum",     name: "Plum",     from: "#241F4A", to: "#5B4A72" },
  { id: "violet",   name: "Violet",   from: "#1A1240", to: "#4B3A8C" },
  { id: "dusk",     name: "Dusk",     from: "#221A2E", to: "#6E5A7A" },
  { id: "mauve",    name: "Mauve",    from: "#2A1E38", to: "#6B4763" },
  { id: "rose",     name: "Rose",     from: "#331726", to: "#8A4A5E" },
  { id: "ember",    name: "Ember",    from: "#2B1A18", to: "#7A4230" },
  { id: "rust",     name: "Rust",     from: "#301C12", to: "#8A5326" },
  { id: "copper",   name: "Copper",   from: "#241410", to: "#96602B" },
  { id: "steel",    name: "Steel",    from: "#13263A", to: "#3E6B84" },
];

function skyFor(title, chosen) {
  const picked = SKIES.find(s => s.id === chosen);
  return picked || SKIES[seedFrom(title) % SKIES.length];
}

function ridge(rand, baseY, height, jag, width) {
  const step = width / 9;
  let d = `M0 ${baseY + height}`;
  let x = 0;
  d += ` L0 ${baseY - rand() * height * 0.3}`;
  while (x < width) {
    x += step;
    const peak = baseY - (0.35 + rand() * jag) * height;
    d += ` L${(x - step / 2).toFixed(1)} ${peak.toFixed(1)} L${x.toFixed(1)} ${(baseY - rand() * height * 0.35).toFixed(1)}`;
  }
  return d + ` L${width} ${baseY + height} Z`;
}

function trees(rand, count, baseY, size, width, fill) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = rand() * width;
    const h = size * (0.7 + rand() * 0.6);
    const w = h * 0.42;
    out += `<path d="M${x.toFixed(1)} ${(baseY - h).toFixed(1)}
      L${(x + w).toFixed(1)} ${baseY} L${(x - w).toFixed(1)} ${baseY} Z" fill="${fill}"/>`;
    out += `<rect x="${(x - w * 0.11).toFixed(1)}" y="${(baseY - 2).toFixed(1)}"
      width="${(w * 0.22).toFixed(1)}" height="${(h * 0.16).toFixed(1)}" fill="${fill}"/>`;
  }
  return out;
}

function svgLayer(inner, w, h) {
  return `<div class="player"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">${inner}</svg></div>`;
}

function rewardScene(title, uid, chosenSky) {
  const rand = makeRng(seedFrom(title));
  const W = 360, H = 520;
  // Gradient ids share one document across the whole grid, so they have to be
  // unique per card or every card renders with the first card's sky.
  const gid = "s" + (uid || seedFrom(title).toString(36));
  const sky = skyFor(title, chosenSky);
  const layers = [];

  // 1 — sky, moon, stars
  let stars = "";
  for (let i = 0; i < 40; i++) {
    stars += `<circle cx="${(rand() * W).toFixed(1)}" cy="${(rand() * H * 0.55).toFixed(1)}"
      r="${(0.5 + rand() * 1.4).toFixed(2)}" fill="#F4F8F2" opacity="${(0.25 + rand() * 0.6).toFixed(2)}"/>`;
  }
  layers.push(svgLayer(`
    <defs><linearGradient id="sky-${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${sky.from}"/><stop offset="1" stop-color="${sky.to}"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky-${gid})"/>
    ${stars}
    <circle cx="${(60 + rand() * 240).toFixed(0)}" cy="${(60 + rand() * 70).toFixed(0)}"
      r="${(16 + rand() * 12).toFixed(0)}" fill="#EDF2E8" opacity=".82"/>`, W, H));

  // 2 — far peaks
  layers.push(svgLayer(`<path d="${ridge(rand, 300, 150, 0.55, W)}" fill="#2C4258" opacity=".85"/>`, W, H));

  // 3 — nearer ridge
  layers.push(svgLayer(`<path d="${ridge(rand, 340, 120, 0.5, W)}" fill="#22323F"/>`, W, H));

  // 4 — the hall, lit from within
  const hx = 120 + rand() * 120;
  layers.push(svgLayer(`
    <defs><radialGradient id="glow-${gid}">
      <stop offset="0" stop-color="#E9A94A" stop-opacity=".95"/>
      <stop offset="1" stop-color="#E9A94A" stop-opacity="0"/>
    </radialGradient></defs>
    <circle cx="${hx}" cy="392" r="86" fill="url(#glow-${gid})"/>
    <path d="M${hx - 62} 404 L${hx} 344 L${hx + 62} 404 Z" fill="#16211C"/>
    <path d="M${hx - 62} 404 L${hx + 62} 404 L${hx + 62} 424 L${hx - 62} 424 Z" fill="#16211C"/>
    <path d="M${hx - 14} 348 L${hx + 6} 330 M${hx + 14} 348 L${hx - 6} 330"
      stroke="#16211C" stroke-width="5" stroke-linecap="round"/>
    <path d="M${hx} 372 C${hx + 8} 384 ${hx + 13} 389 ${hx + 13} 397
      A13 13 0 0 1 ${hx - 13} 397 C${hx - 13} 388 ${hx - 5} 384 ${hx} 372 Z" fill="#F0B45B"/>`, W, H));

  // 5–7 — the near bank, closing in
  layers.push(svgLayer(`<path d="${ridge(rand, 430, 70, 0.4, W)}" fill="#16211C"/>
    ${trees(rand, 7, 438, 54, W, "#111A16")}`, W, H));
  layers.push(svgLayer(trees(rand, 5, 486, 78, W, "#0D1512"), W, H));
  layers.push(svgLayer(`<path d="M0 ${H} L0 500 Q ${W / 2} 470 ${W} 505 L${W} ${H} Z" fill="#0A100D"/>
    ${trees(rand, 3, 528, 104, W, "#080D0B")}`, W, H));

  return layers.join("");
}


/* ---------- week calendar ---------- */

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function dayNumber(date) {
  return Number(date.slice(8, 10));
}

function monthLabel(date) {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function weekCalendar(week, opts) {
  const today = (S.state && S.state.date) || "";
  const selected = S.day || today;
  return `<div class="calendar">
    ${week.map(d => {
      const isToday = d.date === today;
      const isSel = d.date === selected;
      const state = d.total === 0 ? "rest" : d.done >= d.total ? "full" : d.done > 0 ? "part" : "none";
      return `<button class="cday ${state} ${isToday ? "today" : ""} ${isSel ? "sel" : ""}"
        data-act="pickDay" data-date="${d.date}"
        aria-current="${isToday ? "date" : "false"}"
        aria-label="${monthLabel(d.date)}, ${d.done} of ${d.total} done">
        <span class="dw">${DOW[new Date(d.date + "T12:00:00").getDay()]}</span>
        <span class="dn">${dayNumber(d.date)}</span>
        <span class="dbar"><i style="width:${d.total ? Math.round((d.done / d.total) * 100) : 0}%"></i></span>
      </button>`;
    }).join("")}
  </div>
  ${opts && opts.note ? `<div class="calnote">${opts.note}</div>` : ""}`;
}

/* ---------- child ---------- */

function statusChip(t) {
  if (t.status === "done") return `<span class="chip done">done · +${t.awardedPoints || 0}</span>`;
  if (t.status === "awaiting") return `<span class="chip await">waiting on parent</span>`;
  if (t.status === "running") return `<span class="chip live">running</span>`;
  if (t.status === "paused") return `<span class="chip">paused</span>`;
  return `<span class="chip">not started</span>`;
}

function liveDay() {
  return !S.day || !S.state || S.day === S.state.date;
}

function taskCard(t) {
  const chore = t.type === "chore";
  const total = chore ? 0 : t.durationMin * 60000;
  const done = t.status === "done" || t.status === "awaiting";
  const pct = done ? 1 : chore ? 0 : Math.min(1, liveElapsed(t) / total);
  // Study counts down to zero; a chore counts up until the child is finished.
  const face = done ? "✓" : chore ? clock(liveElapsed(t)) : clock(Math.max(0, total - liveElapsed(t)));
  const started = t.status === "running" || t.status === "paused";

  return `<div class="card ${S.justDone.includes(t.id) ? "settled" : ""}">
    <div class="row">
      <div class="ring js-ring" data-id="${t.id}" data-mode="${chore ? "up" : "down"}">
        ${ringSvg(pct, 22, 5)}
        <span class="label js-mini ${t.running ? "on" : ""}">${face}</span>
      </div>
      <div style="flex:1;min-width:0">
        <h3>${esc(t.title)}</h3>
        <div class="meta">${chore ? "chore · no set time" : t.durationMin + " min · study"} · ${t.points} pts${t.shared ? " · shared" : ""}${t.onceOn ? " · today only" : ""}</div>
        <div style="margin-top:8px">${statusChip(t)}</div>
      </div>
      ${!liveDay() ? "" : done ? `<button class="pad" disabled aria-label="Finished">${ICON.check}</button>`
        : `<button class="pad accent" data-act="open" data-id="${t.id}"
             aria-label="${t.running ? "Open timer" : "Start"} ${esc(t.title)}">${t.running ? ICON.pause : ICON.play}</button>`}
    </div>
    ${chore && started && liveDay() ? `<div class="row" style="justify-content:flex-end;margin-top:12px">
      <button class="btn small accent" data-act="submit" data-id="${t.id}">I'm done</button>
    </div>` : ""}
  </div>`;
}

function childView() {
  const st = S.state;
  const tabs = ["Today", "Rewards"];
  const body = S.tab === 0 ? childToday() : childRewards();

  return `<div class="wrap">
    <div class="top">
      <div class="brand">
        <span class="avatar" data-color="${esc(st.me.color)}">${esc(initials(st.me.name))}</span>
        <div>
          <h1>${esc(st.me.name)}</h1>
          <div class="date">${esc(st.date)}</div>
        </div>
      </div>
      <div class="row">
        <span class="points ${S.bump ? "bump" : ""}" title="allowance + saved">
          <b>${st.me.points}</b><span>PTS</span>
        </span>
        ${themeButton()}
        <button class="btn quiet small" data-act="logout">Sign out</button>
      </div>
    </div>
    ${tabBar(tabs)}
    <div class="view ${S.entering ? "enter" : ""}">${body}</div>
  </div>`;
}

function streakLine(streak, live) {
  if (!streak) return "";
  return `<div class="streak-line">
    <span class="chip live">${streak}</span>
    <span>${streak} day${streak === 1 ? "" : "s"} running${live ? " · finish today to keep it going" : ""}</span>
  </div>`;
}

function childToday() {
  const st = S.state;
  const view = dayView();
  const tasks = view.tasks;
  const study = tasks.filter(t => t.type === "study");
  const chores = tasks.filter(t => t.type === "chore");
  const left = tasks.filter(t => t.status !== "done").length;
  const head = weekCalendar(view.week || st.week || [], {
    note: view.live ? "" : monthLabel(view.date),
  }) + streakLine(st.streak || 0, view.live);

  const events = view.events || st.events || [];
  const agenda = events.length ? `<h2 class="section-title">What's on</h2><div class="cards" style="margin-bottom:4px">
    ${events.map(e => `<div class="card flat">
      <div class="spread">
        <div style="min-width:0">
          <h3 style="${e.done ? "text-decoration:line-through;opacity:.6" : ""}">${esc(e.title)}</h3>
          <div class="meta">${e.time ? esc(e.time) : "any time"}${e.note ? " · " + esc(e.note) : ""}</div>
        </div>
        <button class="btn small quiet" data-act="toggleEvent" data-id="${e.id}">${e.done ? "Undo" : "Done"}</button>
      </div>
    </div>`).join("")}</div>` : "";

  if (!tasks.length) return head + agenda + `<p class="empty">${view.live ? "Nothing assigned for today." : "Nothing scheduled that day."}</p>`;

  return head + `
    <div class="card flat" style="margin-bottom:20px">
      <div class="spread">
        <div>
          <div style="font-size:15px;font-weight:500">${left === 0 ? "All finished" : left + (view.live ? " left today" : " to do")}</div>
          <div class="meta" style="margin-top:4px">${tasks.length - left} of ${tasks.length} complete</div>
        </div>
        <div class="ring" style="width:44px;height:44px;flex-basis:44px">
          ${ringSvg((tasks.length - left) / tasks.length, 18, 4)}
        </div>
      </div>
    </div>
    ${agenda}
    ${study.length ? `<h2 class="section-title">Studying</h2><div class="cards">${study.map(taskCard).join("")}</div>` : ""}
    ${chores.length ? `<h2 class="section-title">Chores</h2><div class="cards">${chores.map(taskCard).join("")}</div>` : ""}`;
}

function balanceCard(me) {
  const pct = me.allowanceWeekly ? me.allowanceRemaining / me.allowanceWeekly : 0;
  return `<div class="card" style="margin-bottom:20px">
    <div class="spread" style="align-items:flex-start">
      <div>
        <div class="meta">Allowance</div>
        <div style="font-size:26px;font-weight:500;letter-spacing:-.03em;margin:2px 0 4px">${me.allowanceRemaining}</div>
        <div class="meta">of ${me.allowanceWeekly} · resets ${esc(me.renewsOn || "Monday")}</div>
      </div>
      <div class="ring" style="width:48px;height:48px;flex-basis:48px">${ringSvg(pct, 20, 4)}</div>
      <div style="text-align:right">
        <div class="meta">Saved</div>
        <div style="font-size:26px;font-weight:500;letter-spacing:-.03em;margin:2px 0 4px">${me.earned}</div>
        <div class="meta">yours to keep</div>
      </div>
    </div>
    <div class="meta" style="margin-top:14px;padding-top:12px;border-top:0.5px solid var(--track)">
      Allowance is spent first, so points you earn stay saved.
    </div>
  </div>`;
}

function childRewards() {
  const st = S.state;
  return `
    ${balanceCard(st.me)}
    ${st.rewards.length ? `<div class="reward-grid">` + st.rewards.map(r => {
      const afford = st.me.points >= r.cost;
      const ic = iconFor(r.title, r.icon);
      return `<div class="rcard" data-scene="${esc(r.id)}">
        ${rewardScene(r.title + r.id, r.id.replace(/[^a-zA-Z0-9]/g, ""), r.sky)}
        <div class="rcard-body">
          <div style="min-width:0">
            <span class="rmedal" title="${esc(ic.name)}">${iconSvg(ic, 22)}</span>
            <h3>${esc(r.title)}</h3>
            <div class="cost">${r.cost} POINTS${afford ? "" : ` · ${r.cost - st.me.points} TO GO`}</div>
          </div>
          <button class="rcard-redeem" data-act="redeem" data-id="${r.id}" ${afford ? "" : "disabled"}>Redeem</button>
        </div>
      </div>`;
    }).join("") + `</div>` : `<p class="empty">No rewards set up yet.</p>`}
    ${st.redemptions.length ? `<h2 class="section-title">Your requests</h2>
      <div class="cards">${st.redemptions.map(r => `<div class="card flat">
        <div class="spread">
          <div><h3>${esc(r.rewardTitle)}</h3><div class="meta">${r.cost} pts</div></div>
          <span class="chip ${r.status === "fulfilled" ? "done" : r.status === "denied" ? "await" : ""}">${r.status}</span>
        </div>
      </div>`).join("")}</div>` : ""}`;
}

/* ---------- focus overlay ---------- */

function focusView() {
  const t = taskById(S.focus);
  if (!t) return "";
  const chore = t.type === "chore";
  const total = chore ? 0 : t.durationMin * 60000;
  const done = t.status === "done" || t.status === "awaiting";
  const remaining = done ? 0 : chore ? liveElapsed(t) : Math.max(0, total - liveElapsed(t));
  const pct = done ? 1 : chore ? 0 : Math.min(1, liveElapsed(t) / total);
  const started = t.status === "running" || t.status === "paused";

  const note = done
    ? (chore ? "Sent to a parent to check off" : "Finished · +" + t.points + " points")
    : chore
      ? "take as long as you need, then tap done"
      : "the timer has to finish · pause is fine";

  return `<div class="overlay">
    <button class="btn quiet" data-act="closeFocus" style="position:absolute;top:20px;left:16px">${ICON.back} Back</button>
    <div style="text-align:center">
      <div class="mono" style="font-size:10.5px;letter-spacing:.14em;color:var(--muted)">${esc(t.type)}</div>
      <div style="font-size:19px;font-weight:500;margin-top:6px">${esc(t.title)}</div>
    </div>
    <div class="dial">
      ${ringSvg(pct, 125, 7)}
      <div class="face">
        <div class="readout js-readout">${clock(remaining)}</div>
        <div class="caption">${chore ? "elapsed" : t.durationMin + " min"} · ${t.points} pts</div>
      </div>
    </div>
    <button class="key ${t.running ? "on" : ""}" data-act="${done ? "" : t.running ? "pause" : "start"}" data-id="${t.id}"
      ${done ? "disabled" : ""} aria-label="${t.running ? "Pause" : "Start"}">
      ${done ? ICON.check : t.running ? ICON.pause : ICON.play}
    </button>
    ${chore && started && !done ? `<button class="btn accent" data-act="submit" data-id="${t.id}">I'm done</button>` : ""}
    <p class="caption" style="max-width:260px">${esc(note)}</p>
  </div>`;
}


/* ---------- month planner ---------- */

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function monthAnchor() {
  return S.month || (S.state && S.state.date) || "";
}

function datesBetween(from, to) {
  if (!from || !to || from > to) return [];
  const out = [];
  let d = from;
  for (let i = 0; i < 400 && d <= to; i++) { out.push(d); d = shiftDay(d, 1); }
  return out;
}

function shiftDay(date, delta) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftMonth(anchor, delta) {
  const d = new Date(anchor + "T12:00:00");
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function adminCalendar() {
  const st = S.state;
  const data = S.monthData;
  const anchor = monthAnchor();
  const label = new Date(anchor + "T12:00:00");

  if (!data || data.month !== anchor.slice(0, 7)) {
    loadMonth(anchor);
    return `<p class="empty">Loading…</p>`;
  }

  const startsOn = (st.settings && st.settings.weekStartsOn === 0) ? 0 : 1;
  const firstDow = new Date(data.days[0].date + "T12:00:00").getDay();
  const lead = (firstDow - startsOn + 7) % 7;
  const letters = startsOn === 0
    ? ["S", "M", "T", "W", "T", "F", "S"]
    : ["M", "T", "W", "T", "F", "S", "S"];

  const selected = S.day || st.date;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(`<div class="mcell empty"></div>`);
  for (const d of data.days) {
    const isToday = d.date === st.date;
    const isSel = d.date === selected;
    const pct = d.total ? Math.round((d.done / d.total) * 100) : 0;
    const picked = S.sel.includes(d.date);
    cells.push(`<button class="mcell ${isToday ? "today" : ""} ${isSel && !S.selecting ? "sel" : ""} ${picked ? "picked" : ""}"
      data-act="pickDay" data-date="${d.date}"
      aria-label="${d.date}, ${d.done} of ${d.total} done, ${d.events.length} events">
      <span class="mnum">${Number(d.date.slice(8))}</span>
      ${d.total ? `<span class="mbar"><i style="width:${pct}%"></i></span>` : `<span class="mbar blank"></span>`}
      ${d.events.length ? `<span class="mdots">${d.events.slice(0, 3).map(e =>
        `<i class="${e.done ? "done" : ""}"></i>`).join("")}</span>` : `<span class="mdots"></span>`}
    </button>`);
  }

  const selBar = S.selecting ? `
    <div class="card form selbar">
      <div class="spread" style="margin-bottom:12px">
        <div>
          <div style="font-size:15px;font-weight:500">${S.sel.length} day${S.sel.length === 1 ? "" : "s"} selected</div>
          <div class="meta" style="margin-top:3px">Tap days to add or remove them</div>
        </div>
        <div class="row">
          ${S.sel.length ? `<button class="btn small quiet" data-act="clearSel">Clear</button>` : ""}
          <button class="btn small" data-act="selectMode" data-on="0">Done</button>
        </div>
      </div>
      <div class="grid2">
        <div><label class="lab" for="r-from">From</label>
          <input class="field" id="r-from" type="date" value="${esc(S.rangeFrom || S.state.date)}"></div>
        <div><label class="lab" for="r-to">To</label>
          <input class="field" id="r-to" type="date" value="${esc(S.rangeTo || S.state.date)}"></div>
      </div>
      <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn small accent" data-act="addRange">Add range</button>
        <button class="btn small quiet" data-act="removeRange">Remove range</button>
        <button class="btn small quiet" data-act="selWeekdays">Weekdays</button>
        <button class="btn small quiet" data-act="selWeekends">Weekends</button>
      </div>
      ${S.sel.length ? `<div class="seldays">${S.sel.slice(0, 40).map(d =>
        `<button class="selchip" data-act="unpickSel" data-date="${d}" title="Remove ${d}">${
          Number(d.slice(8))}/${Number(d.slice(5, 7))} ×</button>`).join("")}${
        S.sel.length > 40 ? `<span class="meta">+${S.sel.length - 40} more</span>` : ""}</div>` : ""}
    </div>` : "";

  return `
    ${selBar}
    <div class="mhead">
      <button class="mnav" data-act="month" data-d="-1" aria-label="Previous month">${ICON.chevL}</button>
      <button class="mtitle ${S.picking ? "on" : ""}" data-act="monthPicker"
        aria-expanded="${S.picking ? "true" : "false"}">
        <span>${MONTHS[label.getMonth()]} ${label.getFullYear()}</span>
        <span class="caret">${S.picking ? "▲" : "▼"}</span>
      </button>
      <button class="mnav" data-act="month" data-d="1" aria-label="Next month">${ICON.chevR}</button>
    </div>
    ${S.picking ? monthPicker(label) : ""}
    ${anchor.slice(0, 7) === st.date.slice(0, 7) ? "" : `<div class="row" style="justify-content:center;margin-bottom:14px">
      <button class="btn small quiet" data-act="monthToday">Back to ${MONTHS[new Date(st.date + "T12:00:00").getMonth()]}</button>
    </div>`}
    ${S.selecting ? "" : `<button class="bigbtn" data-act="selectMode" data-on="1">
      ${ICON.cal}
      <span>
        <b>Select days</b>
        <small>Schedule something across a range</small>
      </span>
    </button>`}
    <div class="mgrid-head">${letters.map(l => `<span>${l}</span>`).join("")}</div>
    <div class="mgrid">${cells.join("")}</div>
    ${dayPanel(selected)}`;
}

function monthPicker(label) {
  const year = label.getFullYear();
  const curMonth = label.getMonth();
  const todayY = Number((S.state.date || "").slice(0, 4));
  const todayM = Number((S.state.date || "").slice(5, 7)) - 1;
  return `<div class="card form mpicker">
    <div class="yearrow">
      <button class="mnav small" data-act="pickYear" data-d="-1" aria-label="Previous year">${ICON.chevL}</button>
      <div class="yr">${year}</div>
      <button class="mnav small" data-act="pickYear" data-d="1" aria-label="Next year">${ICON.chevR}</button>
    </div>
    <div class="mgrid-months">
      ${MONTHS.map((m, i) => `<button class="mopt ${i === curMonth ? "on" : ""} ${
        i === todayM && year === todayY ? "istoday" : ""}"
        data-act="pickMonth" data-m="${i}">${m.slice(0, 3)}</button>`).join("")}
    </div>
  </div>`;
}

function loadMonth(anchor) {
  post("month", { date: anchor })
    .then(data => { S.monthData = data; render(); })
    .catch(err => toast(err.message));
}

function dayPanel(date) {
  const st = S.state;
  const data = S.monthData;
  const rec = data && data.days.find(d => d.date === date);
  const view = dayView();
  const board = view.board && view.board.length ? view.board : (view.live ? st.board : []);
  const past = date <= st.date;

  const f = S.form && S.form.kind === "event" ? S.form : null;

  return `<div class="daypanel">
    <div class="spread" style="margin-bottom:14px">
      <h2 class="section-title" style="margin:0">${esc(monthLabel(date))}</h2>
      <button class="btn small ${f ? "on" : "accent"}" data-act="${f ? "cancelForm" : "newEvent"}" data-date="${date}">
        ${f ? "Cancel" : S.sel.length > 1 ? `Add to ${S.sel.length} days` : "Add something"}
      </button>
    </div>

    ${f ? eventForm(f) : ""}

    ${rec && rec.events.length ? `<div class="cards" style="margin-bottom:22px">
      ${rec.events.map(e => `<div class="card flat">
        <div class="spread">
          <div style="min-width:0">
            <h3 style="${e.done ? "text-decoration:line-through;opacity:.6" : ""}">${esc(e.title)}</h3>
            <div class="meta">${e.time ? esc(e.time) + " · " : ""}${
              e.who.length ? esc(e.who.join(", ")) : "everyone"}${e.note ? " · " + esc(e.note) : ""}${
              e.groupSize > 1 ? " · 1 of " + e.groupSize + " days" : ""}</div>
          </div>
          <div class="row">
            <button class="btn small quiet" data-act="toggleEvent" data-id="${e.id}">${e.done ? "Undo" : "Done"}</button>
            <button class="btn small quiet" data-act="editEvent" data-id="${e.id}">Edit</button>
            <button class="btn small quiet" data-act="deleteEvent" data-id="${e.id}">Remove</button>
            ${e.groupSize > 1 ? `<button class="btn small quiet" data-act="deleteSeries" data-id="${e.id}"
              title="Remove this from all ${e.groupSize} days">Remove all ${e.groupSize}</button>` : ""}
          </div>
        </div>
      </div>`).join("")}
    </div>` : `<p class="meta" style="margin-bottom:22px">Nothing scheduled.</p>`}

    ${board.map(b => `
      <h2 class="section-title">${esc(b.child.name)}</h2>
      ${b.tasks.length ? `<div class="cards">${b.tasks.map(t => `<div class="card flat">
        <div class="spread">
          <div style="min-width:0">
            <h3>${esc(t.title)}</h3>
            <div class="meta">${t.type === "chore" ? "chore" : t.durationMin + " min study"} · ${t.points} pts</div>
          </div>
          <div class="row">
            ${statusChip(t)}
            ${past && t.status !== "done" ? `<button class="btn small accent" data-act="credit"
              data-task="${t.id}" data-child="${b.child.id}" data-date="${date}">Mark done</button>` : ""}
            ${t.status === "done" ? `<button class="btn small quiet" data-act="undo" data-key="${t.key}">Undo</button>` : ""}
          </div>
        </div>
      </div>`).join("")}</div>` : `<p class="meta">Nothing scheduled.</p>`}
    `).join("")}
  </div>`;
}

function eventForm(f) {
  const st = S.state;
  return `<div class="card form" style="margin-bottom:20px">
    <p class="eyebrow">${f.id ? "Edit" : "New"}</p>
    <div class="stack">
      <div><label class="lab" for="e-title">What</label>
        <input class="field" id="e-title" value="${esc(f.title || "")}" placeholder="Dentist, football, grandma visits…"></div>
      <div class="grid2">
        ${f.dates && f.dates.length > 1
          ? `<div><label class="lab">Days</label>
               <div class="field" style="box-shadow:var(--in-sm)">${f.dates.length} days selected</div></div>`
          : `<div><label class="lab" for="e-date">Date</label>
               <input class="field" id="e-date" type="date" value="${esc(f.date || "")}"></div>`}
        <div><label class="lab" for="e-time">Time (optional)</label>
          <input class="field" id="e-time" type="time" value="${esc(f.time || "")}"></div>
      </div>
      ${f.dates && f.dates.length > 1 ? `<div class="meta">${
        f.dates[0]} → ${f.dates[f.dates.length - 1]}, one entry per day so each can be ticked off separately.</div>` : ""}
      <div><label class="lab" for="e-note">Note (optional)</label>
        <input class="field" id="e-note" value="${esc(f.note || "")}" placeholder="Bring kit"></div>
      <div><label class="lab">Who</label>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <button type="button" class="btn small ${(f.childIds || []).length === 0 ? "accent on" : ""}"
            data-act="eventWho" data-id="all">Everyone</button>
          ${st.children.map(c => `<button type="button" class="btn small ${(f.childIds || []).includes(c.id) ? "accent on" : ""}"
            data-act="eventWho" data-id="${c.id}">${esc(c.name)}</button>`).join("")}
        </div></div>
      <div class="row" style="justify-content:flex-end">
        <button class="btn accent" data-act="saveEvent">${f.id ? "Save" : "Add"}</button>
      </div>
    </div>
  </div>`;
}

/* ---------- admin ---------- */

function themeButton() {
  const mode = currentTheme();
  const icon = mode === "light" ? ICON.sun : mode === "dark" ? ICON.moon : ICON.system;
  return `<button class="theme" data-act="theme" title="Theme: ${mode}"
    aria-label="Theme: ${mode}. Tap to change.">${icon}</button>`;
}

function tabBar(labels) {
  return `<div class="tabs" style="grid-template-columns:repeat(${labels.length},1fr)">
    <span class="thumb" style="width:calc((100% - 10px)/${labels.length});transform:translateX(calc(${S.tab} * 100%))"></span>
    ${labels.map((l, i) => `<button data-act="tab" data-i="${i}" aria-selected="${i === S.tab}">${l}</button>`).join("")}
  </div>`;
}

function adminView() {
  const st = S.state;
  const pending = st.approvals.length + st.redemptions.length;
  const tabs = ["Today", "Queue" + (pending ? " " + pending : ""), "Plan", "Tasks", "Rewards", "Family"];
  const body = [adminToday, adminApprovals, adminCalendar, adminTasks, adminRewards, adminFamily][S.tab]();

  return `<div class="wrap">
    <div class="top">
      <div class="brand">
        <span class="avatar" data-color="${esc(st.me.color)}">${esc(initials(st.me.name))}</span>
        <div><h1>${esc(st.me.name)}</h1><div class="date">${esc(st.date)}</div></div>
      </div>
      <div class="row">
        ${themeButton()}
        <button class="btn quiet small" data-act="logout">Sign out</button>
      </div>
    </div>
    ${tabBar(tabs)}
    <div class="view ${S.entering ? "enter" : ""}">${body}</div>
  </div>`;
}

function adminToday() {
  const st = S.state;
  if (!st.board.length) return `<p class="empty">Add a child in the Family tab to get started.</p>`;

  const view = dayView();
  const board = view.board && view.board.length ? view.board : st.board;
  const head = weekCalendar((board[0] && board[0].week) || [], {
    note: view.live ? "" : monthLabel(view.date) + (view.loading ? " · loading" : ""),
  });

  return head + `<div class="board">` + board.map(b => {
    const done = b.tasks.filter(t => t.status === "done").length;
    return `<div>
      <div class="spread" style="margin-bottom:12px">
        <div class="row">
          <span class="avatar sm" data-color="${esc(b.child.color)}">${esc(initials(b.child.name))}</span>
          <div>
            <div style="font-size:15px;font-weight:500">${esc(b.child.name)}</div>
            <div class="meta mono" style="font-size:10.5px;color:var(--muted)">${done}/${b.tasks.length} done today${
              b.streak > 0 ? " · " + b.streak + " day streak" : ""}</div>
          </div>
        </div>
        <div style="text-align:right">
          <span class="points"><b>${b.child.points}</b><span>PTS</span></span>
          <div class="meta mono" style="font-size:10px;color:var(--muted);margin-top:5px">${b.child.allowanceRemaining} allowance · ${b.child.earned} saved</div>
        </div>
      </div>
      ${b.tasks.length ? `<div class="cards">` + b.tasks.map(t => `<div class="card flat">
        <div class="spread">
          <div style="min-width:0">
            <h3>${esc(t.title)}</h3>
            <div class="meta">${t.type === "chore" ? "chore" : t.durationMin + " min study"} · ${Math.floor(liveElapsed(t) / 60000)} min logged</div>
          </div>
          <div class="row">
            ${statusChip(t)}
            ${t.status === "awaiting" ? `<button class="btn small accent" data-act="approve" data-key="${t.key}">Check off</button>` : ""}
            ${liveDay() && t.status !== "done" && t.status !== "awaiting" ? `<button class="btn small quiet" data-act="excuse" data-key="${t.key}">Excuse</button>` : ""}
            ${t.status === "done" ? `<button class="btn small quiet" data-act="undo" data-key="${t.key}">Undo</button>` : ""}
          </div>
        </div>
      </div>`).join("") + `</div>` : `<p class="empty">No tasks scheduled today.</p>`}
    </div>`;
  }).join("") + `</div>`;
}

function adminApprovals() {
  const st = S.state;
  if (!st.approvals.length && !st.redemptions.length) return `<p class="empty">Nothing waiting on you.</p>`;

  return `
    ${st.approvals.length ? `<h2 class="section-title">Chores to check off</h2>
      <div class="cards">${st.approvals.map(t => `<div class="card">
        <div class="spread">
          <div>
            <h3>${esc(t.title)}</h3>
            <div class="meta">${esc(t.childName)} · ${Math.floor(liveElapsed(t) / 60000)} min logged · ${t.points} pts</div>
          </div>
          <div class="row">
            <button class="btn small quiet" data-act="reject" data-key="${t.key}">Send back</button>
            <button class="btn small accent" data-act="approve" data-key="${t.key}">Check off</button>
          </div>
        </div>
      </div>`).join("")}</div>` : ""}
    ${st.redemptions.length ? `<h2 class="section-title">Reward requests</h2>
      <div class="cards">${st.redemptions.map(r => `<div class="card">
        <div class="spread">
          <div>
            <h3>${esc(r.rewardTitle)}</h3>
            <div class="meta">${esc(r.childName)} · ${r.cost} pts already deducted</div>
          </div>
          <div class="row">
            <button class="btn small quiet" data-act="denyRedemption" data-id="${r.id}">Refund</button>
            <button class="btn small accent" data-act="fulfill" data-id="${r.id}">Given</button>
          </div>
        </div>
      </div>`).join("")}</div>` : ""}`;
}

function dayChips(days) {
  return `<div class="row" style="gap:7px;flex-wrap:wrap">
    ${DAYS.map((d, i) => `<button type="button" class="btn small ${days.includes(i) ? "accent on" : ""}"
      data-act="toggleDay" data-i="${i}" style="width:38px;padding:8px 0;text-align:center">${d}</button>`).join("")}
  </div>`;
}

function adminTasks() {
  const st = S.state;
  const kind = S.taskKind === "chore" ? "chore" : "study";
  const f = formState("task", { id: "", childId: (st.children[0] || {}).id || "", title: "", type: kind, durationMin: 20, points: 10, days: [0, 1, 2, 3, 4, 5, 6] });
  // Editing a task pins the form to that task's type.
  if (!f.id) f.type = kind;

  return `
    <div class="tabs" style="grid-template-columns:repeat(2,1fr);margin-bottom:20px">
      <span class="thumb" style="width:calc((100% - 10px)/2);transform:translateX(calc(${kind === "chore" ? 1 : 0} * 100%))"></span>
      <button data-act="taskKind" data-k="study" aria-selected="${kind === "study"}">Study</button>
      <button data-act="taskKind" data-k="chore" aria-selected="${kind === "chore"}">Chores</button>
    </div>
    <div class="card form" style="margin-bottom:24px">
      <p class="eyebrow">${f.id ? "Edit" : "New"} ${kind === "chore" ? "chore" : "study block"}</p>
      <div class="stack">
        <div><label class="lab" for="f-title">Name</label>
          <input class="field" id="f-title" value="${esc(f.title)}" placeholder="Reading, dishwasher, piano…"></div>
        <div class="grid2">
          <div><label class="lab" for="f-child">Child</label>
            <select class="field" id="f-child">
              <option value="all" ${f.childId === "all" ? "selected" : ""}>All children</option>
              ${st.children.map(c => `<option value="${c.id}" ${c.id === f.childId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
            </select></div>
          ${f.type === "chore" ? "" : `<div><label class="lab" for="f-dur">Minutes</label>
            <input class="field" id="f-dur" type="number" min="1" max="240" value="${f.durationMin || 20}"></div>`}
          <div><label class="lab" for="f-pts">Points</label>
            <input class="field" id="f-pts" type="number" min="0" max="500" value="${f.points}"></div>
        </div>
        ${f.type === "chore" ? `<div class="meta">No set length. The child runs a timer while they work and taps done when they're finished; you check it off from the queue.</div>` : ""}
        <div class="spread" style="gap:8px">
          <label class="lab" style="margin:0">Repeats</label>
          <div class="row" style="gap:6px">
            <button type="button" class="btn small ${f.onceOn ? "" : "accent on"}" data-act="repeatMode" data-m="weekly">Weekly</button>
            <button type="button" class="btn small ${f.onceOn ? "accent on" : ""}" data-act="repeatMode" data-m="once">One-off</button>
          </div>
        </div>
        ${f.onceOn ? `<div>
          <label class="lab" for="f-once">Date</label>
          <input class="field" id="f-once" type="date" value="${esc(f.onceOn)}">
          <div class="meta" style="margin-top:6px">Appears on this day only, then retires itself.</div>
        </div>` : `<div>
          <div class="spread" style="margin-bottom:6px">
            <label class="lab" style="margin:0">Days</label>
            <div class="row" style="gap:6px">
              <button type="button" class="btn quiet small" data-act="allDays">All</button>
              <button type="button" class="btn quiet small" data-act="noDays">None</button>
            </div>
          </div>
          ${dayChips(f.days)}
          ${f.days.length ? "" : `<div class="meta" style="margin-top:8px;color:var(--warn)">No days selected — pick at least one before saving.</div>`}
        </div>`}
        <div class="row" style="justify-content:flex-end;margin-top:4px">
          ${f.id ? `<button class="btn quiet small" data-act="cancelForm">Cancel</button>` : ""}
          <button class="btn accent" data-act="saveTask">${f.id ? "Save changes" : "Add task"}</button>
        </div>
      </div>
    </div>
    ${[{ id: "all", name: "Everyone" }].concat(st.children).map(c => {
      const list = st.allTasks.filter(t => t.childId === c.id && t.type === kind);
      if (!list.length) return "";
      return `<h2 class="section-title">${esc(c.name)}</h2>
        <div class="cards">${list.map(t => `<div class="card flat">
          <div class="spread">
            <div>
              <h3>${esc(t.title)}</h3>
              <div class="meta">${t.type === "chore" ? "no set time" : t.durationMin + " min"} · ${t.points} pts · ${
                t.onceOn ? "once on " + t.onceOn : t.days.length === 7 ? "daily" : t.days.map(d => DAYS[d]).join("")}</div>
            </div>
            <div class="row">
              <button class="btn small quiet" data-act="editTask" data-id="${t.id}">Edit</button>
              <button class="btn small quiet" data-act="deleteTask" data-id="${t.id}">Remove</button>
            </div>
          </div>
        </div>`).join("")}</div>`;
    }).join("")}`;
}

function adminRewards() {
  const st = S.state;
  const f = formState("reward", { id: "", title: "", cost: 25, childIds: [], sky: "", icon: "" });
  const previewTitle = f.title || "Reward name";

  return `
    <div class="card form" style="margin-bottom:24px">
      <p class="eyebrow">${f.id ? "Edit reward" : "New reward"}</p>
      <div class="stack">
        <div><label class="lab" for="r-title">Reward</label>
          <input class="field" id="r-title" value="${esc(f.title)}" placeholder="Movie night, later bedtime…"></div>
        <div><label class="lab" for="r-cost">Cost in points</label>
          <input class="field" id="r-cost" type="number" min="1" max="10000" value="${f.cost}"></div>
        <div>
          <label class="lab">Icon</label>
          <div class="icon-picker">
            <button type="button" class="ibtn auto ${f.icon ? "" : "on"}" data-act="pickIcon" data-icon=""
              title="Chosen from the reward's name">Auto</button>
            ${REWARD_ICONS.map(i => `<button type="button" class="ibtn ${f.icon === i.id ? "on" : ""}"
              data-act="pickIcon" data-icon="${i.id}" title="${esc(i.name)}"
              aria-label="${esc(i.name)}">${iconSvg(i, 20)}</button>`).join("")}
          </div>
          <div class="meta" style="margin-top:8px">${
            f.icon ? esc(iconFor(f.title || "", f.icon).name)
                   : "Auto, from the name: " + esc(iconFor(f.title || "Reward", "").name)}</div>
        </div>
        <div>
          <label class="lab">Card sky</label>
          <div class="sky-picker">
            <button type="button" class="swatch auto ${f.sky ? "" : "on"}" data-act="pickSky" data-sky=""
              title="Chosen from the reward's name">Auto</button>
            ${SKIES.map(k => `<button type="button" class="swatch ${f.sky === k.id ? "on" : ""}"
              data-act="pickSky" data-sky="${k.id}" title="${k.name}"
              style="background:linear-gradient(160deg, ${k.from}, ${k.to})"></button>`).join("")}
          </div>
          <div class="rcard preview" style="margin-top:14px">
            ${rewardScene(previewTitle + (f.id || "preview"), "prev", f.sky)}
            <div class="rcard-body">
              <div style="min-width:0">
                <span class="rmedal">${iconSvg(iconFor(previewTitle, f.icon), 20)}</span>
                <h3>${esc(previewTitle)}</h3>
                <div class="cost">${f.cost || 0} POINTS</div>
              </div>
            </div>
          </div>
        </div>
        <div><label class="lab">Who can redeem it</label>
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <button type="button" class="btn small ${f.childIds.length === 0 ? "accent on" : ""}" data-act="toggleChild" data-id="all">Everyone</button>
            ${st.children.map(c => `<button type="button" class="btn small ${f.childIds.includes(c.id) ? "accent on" : ""}"
              data-act="toggleChild" data-id="${c.id}">${esc(c.name)}</button>`).join("")}
          </div></div>
        <div class="row" style="justify-content:flex-end;margin-top:4px">
          ${f.id ? `<button class="btn quiet small" data-act="cancelForm">Cancel</button>` : ""}
          <button class="btn accent" data-act="saveReward">${f.id ? "Save changes" : "Add reward"}</button>
        </div>
      </div>
    </div>
    <div class="cards">${st.rewards.map(r => `<div class="card flat">
      <div class="spread">
        <div>
          <h3>${esc(r.title)}</h3>
          <div class="meta">${r.cost} pts · ${r.childIds.length ? r.childIds.map(cid => (st.children.find(c => c.id === cid) || {}).name).join(", ") : "everyone"} · ${esc(iconFor(r.title, r.icon).name.toLowerCase())} · ${esc(skyFor(r.title + r.id, r.sky).name.toLowerCase())}</div>
        </div>
        <div class="row">
          <button class="btn small quiet" data-act="editReward" data-id="${r.id}">Edit</button>
          <button class="btn small quiet" data-act="deleteReward" data-id="${r.id}">Remove</button>
        </div>
      </div>
    </div>`).join("")}</div>`;
}

function adminFamily() {
  const st = S.state;
  const f = formState("user", { id: "", name: "", role: "child", color: "ochre", pin: "" });

  const person = u => `<div class="card flat">
    <div class="spread">
      <div class="row">
        <span class="avatar sm" data-color="${esc(u.color)}">${esc(initials(u.name))}</span>
        <div>
          <h3>${esc(u.name)}</h3>
          <div class="meta">${u.role === "admin" ? "parent"
            : u.allowanceRemaining + "/" + u.allowanceWeekly + " allowance · " + u.earned + " saved"}</div>
        </div>
      </div>
      <div class="row">
        ${u.role === "child" ? `<button class="btn small quiet" data-act="adjust" data-id="${u.id}" data-delta="-5">−5</button>
        <button class="btn small quiet" data-act="adjust" data-id="${u.id}" data-delta="5">+5</button>` : ""}
        <button class="btn small quiet" data-act="editUser" data-id="${u.id}">Edit</button>
        ${u.id === st.me.id ? "" : `<button class="btn small quiet" data-act="deleteUser" data-id="${u.id}">Remove</button>`}
      </div>
    </div>
  </div>`;

  return `
    <div class="card form" style="margin-bottom:24px">
      <p class="eyebrow">${f.id ? "Edit person" : "Add someone"}</p>
      <div class="stack">
        <div><label class="lab" for="u-name">Name</label>
          <input class="field" id="u-name" value="${esc(f.name)}"></div>
        <div class="grid2">
          <div><label class="lab" for="u-role">Role</label>
            <select class="field" id="u-role" data-act="roleChanged" ${f.id ? "disabled" : ""}>
              <option value="child" ${f.role === "child" ? "selected" : ""}>Child</option>
              <option value="admin" ${f.role === "admin" ? "selected" : ""}>Parent / guardian</option>
            </select></div>
          <div><label class="lab" for="u-pin">PIN ${f.id ? "(blank keeps current)" : ""}</label>
            <input class="field" id="u-pin" type="password" inputmode="numeric" autocomplete="new-password" placeholder="4+ digits"></div>
        </div>
        ${f.role === "child" ? `<div><label class="lab" for="u-allow">Weekly allowance</label>
          <input class="field" id="u-allow" type="number" min="0" max="100000" value="${f.allowanceWeekly === undefined ? 500 : f.allowanceWeekly}">
          <div class="meta" style="margin-top:6px">Renews every ${esc((st.children[0] || {}).renewsOn || "Monday")}. Unspent allowance doesn't carry over. Lowering it applies now; raising it applies at the next renewal.</div></div>` : ""}
        <div><label class="lab">Colour</label>
          <div class="row" style="gap:8px;flex-wrap:wrap">
            ${COLORS.map(c => `<button type="button" class="btn small ${f.color === c ? "on" : ""}" data-act="pickColor" data-c="${c}">
              <span class="avatar sm" data-color="${c}" style="width:18px;height:18px;box-shadow:none">●</span></button>`).join("")}
          </div></div>
        <div class="row" style="justify-content:flex-end;margin-top:4px">
          ${f.id ? `<button class="btn quiet small" data-act="cancelForm">Cancel</button>` : ""}
          <button class="btn accent" data-act="saveUser">${f.id ? "Save changes" : "Add person"}</button>
        </div>
      </div>
    </div>
    <div class="card flat form" style="margin-bottom:24px">
      <div class="spread">
        <div>
          <h3>Week starts on</h3>
          <div class="meta">When every child's allowance renews</div>
        </div>
        <div class="row">
          <button class="btn small ${st.settings.weekStartsOn === 0 ? "accent on" : ""}" data-act="weekStart" data-d="0">Sunday</button>
          <button class="btn small ${st.settings.weekStartsOn === 1 ? "accent on" : ""}" data-act="weekStart" data-d="1">Monday</button>
        </div>
      </div>
    </div>
    <h2 class="section-title">Children</h2>
    ${st.children.length ? `<div class="cards">${st.children.map(person).join("")}</div>` : `<p class="empty">No children yet.</p>`}
    <h2 class="section-title">Parents and guardians</h2>
    <div class="cards">${st.admins.map(person).join("")}</div>
    <p class="meta mono" style="text-align:center;margin-top:28px;font-size:10px;color:var(--muted)">
      build ${esc(String(st.version || "dev").slice(0, 12))}
    </p>`;
}

/* ---------- render ---------- */

function isTyping() {
  const a = document.activeElement;
  return a && (a.tagName === "INPUT" || a.tagName === "SELECT");
}

// A re-render rebuilds the DOM, so pull anything half-typed back into state first.
function captureForm() {
  if (!S.form) return;
  if (S.form.kind === "event") readEventForm(S.form);
  else if (S.form.kind === "task") readTaskForm(S.form);
  else if (S.form.kind === "reward") readRewardForm(S.form);
  else if (S.form.kind === "user") readUserForm(S.form);
}

function viewKey() {
  return [S.view, S.tab, S.day || "", S.focus || "", S.month || ""].join("|");
}

function render() {
  captureForm();
  // Entrance animations run when you move somewhere new. A background refresh
  // rebuilds the same DOM, and replaying them every six seconds would twitch.
  S.entering = viewKey() !== S.lastKey;
  S.lastKey = viewKey();
  let html;
  if (S.view === "loading") html = `<p class="empty" style="padding-top:60px">Loading…</p>`;
  else if (S.view === "login") html = loginView();
  else if (S.view === "child") html = S.focus ? focusView() : childView();
  else html = adminView();

  root.innerHTML = html + (S.toast ? `<div class="toast">${esc(S.toast)}</div>` : "");
  // One-shot flags: clear them so the next render is calm.
  S.bump = false;
  if (S.justDone.length) setTimeout(() => { S.justDone = []; }, 900);
}

/* ---------- ticking ---------- */

function tick() {
  if (!S.state) return;
  const pool = S.state.tasks || (S.state.board || []).flatMap(b => b.tasks);
  let needsSync = false;

  for (const t of pool) {
    if (!t.running) continue;
    const chore = t.type === "chore";
    const total = chore ? 0 : t.durationMin * 60000;
    // A chore has no end, so it never needs a sync to settle.
    const left = chore ? liveElapsed(t) : total - liveElapsed(t);
    if (!chore && left <= 0) needsSync = true;

    const mini = document.querySelector(`.js-ring[data-id="${t.id}"] .js-mini`);
    if (mini) mini.textContent = clock(Math.max(0, left));
    if (!chore) {
      const arcs = document.querySelectorAll(`.js-ring[data-id="${t.id}"] .js-arc`);
      arcs.forEach(a => {
        const c = parseFloat(a.getAttribute("stroke-dasharray"));
        a.setAttribute("stroke-dashoffset", (c * (1 - Math.min(1, liveElapsed(t) / total))).toFixed(1));
      });
    }

    if (S.focus === t.id) {
      const out = el(".js-readout");
      if (out) out.textContent = clock(Math.max(0, left));
      const arc = chore ? null : document.querySelector(".dial .js-arc");
      if (arc) {
        const c = parseFloat(arc.getAttribute("stroke-dasharray"));
        arc.setAttribute("stroke-dashoffset", (c * (1 - Math.min(1, liveElapsed(t) / total))).toFixed(1));
      }
    }
  }
  if (needsSync) refresh();
}

async function refresh(silent) {
  try {
    captureForm();
    setState(await get("state"));
    if (S.day && S.day !== S.state.date) {
      try { S.dayData = await post("day", { date: S.day }); } catch (err) { /* keep what we have */ }
    }
    if (silent && isTyping()) return;
    render();
  } catch (e) {
    if (String(e.message).includes("Sign in")) { S.view = "login"; S.state = null; render(); }
  }
}

setInterval(tick, 250);
setInterval(() => { if (S.state) refresh(true); }, 6000);



/* ---------- completion signal ---------- */

// The audio context is created on a tap (starting a timer), so browsers allow
// it to make noise later when the timer actually finishes.
let audio = null;
const chimed = new Set();

function wakeAudio() {
  if (audio || typeof window.AudioContext !== "function" && typeof window.webkitAudioContext !== "function") return;
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
  } catch (err) {
    audio = null;
  }
}

function chime() {
  if (audio && audio.state === "suspended") audio.resume();
  if (audio) {
    // Two soft notes a fifth apart, short enough not to startle anyone.
    [[660, 0], [990, 0.16]].forEach(([freq, delay]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = audio.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }
  if (navigator.vibrate) navigator.vibrate([90, 60, 90]);
}

function notifyFinished(tasks) {
  for (const t of tasks) {
    const key = t.key || t.id;
    if (t.status === "done" || t.status === "awaiting") {
      if (chimed.has(key) === false && chimed.has("seen:" + key)) { chime(); S.justDone.push(t.id); }
      chimed.add("seen:" + key);
      chimed.add(key);
    } else {
      chimed.add("seen:" + key);
      chimed.delete(key);
    }
  }
}

/* ---------- parallax ---------- */

// Pointer drives the tilt; untouched cards drift on their own so the grid
// isn't dead on a phone, where there's no pointer at all.
const parallax = { hovered: null, phase: Math.random() * Math.PI * 2 };

function tiltCard(card, x, y) {
  const layers = card.querySelectorAll(".player");
  const tiltY = (x - 0.5) * 22;
  layers.forEach((layer, i) => {
    const moveX = (x - 0.5) * i * 13;
    const moveY = (y - 0.5) * i * 6;
    layer.style.transform =
      `translate(${moveX.toFixed(2)}px, ${moveY.toFixed(2)}px) rotateY(${tiltY.toFixed(2)}deg)`;
  });
}

function driftFrame() {
  if (!reducedMotion()) {
    parallax.phase += 0.006;
    const cards = document.querySelectorAll(".rcard");
    cards.forEach((card, i) => {
      if (card === parallax.hovered) return;
      const x = Math.sin(parallax.phase + i * 0.7) * 0.5 + 0.5;
      tiltCard(card, x, 0.5);
    });
  }
  requestAnimationFrame(driftFrame);
}

function reducedMotion() {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

if (typeof requestAnimationFrame === "function") requestAnimationFrame(driftFrame);

root.addEventListener("pointermove", e => {
  const card = e.target.closest(".rcard");
  if (!card) return;
  const rect = card.getBoundingClientRect();
  parallax.hovered = card;
  card.classList.add("live");
  tiltCard(card, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
});

root.addEventListener("pointerleave", e => {
  const card = e.target.closest && e.target.closest(".rcard");
  if (card) card.classList.remove("live");
  if (parallax.hovered === card) parallax.hovered = null;
}, true);

/* ---------- events ---------- */

async function reloadMonth() {
  const anchor = monthAnchor();
  try {
    S.monthData = await post("month", { date: anchor });
    if (S.day && S.day !== S.state.date) S.dayData = await post("day", { date: S.day });
  } catch (err) { /* leave what we have */ }
  render();
}

function readEventForm(f) {
  if (el("#e-title")) {
    f.title = val("e-title");
    if (el("#e-date")) { f.date = val("e-date"); f.dates = [f.date]; }
    f.time = val("e-time");
    f.note = val("e-note");
  }
  if (!Array.isArray(f.childIds)) f.childIds = [];
}

function formState(kind, seed) {
  if (!S.form || S.form.kind !== kind) S.form = Object.assign({ kind }, seed);
  return S.form;
}

root.addEventListener("click", async e => {
  const node = e.target.closest("[data-act]");
  if (!node) return;
  const act = node.dataset.act;
  if (!act) return;

  try {
    switch (act) {
      case "pick":
        S.pick = S.profiles.find(p => p.id === node.dataset.id);
        S.pin = ""; S.err = ""; return render();
      case "unpick": S.pick = null; S.pin = ""; S.err = ""; return render();
      case "digit":
        if (S.pin.length < 12) S.pin += node.dataset.d;
        render();
        if (S.pin.length === 4) submitPin();
        return;
      case "del": S.pin = S.pin.slice(0, -1); S.err = ""; return render();

      case "theme": cycleTheme(); return render();
      case "pickDay": {
        const date = node.dataset.date;
        if (S.selecting) {
          S.sel = S.sel.includes(date)
            ? S.sel.filter(d => d !== date)
            : [...S.sel, date].sort();
          return render();
        }
        S.day = date;
        if (date === S.state.date) { S.dayData = null; return render(); }
        render();
        S.dayData = await post("day", { date });
        return render();
      }
      case "selectMode":
        S.selecting = node.dataset.on === "1";
        if (!S.selecting) S.sel = [];
        S.form = null;
        return render();
      case "clearSel": S.sel = []; return render();
      case "unpickSel":
        S.sel = S.sel.filter(d => d !== node.dataset.date);
        return render();
      case "addRange":
      case "removeRange": {
        const from = val("r-from"), to = val("r-to");
        if (!from || !to) return toast("Pick both dates.");
        const span = datesBetween(from, to);
        if (!span.length) return toast("That range is the wrong way round.");
        if (span.length > 366) return toast("That's more than a year.");
        S.rangeFrom = from; S.rangeTo = to;
        S.sel = act === "addRange"
          ? [...new Set(S.sel.concat(span))].sort()
          : S.sel.filter(d => !span.includes(d));
        return render();
      }
      case "selWeekdays":
      case "selWeekends": {
        const wantWeekend = act === "selWeekends";
        const from = val("r-from") || S.state.date, to = val("r-to") || S.state.date;
        const span = datesBetween(from, to).filter(d => {
          const dow = new Date(d + "T12:00:00").getDay();
          return wantWeekend ? (dow === 0 || dow === 6) : (dow > 0 && dow < 6);
        });
        if (!span.length) return toast("Nothing in that range.");
        S.rangeFrom = from; S.rangeTo = to;
        S.sel = [...new Set(S.sel.concat(span))].sort();
        return render();
      }
      case "month": {
        S.month = shiftMonth(monthAnchor(), +node.dataset.d);
        S.monthData = null;
        return render();
      }
      case "monthPicker": S.picking = !S.picking; return render();
      case "pickYear": {
        S.month = shiftMonth(monthAnchor(), 12 * (+node.dataset.d));
        S.monthData = null;
        return render();
      }
      case "pickMonth": {
        const anchor = monthAnchor();
        S.month = `${anchor.slice(0, 4)}-${String(+node.dataset.m + 1).padStart(2, "0")}-01`;
        S.monthData = null;
        S.picking = false;
        return render();
      }
      case "monthToday": {
        S.month = S.state.date.slice(0, 8) + "01";
        S.day = S.state.date;
        S.dayData = null;
        S.monthData = null;
        S.picking = false;
        return render();
      }
      case "newEvent":
        S.form = {
          kind: "event", id: "", title: "", time: "", note: "", childIds: [],
          date: node.dataset.date,
          dates: S.sel.length ? S.sel.slice() : [node.dataset.date],
        };
        return render();
      case "editEvent": {
        const ev = (S.monthData.days.flatMap(d => d.events)).find(e => e.id === node.dataset.id);
        S.form = Object.assign({ kind: "event" }, ev);
        return render();
      }
      case "saveEvent": {
        const f = S.form && S.form.kind === "event" ? S.form : { kind: "event", childIds: [] };
        readEventForm(f);
        if (!f.title) return toast("Give it a name.");
        const result = await post("saveEvent", f);
        const n = result.count || 1;
        S.form = null;
        if (!f.id) { S.sel = []; S.selecting = false; }
        await reloadMonth();
        return toast(f.id ? "Updated" : n > 1 ? `Added to ${n} days` : "Added");
      }
      case "eventWho": {
        const f = S.form && S.form.kind === "event" ? S.form : null;
        if (!f) return;
        readEventForm(f);
        if (node.dataset.id === "all") f.childIds = [];
        else f.childIds = (f.childIds || []).includes(node.dataset.id)
          ? f.childIds.filter(x => x !== node.dataset.id)
          : (f.childIds || []).concat(node.dataset.id);
        return render();
      }
      case "toggleEvent":
        await post("toggleEvent", { id: node.dataset.id });
        if (S.state.me.role === "child") return refresh();
        return reloadMonth();
      case "deleteEvent":
        if (!confirm("Remove this?")) return;
        await post("deleteEvent", { id: node.dataset.id });
        return reloadMonth();
      case "deleteSeries": {
        if (!confirm("Remove this from every day it's on?")) return;
        const r = await post("deleteEvent", { id: node.dataset.id, group: true });
        await reloadMonth();
        return toast(`Removed from ${r.removed} days`);
      }
      case "credit":
        await post("credit", {
          taskId: node.dataset.task, childId: node.dataset.child, date: node.dataset.date,
        });
        await refresh();
        await reloadMonth();
        return toast("Marked done");
      case "tab": S.tab = +node.dataset.i; S.form = null; S.day = null; S.dayData = null; return render();
      case "taskKind": S.taskKind = node.dataset.k; S.form = null; return render();
      case "logout":
        await post("logout"); S.state = null; S.pick = null; S.view = "login";
        S.profiles = (await get("profiles")).profiles; return render();

      case "open": wakeAudio(); S.focus = node.dataset.id; {
        const t = taskById(S.focus);
        render();
        if (t && !t.running && t.status !== "done" && t.status !== "awaiting") {
          setState(await post("start", { taskId: t.id })); render();
        }
      } return;
      case "closeFocus": S.focus = null; return render();
      case "submit":
        setState(await post("submit", { taskId: node.dataset.id }));
        S.focus = null;
        toast("Sent to a parent to check off"); return;
      case "start": wakeAudio(); setState(await post("start", { taskId: node.dataset.id })); return render();
      case "pause": setState(await post("pause", { taskId: node.dataset.id })); return render();

      case "approve": setState(await post("approve", { key: node.dataset.key })); toast("Checked off"); return;
      case "undo": setState(await post("undo", { key: node.dataset.key })); toast("Undone"); return;
      case "reject": setState(await post("reject", { key: node.dataset.key })); toast("Sent back"); return;
      case "excuse":
        if (!confirm("Mark this done without points?")) return;
        setState(await post("excuse", { key: node.dataset.key })); return render();
      case "weekStart":
        setState(await post("settings", { weekStartsOn: +node.dataset.d }));
        toast("Allowance renews on " + (node.dataset.d === "0" ? "Sunday" : "Monday")); return;
      case "adjust": setState(await post("adjust", { childId: node.dataset.id, delta: +node.dataset.delta })); return render();

      case "redeem": setState(await post("redeem", { rewardId: node.dataset.id })); toast("Sent to a parent"); return;
      case "fulfill": setState(await post("fulfill", { id: node.dataset.id })); toast("Marked as given"); return;
      case "denyRedemption": setState(await post("denyRedemption", { id: node.dataset.id })); toast("Points refunded"); return;

      case "repeatMode": {
        const f = formState("task", { days: [0, 1, 2, 3, 4, 5, 6] });
        readTaskForm(f);
        f.onceOn = node.dataset.m === "once" ? (S.state.date || "") : null;
        return render();
      }
      case "allDays": {
        const f = formState("task", { days: [] });
        readTaskForm(f);
        f.days = [0, 1, 2, 3, 4, 5, 6];
        return render();
      }
      case "noDays": {
        const f = formState("task", { days: [] });
        readTaskForm(f);
        f.days = [];
        return render();
      }
      case "toggleDay": {
        const f = formState("task", { days: [] });
        const i = +node.dataset.i;
        f.days = f.days.includes(i) ? f.days.filter(d => d !== i) : f.days.concat(i).sort();
        readTaskForm(f); return render();
      }
      case "pickIcon": {
        const f = formState("reward", { childIds: [] });
        readRewardForm(f);
        f.icon = node.dataset.icon;
        return render();
      }
      case "pickSky": {
        const f = formState("reward", { childIds: [] });
        readRewardForm(f);
        f.sky = node.dataset.sky;
        return render();
      }
      case "toggleChild": {
        const f = formState("reward", { childIds: [] });
        readRewardForm(f);
        if (node.dataset.id === "all") f.childIds = [];
        else f.childIds = f.childIds.includes(node.dataset.id)
          ? f.childIds.filter(x => x !== node.dataset.id)
          : f.childIds.concat(node.dataset.id);
        return render();
      }
      case "roleChanged": { const f = formState("user", {}); readUserForm(f); f.role = val("u-role"); return render(); }
      case "pickColor": { const f = formState("user", {}); readUserForm(f); f.color = node.dataset.c; return render(); }
      case "cancelForm": S.form = null; return render();

      case "editTask": {
        const t = S.state.allTasks.find(x => x.id === node.dataset.id);
        S.taskKind = t.type;
        S.form = Object.assign({ kind: "task" }, t); return render();
      }
      case "saveTask": {
        const f = formState("task", { id: "", days: [0, 1, 2, 3, 4, 5, 6] });
        readTaskForm(f);
        if (!f.onceOn && !f.days.length) return toast("Pick at least one day.");
        if (f.onceOn && !/^\d{4}-\d{2}-\d{2}$/.test(f.onceOn)) return toast("Pick a date for the one-off.");
        setState(await post("saveTask", f));
        S.form = null; toast(f.id ? "Task updated" : "Task added"); return;
      }
      case "deleteTask":
        if (!confirm("Remove this task?")) return;
        setState(await post("deleteTask", { id: node.dataset.id })); return render();

      case "editReward": {
        const r = S.state.rewards.find(x => x.id === node.dataset.id);
        S.form = Object.assign({ kind: "reward", sky: "", icon: "" }, r); return render();
      }
      case "saveReward": {
        const f = formState("reward", { id: "", childIds: [] });
        readRewardForm(f);
        setState(await post("saveReward", f));
        S.form = null; toast(f.id ? "Reward updated" : "Reward added"); return;
      }
      case "deleteReward":
        if (!confirm("Remove this reward?")) return;
        setState(await post("deleteReward", { id: node.dataset.id })); return render();

      case "editUser": {
        const u = [...S.state.children, ...S.state.admins].find(x => x.id === node.dataset.id);
        S.form = Object.assign({ kind: "user", pin: "" }, u); return render();
      }
      case "saveUser": {
        const f = formState("user", { id: "", color: "ochre" });
        readUserForm(f);
        setState(await post("saveUser", f));
        S.form = null; toast("Saved"); return;
      }
      case "deleteUser":
        if (!confirm("Remove this person and their tasks?")) return;
        setState(await post("deleteUser", { id: node.dataset.id })); return render();
    }
  } catch (err) {
    toast(err.message);
  }
});

function val(id) { const n = el("#" + id); return n ? n.value : ""; }

function readTaskForm(f) {
  if (el("#f-title")) {
    f.title = val("f-title");
    f.childId = val("f-child");
    f.points = +val("f-pts");
    if (el("#f-dur")) f.durationMin = +val("f-dur");
    // Only read the date while the form is actually in one-off mode, or the
    // capture that runs before every render undoes a switch back to weekly.
    if (el("#f-once") && f.onceOn) f.onceOn = val("f-once");
  }
  // An empty selection stays empty — clearing the days is a legitimate step
  // on the way to picking one, not a signal to select them all.
  if (!Array.isArray(f.days)) f.days = [];
}

function readRewardForm(f) {
  if (el("#r-title")) { f.title = val("r-title"); f.cost = +val("r-cost"); }
  if (!f.childIds) f.childIds = [];
  if (f.sky === undefined) f.sky = "";
  if (f.icon === undefined) f.icon = "";
}

function readUserForm(f) {
  if (el("#u-name")) {
    f.name = val("u-name");
    f.pin = val("u-pin");
    if (!f.id) f.role = val("u-role");
    if (el("#u-allow")) f.allowanceWeekly = +val("u-allow");
  }
}

root.addEventListener("change", e => {
  const node = e.target.closest("[data-act]");
  if (node && node.dataset.act === "roleChanged") {
    const f = formState("user", {});
    readUserForm(f);
    f.role = node.value;
    render();
  }
});

document.addEventListener("keydown", e => {
  if (S.view === "login" && S.pick) {
    if (/^[0-9]$/.test(e.key) && S.pin.length < 12) {
      S.pin += e.key; render();
      if (S.pin.length === 4) submitPin();
    } else if (e.key === "Backspace") { S.pin = S.pin.slice(0, -1); render(); }
    else if (e.key === "Escape") { S.pick = null; S.pin = ""; render(); }
  } else if (e.key === "Escape" && S.focus) { S.focus = null; render(); }
});

/* ---------- boot ---------- */

(async function boot() {
  try {
    setState(await get("state"));
  } catch (e) {
    S.view = "login";
    S.profiles = (await get("profiles")).profiles;
  }
  render();
})();
