"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const VERSION = process.env.HEARTH_VERSION || "dev";
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
/* ---------- embedded frontend ---------- */

const ASSETS = {
  "/index.html": { type: "text/html; charset=utf-8", body: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#DDE3DD\">\n<title>Hearth</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link href=\"https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap\" rel=\"stylesheet\">\n<link rel=\"stylesheet\" href=\"/styles.css\">\n</head>\n<body>\n<div id=\"root\"></div>\n<script src=\"/app.js\"></script>\n</body>\n</html>\n" },
  "/styles.css": { type: "text/css; charset=utf-8", body: ":root {\n  --bg: #DDE3DD;\n  --light: #F1F7F0;\n  --dark: #B3BCB3;\n  --track: #CBD3CB;\n  --ink: #363E38;\n  --muted: #6E7970;\n  --accent: #A8752A;\n  --accent-ink: #855C1C;\n  --good: #4B7A5C;\n  --warn: #A05A3C;\n  --out: 7px 7px 16px var(--dark), -7px -7px 16px var(--light);\n  --out-sm: 4px 4px 9px var(--dark), -4px -4px 9px var(--light);\n  --out-xs: 2px 2px 5px var(--dark), -2px -2px 5px var(--light);\n  --in: inset 5px 5px 11px var(--dark), inset -5px -5px 11px var(--light);\n  --in-sm: inset 3px 3px 6px var(--dark), inset -3px -3px 6px var(--light);\n  --mono: \"JetBrains Mono\", ui-monospace, SFMono-Regular, monospace;\n}\n\n@media (prefers-color-scheme: dark) {\n  :root {\n    --bg: #262B27;\n    --light: #30362F;\n    --dark: #1A1E1B;\n    --track: #20241F;\n    --ink: #DDE4DD;\n    --muted: #939E95;\n    --accent: #D8A24E;\n    --accent-ink: #E4B76F;\n    --good: #86B999;\n    --warn: #DA9A78;\n  }\n}\n\n* { box-sizing: border-box; }\n\nhtml, body { height: 100%; }\n\nbody {\n  margin: 0;\n  background: var(--bg);\n  color: var(--ink);\n  font-family: \"Familjen Grotesk\", system-ui, -apple-system, sans-serif;\n  font-size: 15px;\n  -webkit-font-smoothing: antialiased;\n}\n\nbutton { font: inherit; color: inherit; cursor: pointer; }\ninput, select { font: inherit; color: inherit; }\n\n:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }\n\n.wrap { max-width: 720px; margin: 0 auto; padding: 26px 20px 90px; }\n\n/* ---- primitives ---- */\n\n.raised { background: var(--bg); border-radius: 20px; box-shadow: var(--out); }\n.sunk { border-radius: 20px; box-shadow: var(--in-sm); }\n\n.btn {\n  appearance: none; border: 0; background: var(--bg);\n  padding: 11px 18px; border-radius: 14px;\n  box-shadow: var(--out-sm); font-size: 14px;\n  transition: box-shadow 160ms ease, color 160ms ease;\n}\n.btn:active, .btn.on { box-shadow: var(--in-sm); }\n.btn.accent { color: var(--accent-ink); font-weight: 500; }\n.btn.quiet { color: var(--muted); box-shadow: none; padding: 8px 12px; }\n.btn.quiet:hover { color: var(--ink); }\n.btn.small { padding: 8px 13px; font-size: 13px; border-radius: 12px; }\n.btn[disabled] { color: var(--muted); box-shadow: var(--in-sm); cursor: not-allowed; opacity: .75; }\n\n.chip {\n  font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em;\n  padding: 5px 10px; border-radius: 999px; box-shadow: var(--in-sm); color: var(--muted);\n}\n.chip.live { color: var(--accent-ink); }\n.chip.done { color: var(--good); }\n.chip.await { color: var(--warn); }\n\n.eyebrow {\n  font-family: var(--mono); font-size: 10.5px; letter-spacing: .14em;\n  color: var(--muted); margin: 0 0 12px;\n}\n\n.field {\n  width: 100%; border: 0; background: var(--bg);\n  padding: 11px 14px; border-radius: 13px; box-shadow: var(--in-sm);\n}\n.field::placeholder { color: var(--muted); }\n\nlabel.lab { display: block; font-size: 12.5px; color: var(--muted); margin-bottom: 6px; }\n\n.row { display: flex; align-items: center; gap: 12px; }\n.spread { display: flex; align-items: center; justify-content: space-between; gap: 12px; }\n.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }\n.stack > * + * { margin-top: 12px; }\n.muted { color: var(--muted); }\n.mono { font-family: var(--mono); }\n.hide { display: none !important; }\n\n/* ---- app header ---- */\n\n.top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }\n.brand { display: flex; align-items: center; gap: 12px; }\n.brand h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.02em; margin: 0; }\n.brand .date { font-family: var(--mono); font-size: 10.5px; color: var(--muted); letter-spacing: .06em; }\n\n.avatar {\n  width: 44px; height: 44px; border-radius: 50%;\n  display: grid; place-items: center; font-weight: 600; font-size: 15px;\n  background: var(--bg); box-shadow: var(--out-sm); color: var(--accent-ink);\n}\n.avatar.lg { width: 66px; height: 66px; font-size: 22px; box-shadow: var(--out); }\n.avatar.sm { width: 34px; height: 34px; font-size: 12.5px; box-shadow: var(--out-xs); }\n.avatar[data-color=\"ochre\"] { color: #A8752A; }\n.avatar[data-color=\"clay\"] { color: #A85B3E; }\n.avatar[data-color=\"sage\"] { color: #4B7A5C; }\n.avatar[data-color=\"slate\"] { color: #4C6B86; }\n.avatar[data-color=\"plum\"] { color: #7A5580; }\n\n.points {\n  display: inline-flex; align-items: baseline; gap: 6px;\n  padding: 9px 16px; border-radius: 999px; box-shadow: var(--in-sm);\n}\n.points b { font-size: 17px; font-weight: 600; letter-spacing: -0.02em; }\n.points span { font-family: var(--mono); font-size: 10px; letter-spacing: .1em; color: var(--muted); }\n\n/* ---- tabs ---- */\n\n.tabs {\n  position: relative; display: grid; padding: 5px;\n  border-radius: 16px; box-shadow: var(--in-sm); margin-bottom: 24px;\n}\n.tabs .thumb {\n  position: absolute; top: 5px; left: 5px; bottom: 5px;\n  border-radius: 12px; background: var(--bg); box-shadow: var(--out-sm);\n  transition: transform 340ms cubic-bezier(.34, 1.3, .5, 1);\n}\n.tabs button {\n  position: relative; z-index: 1; border: 0; background: none;\n  padding: 10px 4px; font-size: 13.5px; color: var(--muted);\n  border-radius: 12px; transition: color 200ms ease;\n}\n.tabs button[aria-selected=\"true\"] { color: var(--accent-ink); font-weight: 500; }\n\n/* ---- task cards ---- */\n\n.card { background: var(--bg); border-radius: 20px; box-shadow: var(--out); padding: 16px 18px; }\n.card + .card { margin-top: 14px; }\n.card.flat { box-shadow: var(--in-sm); }\n.card h3 { margin: 0; font-size: 15.5px; font-weight: 500; letter-spacing: -0.01em; }\n.card .meta { font-family: var(--mono); font-size: 10.5px; color: var(--muted); letter-spacing: .05em; margin-top: 4px; }\n\n.ring { position: relative; width: 54px; height: 54px; flex: 0 0 54px; border-radius: 50%; box-shadow: var(--in-sm); }\n.ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }\n.ring svg circle { fill: none; stroke-linecap: round; }\n.ring .label {\n  position: absolute; inset: 0; display: grid; place-items: center;\n  font-family: var(--mono); font-size: 10px; color: var(--muted);\n}\n.ring .label.on { color: var(--accent-ink); }\n\n.pad { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; border: 0; background: var(--bg); box-shadow: var(--out-sm); color: var(--muted); transition: box-shadow 160ms ease, color 160ms ease; }\n.pad:hover { color: var(--ink); }\n.pad:active { box-shadow: var(--in-sm); }\n.pad.accent { color: var(--accent-ink); }\n.pad svg { width: 17px; height: 17px; fill: currentColor; }\n.pad[disabled] { box-shadow: var(--in-sm); cursor: default; }\n\n.section-title { font-size: 13px; color: var(--muted); margin: 26px 0 12px; font-weight: 500; }\n.section-title:first-child { margin-top: 0; }\n\n/* ---- focus overlay ---- */\n\n.overlay {\n  position: fixed; inset: 0; z-index: 40; background: var(--bg);\n  display: flex; flex-direction: column; align-items: center; justify-content: center;\n  padding: 24px; gap: 26px;\n}\n.dial { position: relative; width: 280px; height: 280px; border-radius: 50%; box-shadow: var(--in); }\n.dial svg { position: absolute; inset: 0; transform: rotate(-90deg); }\n.dial svg circle { fill: none; stroke-linecap: round; }\n.dial .face {\n  position: absolute; inset: 30px; border-radius: 50%;\n  background: var(--bg); box-shadow: var(--out);\n  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;\n}\n.readout { font-size: 54px; font-weight: 500; letter-spacing: -0.035em; font-variant-numeric: tabular-nums; line-height: 1; }\n.caption { font-family: var(--mono); font-size: 10.5px; letter-spacing: .12em; color: var(--muted); text-align: center; }\n.key {\n  width: 78px; height: 78px; border-radius: 50%; border: 0; background: var(--bg);\n  display: grid; place-items: center; box-shadow: var(--out); color: var(--accent-ink);\n  transition: box-shadow 180ms ease;\n}\n.key:active, .key.on { box-shadow: var(--in); }\n.key svg { width: 26px; height: 26px; fill: currentColor; }\n.key[disabled] { color: var(--muted); box-shadow: var(--in); cursor: default; }\n\n/* ---- login ---- */\n\n.login { min-height: 100%; display: grid; place-items: center; padding: 40px 20px; }\n.login .panel { width: 100%; max-width: 380px; padding: 30px 28px; border-radius: 30px; box-shadow: var(--out); }\n.profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 14px; }\n.profile {\n  border: 0; background: var(--bg); border-radius: 20px; box-shadow: var(--out-sm);\n  padding: 16px 8px; display: flex; flex-direction: column; align-items: center; gap: 9px;\n  transition: box-shadow 160ms ease;\n}\n.profile:active { box-shadow: var(--in-sm); }\n.profile .nm { font-size: 13.5px; font-weight: 500; }\n.profile .rl { font-family: var(--mono); font-size: 9.5px; letter-spacing: .1em; color: var(--muted); }\n\n.pin-dots { display: flex; justify-content: center; gap: 13px; margin: 22px 0 26px; }\n.pin-dots i { width: 13px; height: 13px; border-radius: 50%; box-shadow: var(--in-sm); }\n.pin-dots i.filled { background: var(--accent); box-shadow: var(--out-xs); }\n.keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 13px; }\n.keypad button {\n  border: 0; background: var(--bg); border-radius: 18px; padding: 15px 0;\n  font-size: 20px; font-weight: 500; box-shadow: var(--out-sm);\n  transition: box-shadow 130ms ease;\n}\n.keypad button:active { box-shadow: var(--in-sm); }\n.keypad button.util { font-size: 13px; color: var(--muted); box-shadow: none; }\n\n.err { color: var(--warn); font-size: 13px; min-height: 18px; text-align: center; }\n\n.toast {\n  position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%);\n  padding: 12px 20px; border-radius: 14px; background: var(--bg); box-shadow: var(--out);\n  font-size: 13.5px; z-index: 60; max-width: 90vw;\n}\n\n.empty { text-align: center; color: var(--muted); font-size: 13.5px; padding: 30px 10px; }\n\n@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }\n\n@media (max-width: 420px) {\n  .dial { width: 244px; height: 244px; }\n  .readout { font-size: 46px; }\n}\n" },
  "/app.js": { type: "text/javascript; charset=utf-8", body: "\"use strict\";\n\nconst root = document.getElementById(\"root\");\nconst DAYS = [\"S\", \"M\", \"T\", \"W\", \"T\", \"F\", \"S\"];\nconst COLORS = [\"ochre\", \"clay\", \"sage\", \"slate\", \"plum\"];\n\nconst S = {\n  view: \"loading\",\n  profiles: [],\n  pick: null,\n  pin: \"\",\n  err: \"\",\n  state: null,\n  tab: 0,\n  focus: null,\n  fetchedAt: 0,\n  form: null,\n  toast: \"\",\n  taskKind: \"study\",\n};\n\n/* ---------- helpers ---------- */\n\nconst esc = s => String(s == null ? \"\" : s).replace(/[&<>\"']/g, c =>\n  ({ \"&\": \"&amp;\", \"<\": \"&lt;\", \">\": \"&gt;\", '\"': \"&quot;\", \"'\": \"&#39;\" }[c]));\n\nconst initials = name => name.trim().split(/\\s+/).map(w => w[0]).join(\"\").slice(0, 2).toUpperCase();\n\nconst clock = ms => {\n  const s = Math.max(0, Math.round(ms / 1000));\n  return String(Math.floor(s / 60)).padStart(2, \"0\") + \":\" + String(s % 60).padStart(2, \"0\");\n};\n\nconst el = sel => document.querySelector(sel);\n\nasync function post(route, body) {\n  const res = await fetch(\"/api/\" + route, {\n    method: \"POST\",\n    headers: { \"Content-Type\": \"application/json\" },\n    body: JSON.stringify(body || {}),\n  });\n  const data = await res.json().catch(() => ({}));\n  if (!res.ok) throw new Error(data.error || \"Something went wrong.\");\n  return data;\n}\n\nasync function get(route) {\n  const res = await fetch(\"/api/\" + route, { headers: { \"Accept\": \"application/json\" } });\n  const data = await res.json().catch(() => ({}));\n  if (!res.ok) throw new Error(data.error || \"Something went wrong.\");\n  return data;\n}\n\nfunction toast(msg) {\n  S.toast = msg;\n  render();\n  clearTimeout(toast.t);\n  toast.t = setTimeout(() => { S.toast = \"\"; render(); }, 2600);\n}\n\nfunction setState(data) {\n  S.state = data;\n  S.fetchedAt = Date.now();\n  S.view = data.me.role === \"admin\" ? \"admin\" : \"child\";\n}\n\n/* ---------- live elapsed ---------- */\n\nfunction liveElapsed(task) {\n  return task.elapsedMs + (task.running ? Date.now() - S.fetchedAt : 0);\n}\n\nfunction taskById(id) {\n  if (!S.state) return null;\n  const pool = S.state.tasks || (S.state.board || []).flatMap(b => b.tasks);\n  return pool.find(t => t.id === id) || null;\n}\n\n/* ---------- svg bits ---------- */\n\nconst ICON = {\n  play: '<svg viewBox=\"0 0 24 24\"><path d=\"M8 5v14l11-7z\"/></svg>',\n  pause: '<svg viewBox=\"0 0 24 24\"><path d=\"M7 5h4v14H7zm6 0h4v14h-4z\"/></svg>',\n  check: '<svg viewBox=\"0 0 24 24\"><path d=\"M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z\"/></svg>',\n  back: '<svg viewBox=\"0 0 24 24\"><path d=\"M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z\"/></svg>',\n  lock: '<svg viewBox=\"0 0 24 24\"><path d=\"M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2zM9 7a3 3 0 0 1 6 0v2H9V7z\"/></svg>',\n};\n\nfunction ringSvg(pct, r, sw) {\n  const c = 2 * Math.PI * r;\n  const size = (r + sw) * 2;\n  return `<svg viewBox=\"0 0 ${size} ${size}\">\n    <circle cx=\"${size / 2}\" cy=\"${size / 2}\" r=\"${r}\" stroke=\"var(--track)\" stroke-width=\"${sw}\"></circle>\n    <circle class=\"js-arc\" cx=\"${size / 2}\" cy=\"${size / 2}\" r=\"${r}\" stroke=\"var(--accent)\" stroke-width=\"${sw}\"\n      stroke-dasharray=\"${c.toFixed(1)}\" stroke-dashoffset=\"${(c * (1 - pct)).toFixed(1)}\"></circle>\n  </svg>`;\n}\n\n/* ---------- login ---------- */\n\nfunction loginView() {\n  if (!S.pick) {\n    return `<div class=\"login\"><div class=\"panel\">\n      <p class=\"eyebrow\">Hearth</p>\n      <h2 style=\"margin:0 0 20px;font-size:19px;font-weight:600;letter-spacing:-.02em\">Who's here?</h2>\n      <div class=\"profile-grid\">\n        ${S.profiles.map(p => `\n          <button class=\"profile\" data-act=\"pick\" data-id=\"${p.id}\">\n            <span class=\"avatar\" data-color=\"${esc(p.color)}\">${esc(initials(p.name))}</span>\n            <span class=\"nm\">${esc(p.name)}</span>\n            <span class=\"rl\">${p.role === \"admin\" ? \"parent\" : \"child\"}</span>\n          </button>`).join(\"\")}\n      </div>\n    </div></div>`;\n  }\n\n  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];\n  return `<div class=\"login\"><div class=\"panel\">\n    <div style=\"display:flex;flex-direction:column;align-items:center;gap:10px\">\n      <span class=\"avatar lg\" data-color=\"${esc(S.pick.color)}\">${esc(initials(S.pick.name))}</span>\n      <div style=\"font-size:16px;font-weight:500\">${esc(S.pick.name)}</div>\n      <div class=\"rl mono\" style=\"font-size:10px;letter-spacing:.1em;color:var(--muted)\">enter pin</div>\n    </div>\n    <div class=\"pin-dots\">\n      ${[0, 1, 2, 3].map(i => `<i class=\"${i < S.pin.length ? \"filled\" : \"\"}\"></i>`).join(\"\")}\n    </div>\n    <p class=\"err\">${esc(S.err)}</p>\n    <div class=\"keypad\" style=\"margin-top:14px\">\n      ${keys.map(k => `<button data-act=\"digit\" data-d=\"${k}\">${k}</button>`).join(\"\")}\n      <button class=\"util\" data-act=\"unpick\">Back</button>\n      <button data-act=\"digit\" data-d=\"0\">0</button>\n      <button class=\"util\" data-act=\"del\">Delete</button>\n    </div>\n  </div></div>`;\n}\n\nasync function submitPin() {\n  try {\n    await post(\"login\", { userId: S.pick.id, pin: S.pin });\n    S.pin = \"\"; S.err = \"\"; S.pick = null;\n    setState(await get(\"state\"));\n    render();\n  } catch (e) {\n    S.err = e.message;\n    S.pin = \"\";\n    render();\n  }\n}\n\n/* ---------- child ---------- */\n\nfunction statusChip(t) {\n  if (t.status === \"done\") return `<span class=\"chip done\">done · +${t.awardedPoints || 0}</span>`;\n  if (t.status === \"awaiting\") return `<span class=\"chip await\">waiting on parent</span>`;\n  if (t.status === \"running\") return `<span class=\"chip live\">running</span>`;\n  if (t.status === \"paused\") return `<span class=\"chip\">paused</span>`;\n  return `<span class=\"chip\">not started</span>`;\n}\n\nfunction taskCard(t) {\n  const chore = t.type === \"chore\";\n  const total = chore ? 0 : t.durationMin * 60000;\n  const done = t.status === \"done\" || t.status === \"awaiting\";\n  const pct = done ? 1 : chore ? 0 : Math.min(1, liveElapsed(t) / total);\n  // Study counts down to zero; a chore counts up until the child is finished.\n  const face = done ? \"✓\" : chore ? clock(liveElapsed(t)) : clock(Math.max(0, total - liveElapsed(t)));\n  const started = t.status === \"running\" || t.status === \"paused\";\n\n  return `<div class=\"card\">\n    <div class=\"row\">\n      <div class=\"ring js-ring\" data-id=\"${t.id}\" data-mode=\"${chore ? \"up\" : \"down\"}\">\n        ${ringSvg(pct, 22, 5)}\n        <span class=\"label js-mini ${t.running ? \"on\" : \"\"}\">${face}</span>\n      </div>\n      <div style=\"flex:1;min-width:0\">\n        <h3>${esc(t.title)}</h3>\n        <div class=\"meta\">${chore ? \"chore · no set time\" : t.durationMin + \" min · study\"} · ${t.points} pts</div>\n        <div style=\"margin-top:8px\">${statusChip(t)}</div>\n      </div>\n      ${done ? `<button class=\"pad\" disabled aria-label=\"Finished\">${ICON.check}</button>`\n        : `<button class=\"pad accent\" data-act=\"open\" data-id=\"${t.id}\"\n             aria-label=\"${t.running ? \"Open timer\" : \"Start\"} ${esc(t.title)}\">${t.running ? ICON.pause : ICON.play}</button>`}\n    </div>\n    ${chore && started ? `<div class=\"row\" style=\"justify-content:flex-end;margin-top:12px\">\n      <button class=\"btn small accent\" data-act=\"submit\" data-id=\"${t.id}\">I'm done</button>\n    </div>` : \"\"}\n  </div>`;\n}\n\nfunction childView() {\n  const st = S.state;\n  const tabs = [\"Today\", \"Rewards\"];\n  const body = S.tab === 0 ? childToday() : childRewards();\n\n  return `<div class=\"wrap\">\n    <div class=\"top\">\n      <div class=\"brand\">\n        <span class=\"avatar\" data-color=\"${esc(st.me.color)}\">${esc(initials(st.me.name))}</span>\n        <div>\n          <h1>${esc(st.me.name)}</h1>\n          <div class=\"date\">${esc(st.date)}</div>\n        </div>\n      </div>\n      <div class=\"row\">\n        <span class=\"points\" title=\"allowance + saved\">\n          <b>${st.me.points}</b><span>PTS</span>\n        </span>\n        <button class=\"btn quiet small\" data-act=\"logout\">Sign out</button>\n      </div>\n    </div>\n    ${tabBar(tabs)}\n    ${body}\n  </div>`;\n}\n\nfunction childToday() {\n  const st = S.state;\n  const study = st.tasks.filter(t => t.type === \"study\");\n  const chores = st.tasks.filter(t => t.type === \"chore\");\n  const left = st.tasks.filter(t => t.status !== \"done\").length;\n\n  if (!st.tasks.length) return `<p class=\"empty\">Nothing assigned for today.</p>`;\n\n  return `\n    <div class=\"card flat\" style=\"margin-bottom:20px\">\n      <div class=\"spread\">\n        <div>\n          <div style=\"font-size:15px;font-weight:500\">${left === 0 ? \"All finished\" : left + \" left today\"}</div>\n          <div class=\"meta\" style=\"margin-top:4px\">${st.tasks.length - left} of ${st.tasks.length} complete</div>\n        </div>\n        <div class=\"ring\" style=\"width:44px;height:44px;flex-basis:44px\">\n          ${ringSvg((st.tasks.length - left) / st.tasks.length, 18, 4)}\n        </div>\n      </div>\n    </div>\n    ${study.length ? `<h2 class=\"section-title\">Studying</h2>${study.map(taskCard).join(\"\")}` : \"\"}\n    ${chores.length ? `<h2 class=\"section-title\">Chores</h2>${chores.map(taskCard).join(\"\")}` : \"\"}`;\n}\n\nfunction balanceCard(me) {\n  const pct = me.allowanceWeekly ? me.allowanceRemaining / me.allowanceWeekly : 0;\n  return `<div class=\"card\" style=\"margin-bottom:20px\">\n    <div class=\"spread\" style=\"align-items:flex-start\">\n      <div>\n        <div class=\"meta\">Allowance</div>\n        <div style=\"font-size:26px;font-weight:500;letter-spacing:-.03em;margin:2px 0 4px\">${me.allowanceRemaining}</div>\n        <div class=\"meta\">of ${me.allowanceWeekly} · resets ${esc(me.renewsOn || \"Monday\")}</div>\n      </div>\n      <div class=\"ring\" style=\"width:48px;height:48px;flex-basis:48px\">${ringSvg(pct, 20, 4)}</div>\n      <div style=\"text-align:right\">\n        <div class=\"meta\">Saved</div>\n        <div style=\"font-size:26px;font-weight:500;letter-spacing:-.03em;margin:2px 0 4px\">${me.earned}</div>\n        <div class=\"meta\">yours to keep</div>\n      </div>\n    </div>\n    <div class=\"meta\" style=\"margin-top:14px;padding-top:12px;border-top:0.5px solid var(--track)\">\n      Allowance is spent first, so points you earn stay saved.\n    </div>\n  </div>`;\n}\n\nfunction childRewards() {\n  const st = S.state;\n  return `\n    ${balanceCard(st.me)}\n    ${st.rewards.length ? st.rewards.map(r => {\n      const afford = st.me.points >= r.cost;\n      return `<div class=\"card\">\n        <div class=\"spread\">\n          <div>\n            <h3>${esc(r.title)}</h3>\n            <div class=\"meta\">${r.cost} points${afford ? \"\" : ` · ${r.cost - st.me.points} to go`}</div>\n          </div>\n          <button class=\"btn ${afford ? \"accent\" : \"\"}\" data-act=\"redeem\" data-id=\"${r.id}\" ${afford ? \"\" : \"disabled\"}>Redeem</button>\n        </div>\n      </div>`;\n    }).join(\"\") : `<p class=\"empty\">No rewards set up yet.</p>`}\n    ${st.redemptions.length ? `<h2 class=\"section-title\">Your requests</h2>\n      ${st.redemptions.map(r => `<div class=\"card flat\">\n        <div class=\"spread\">\n          <div><h3>${esc(r.rewardTitle)}</h3><div class=\"meta\">${r.cost} pts</div></div>\n          <span class=\"chip ${r.status === \"fulfilled\" ? \"done\" : r.status === \"denied\" ? \"await\" : \"\"}\">${r.status}</span>\n        </div>\n      </div>`).join(\"\")}` : \"\"}`;\n}\n\n/* ---------- focus overlay ---------- */\n\nfunction focusView() {\n  const t = taskById(S.focus);\n  if (!t) return \"\";\n  const chore = t.type === \"chore\";\n  const total = chore ? 0 : t.durationMin * 60000;\n  const done = t.status === \"done\" || t.status === \"awaiting\";\n  const remaining = done ? 0 : chore ? liveElapsed(t) : Math.max(0, total - liveElapsed(t));\n  const pct = done ? 1 : chore ? 0 : Math.min(1, liveElapsed(t) / total);\n  const started = t.status === \"running\" || t.status === \"paused\";\n\n  const note = done\n    ? (chore ? \"Sent to a parent to check off\" : \"Finished · +\" + t.points + \" points\")\n    : chore\n      ? \"take as long as you need, then tap done\"\n      : \"the timer has to finish · pause is fine\";\n\n  return `<div class=\"overlay\">\n    <button class=\"btn quiet\" data-act=\"closeFocus\" style=\"position:absolute;top:20px;left:16px\">${ICON.back} Back</button>\n    <div style=\"text-align:center\">\n      <div class=\"mono\" style=\"font-size:10.5px;letter-spacing:.14em;color:var(--muted)\">${esc(t.type)}</div>\n      <div style=\"font-size:19px;font-weight:500;margin-top:6px\">${esc(t.title)}</div>\n    </div>\n    <div class=\"dial\">\n      ${ringSvg(pct, 125, 7)}\n      <div class=\"face\">\n        <div class=\"readout js-readout\">${clock(remaining)}</div>\n        <div class=\"caption\">${chore ? \"elapsed\" : t.durationMin + \" min\"} · ${t.points} pts</div>\n      </div>\n    </div>\n    <button class=\"key ${t.running ? \"on\" : \"\"}\" data-act=\"${done ? \"\" : t.running ? \"pause\" : \"start\"}\" data-id=\"${t.id}\"\n      ${done ? \"disabled\" : \"\"} aria-label=\"${t.running ? \"Pause\" : \"Start\"}\">\n      ${done ? ICON.check : t.running ? ICON.pause : ICON.play}\n    </button>\n    ${chore && started && !done ? `<button class=\"btn accent\" data-act=\"submit\" data-id=\"${t.id}\">I'm done</button>` : \"\"}\n    <p class=\"caption\" style=\"max-width:260px\">${esc(note)}</p>\n  </div>`;\n}\n\n/* ---------- admin ---------- */\n\nfunction tabBar(labels) {\n  return `<div class=\"tabs\" style=\"grid-template-columns:repeat(${labels.length},1fr)\">\n    <span class=\"thumb\" style=\"width:calc((100% - 10px)/${labels.length});transform:translateX(calc(${S.tab} * 100%))\"></span>\n    ${labels.map((l, i) => `<button data-act=\"tab\" data-i=\"${i}\" aria-selected=\"${i === S.tab}\">${l}</button>`).join(\"\")}\n  </div>`;\n}\n\nfunction adminView() {\n  const st = S.state;\n  const pending = st.approvals.length + st.redemptions.length;\n  const tabs = [\"Today\", \"Queue\" + (pending ? \" \" + pending : \"\"), \"Tasks\", \"Rewards\", \"Family\"];\n  const body = [adminToday, adminApprovals, adminTasks, adminRewards, adminFamily][S.tab]();\n\n  return `<div class=\"wrap\">\n    <div class=\"top\">\n      <div class=\"brand\">\n        <span class=\"avatar\" data-color=\"${esc(st.me.color)}\">${esc(initials(st.me.name))}</span>\n        <div><h1>${esc(st.me.name)}</h1><div class=\"date\">${esc(st.date)}</div></div>\n      </div>\n      <button class=\"btn quiet small\" data-act=\"logout\">Sign out</button>\n    </div>\n    ${tabBar(tabs)}\n    ${body}\n  </div>`;\n}\n\nfunction adminToday() {\n  const st = S.state;\n  if (!st.board.length) return `<p class=\"empty\">Add a child in the Family tab to get started.</p>`;\n\n  return st.board.map(b => {\n    const done = b.tasks.filter(t => t.status === \"done\").length;\n    return `<div style=\"margin-bottom:30px\">\n      <div class=\"spread\" style=\"margin-bottom:12px\">\n        <div class=\"row\">\n          <span class=\"avatar sm\" data-color=\"${esc(b.child.color)}\">${esc(initials(b.child.name))}</span>\n          <div>\n            <div style=\"font-size:15px;font-weight:500\">${esc(b.child.name)}</div>\n            <div class=\"meta mono\" style=\"font-size:10.5px;color:var(--muted)\">${done}/${b.tasks.length} done today</div>\n          </div>\n        </div>\n        <div style=\"text-align:right\">\n          <span class=\"points\"><b>${b.child.points}</b><span>PTS</span></span>\n          <div class=\"meta mono\" style=\"font-size:10px;color:var(--muted);margin-top:5px\">${b.child.allowanceRemaining} allowance · ${b.child.earned} saved</div>\n        </div>\n      </div>\n      ${b.tasks.length ? b.tasks.map(t => `<div class=\"card flat\">\n        <div class=\"spread\">\n          <div style=\"min-width:0\">\n            <h3>${esc(t.title)}</h3>\n            <div class=\"meta\">${t.type === \"chore\" ? \"chore\" : t.durationMin + \" min study\"} · ${Math.floor(liveElapsed(t) / 60000)} min logged</div>\n          </div>\n          <div class=\"row\">\n            ${statusChip(t)}\n            ${t.status === \"awaiting\" ? `<button class=\"btn small accent\" data-act=\"approve\" data-key=\"${t.key}\">Check off</button>` : \"\"}\n            ${t.status !== \"done\" && t.status !== \"awaiting\" ? `<button class=\"btn small quiet\" data-act=\"excuse\" data-key=\"${t.key}\">Excuse</button>` : \"\"}\n          </div>\n        </div>\n      </div>`).join(\"\") : `<p class=\"empty\">No tasks scheduled today.</p>`}\n    </div>`;\n  }).join(\"\");\n}\n\nfunction adminApprovals() {\n  const st = S.state;\n  if (!st.approvals.length && !st.redemptions.length) return `<p class=\"empty\">Nothing waiting on you.</p>`;\n\n  return `\n    ${st.approvals.length ? `<h2 class=\"section-title\">Chores to check off</h2>\n      ${st.approvals.map(t => `<div class=\"card\">\n        <div class=\"spread\">\n          <div>\n            <h3>${esc(t.title)}</h3>\n            <div class=\"meta\">${esc(t.childName)} · ${Math.floor(liveElapsed(t) / 60000)} min logged · ${t.points} pts</div>\n          </div>\n          <div class=\"row\">\n            <button class=\"btn small quiet\" data-act=\"reject\" data-key=\"${t.key}\">Send back</button>\n            <button class=\"btn small accent\" data-act=\"approve\" data-key=\"${t.key}\">Check off</button>\n          </div>\n        </div>\n      </div>`).join(\"\")}` : \"\"}\n    ${st.redemptions.length ? `<h2 class=\"section-title\">Reward requests</h2>\n      ${st.redemptions.map(r => `<div class=\"card\">\n        <div class=\"spread\">\n          <div>\n            <h3>${esc(r.rewardTitle)}</h3>\n            <div class=\"meta\">${esc(r.childName)} · ${r.cost} pts already deducted</div>\n          </div>\n          <div class=\"row\">\n            <button class=\"btn small quiet\" data-act=\"denyRedemption\" data-id=\"${r.id}\">Refund</button>\n            <button class=\"btn small accent\" data-act=\"fulfill\" data-id=\"${r.id}\">Given</button>\n          </div>\n        </div>\n      </div>`).join(\"\")}` : \"\"}`;\n}\n\nfunction dayChips(days) {\n  return `<div class=\"row\" style=\"gap:7px;flex-wrap:wrap\">\n    ${DAYS.map((d, i) => `<button type=\"button\" class=\"btn small ${days.includes(i) ? \"accent on\" : \"\"}\"\n      data-act=\"toggleDay\" data-i=\"${i}\" style=\"width:38px;padding:8px 0;text-align:center\">${d}</button>`).join(\"\")}\n  </div>`;\n}\n\nfunction adminTasks() {\n  const st = S.state;\n  const kind = S.taskKind === \"chore\" ? \"chore\" : \"study\";\n  const f = formState(\"task\", { id: \"\", childId: (st.children[0] || {}).id || \"\", title: \"\", type: kind, durationMin: 20, points: 10, days: [0, 1, 2, 3, 4, 5, 6] });\n  // Editing a task pins the form to that task's type.\n  if (!f.id) f.type = kind;\n\n  return `\n    <div class=\"tabs\" style=\"grid-template-columns:repeat(2,1fr);margin-bottom:20px\">\n      <span class=\"thumb\" style=\"width:calc((100% - 10px)/2);transform:translateX(calc(${kind === \"chore\" ? 1 : 0} * 100%))\"></span>\n      <button data-act=\"taskKind\" data-k=\"study\" aria-selected=\"${kind === \"study\"}\">Study</button>\n      <button data-act=\"taskKind\" data-k=\"chore\" aria-selected=\"${kind === \"chore\"}\">Chores</button>\n    </div>\n    <div class=\"card\" style=\"margin-bottom:24px\">\n      <p class=\"eyebrow\">${f.id ? \"Edit\" : \"New\"} ${kind === \"chore\" ? \"chore\" : \"study block\"}</p>\n      <div class=\"stack\">\n        <div><label class=\"lab\" for=\"f-title\">Name</label>\n          <input class=\"field\" id=\"f-title\" value=\"${esc(f.title)}\" placeholder=\"Reading, dishwasher, piano…\"></div>\n        <div class=\"grid2\">\n          <div><label class=\"lab\" for=\"f-child\">Child</label>\n            <select class=\"field\" id=\"f-child\">\n              ${st.children.map(c => `<option value=\"${c.id}\" ${c.id === f.childId ? \"selected\" : \"\"}>${esc(c.name)}</option>`).join(\"\")}\n            </select></div>\n          ${f.type === \"chore\" ? \"\" : `<div><label class=\"lab\" for=\"f-dur\">Minutes</label>\n            <input class=\"field\" id=\"f-dur\" type=\"number\" min=\"1\" max=\"240\" value=\"${f.durationMin || 20}\"></div>`}\n          <div><label class=\"lab\" for=\"f-pts\">Points</label>\n            <input class=\"field\" id=\"f-pts\" type=\"number\" min=\"0\" max=\"500\" value=\"${f.points}\"></div>\n        </div>\n        ${f.type === \"chore\" ? `<div class=\"meta\">No set length. The child runs a timer while they work and taps done when they're finished; you check it off from the queue.</div>` : \"\"}\n        <div><label class=\"lab\">Days</label>${dayChips(f.days)}</div>\n        <div class=\"row\" style=\"justify-content:flex-end;margin-top:4px\">\n          ${f.id ? `<button class=\"btn quiet small\" data-act=\"cancelForm\">Cancel</button>` : \"\"}\n          <button class=\"btn accent\" data-act=\"saveTask\">${f.id ? \"Save changes\" : \"Add task\"}</button>\n        </div>\n      </div>\n    </div>\n    ${st.children.map(c => {\n      const list = st.allTasks.filter(t => t.childId === c.id && t.type === kind);\n      if (!list.length) return \"\";\n      return `<h2 class=\"section-title\">${esc(c.name)}</h2>\n        ${list.map(t => `<div class=\"card flat\">\n          <div class=\"spread\">\n            <div>\n              <h3>${esc(t.title)}</h3>\n              <div class=\"meta\">${t.type === \"chore\" ? \"no set time\" : t.durationMin + \" min\"} · ${t.points} pts · ${t.days.length === 7 ? \"daily\" : t.days.map(d => DAYS[d]).join(\"\")}</div>\n            </div>\n            <div class=\"row\">\n              <button class=\"btn small quiet\" data-act=\"editTask\" data-id=\"${t.id}\">Edit</button>\n              <button class=\"btn small quiet\" data-act=\"deleteTask\" data-id=\"${t.id}\">Remove</button>\n            </div>\n          </div>\n        </div>`).join(\"\")}`;\n    }).join(\"\")}`;\n}\n\nfunction adminRewards() {\n  const st = S.state;\n  const f = formState(\"reward\", { id: \"\", title: \"\", cost: 25, childIds: [] });\n\n  return `\n    <div class=\"card\" style=\"margin-bottom:24px\">\n      <p class=\"eyebrow\">${f.id ? \"Edit reward\" : \"New reward\"}</p>\n      <div class=\"stack\">\n        <div><label class=\"lab\" for=\"r-title\">Reward</label>\n          <input class=\"field\" id=\"r-title\" value=\"${esc(f.title)}\" placeholder=\"Movie night, later bedtime…\"></div>\n        <div><label class=\"lab\" for=\"r-cost\">Cost in points</label>\n          <input class=\"field\" id=\"r-cost\" type=\"number\" min=\"1\" max=\"10000\" value=\"${f.cost}\"></div>\n        <div><label class=\"lab\">Who can redeem it</label>\n          <div class=\"row\" style=\"gap:8px;flex-wrap:wrap\">\n            <button type=\"button\" class=\"btn small ${f.childIds.length === 0 ? \"accent on\" : \"\"}\" data-act=\"toggleChild\" data-id=\"all\">Everyone</button>\n            ${st.children.map(c => `<button type=\"button\" class=\"btn small ${f.childIds.includes(c.id) ? \"accent on\" : \"\"}\"\n              data-act=\"toggleChild\" data-id=\"${c.id}\">${esc(c.name)}</button>`).join(\"\")}\n          </div></div>\n        <div class=\"row\" style=\"justify-content:flex-end;margin-top:4px\">\n          ${f.id ? `<button class=\"btn quiet small\" data-act=\"cancelForm\">Cancel</button>` : \"\"}\n          <button class=\"btn accent\" data-act=\"saveReward\">${f.id ? \"Save changes\" : \"Add reward\"}</button>\n        </div>\n      </div>\n    </div>\n    ${st.rewards.map(r => `<div class=\"card flat\">\n      <div class=\"spread\">\n        <div>\n          <h3>${esc(r.title)}</h3>\n          <div class=\"meta\">${r.cost} pts · ${r.childIds.length ? r.childIds.map(cid => (st.children.find(c => c.id === cid) || {}).name).join(\", \") : \"everyone\"}</div>\n        </div>\n        <div class=\"row\">\n          <button class=\"btn small quiet\" data-act=\"editReward\" data-id=\"${r.id}\">Edit</button>\n          <button class=\"btn small quiet\" data-act=\"deleteReward\" data-id=\"${r.id}\">Remove</button>\n        </div>\n      </div>\n    </div>`).join(\"\")}`;\n}\n\nfunction adminFamily() {\n  const st = S.state;\n  const f = formState(\"user\", { id: \"\", name: \"\", role: \"child\", color: \"ochre\", pin: \"\" });\n\n  const person = u => `<div class=\"card flat\">\n    <div class=\"spread\">\n      <div class=\"row\">\n        <span class=\"avatar sm\" data-color=\"${esc(u.color)}\">${esc(initials(u.name))}</span>\n        <div>\n          <h3>${esc(u.name)}</h3>\n          <div class=\"meta\">${u.role === \"admin\" ? \"parent\"\n            : u.allowanceRemaining + \"/\" + u.allowanceWeekly + \" allowance · \" + u.earned + \" saved\"}</div>\n        </div>\n      </div>\n      <div class=\"row\">\n        ${u.role === \"child\" ? `<button class=\"btn small quiet\" data-act=\"adjust\" data-id=\"${u.id}\" data-delta=\"-5\">−5</button>\n        <button class=\"btn small quiet\" data-act=\"adjust\" data-id=\"${u.id}\" data-delta=\"5\">+5</button>` : \"\"}\n        <button class=\"btn small quiet\" data-act=\"editUser\" data-id=\"${u.id}\">Edit</button>\n        ${u.id === st.me.id ? \"\" : `<button class=\"btn small quiet\" data-act=\"deleteUser\" data-id=\"${u.id}\">Remove</button>`}\n      </div>\n    </div>\n  </div>`;\n\n  return `\n    <div class=\"card\" style=\"margin-bottom:24px\">\n      <p class=\"eyebrow\">${f.id ? \"Edit person\" : \"Add someone\"}</p>\n      <div class=\"stack\">\n        <div><label class=\"lab\" for=\"u-name\">Name</label>\n          <input class=\"field\" id=\"u-name\" value=\"${esc(f.name)}\"></div>\n        <div class=\"grid2\">\n          <div><label class=\"lab\" for=\"u-role\">Role</label>\n            <select class=\"field\" id=\"u-role\" data-act=\"roleChanged\" ${f.id ? \"disabled\" : \"\"}>\n              <option value=\"child\" ${f.role === \"child\" ? \"selected\" : \"\"}>Child</option>\n              <option value=\"admin\" ${f.role === \"admin\" ? \"selected\" : \"\"}>Parent / guardian</option>\n            </select></div>\n          <div><label class=\"lab\" for=\"u-pin\">PIN ${f.id ? \"(blank keeps current)\" : \"\"}</label>\n            <input class=\"field\" id=\"u-pin\" type=\"password\" inputmode=\"numeric\" autocomplete=\"new-password\" placeholder=\"4+ digits\"></div>\n        </div>\n        ${f.role === \"child\" ? `<div><label class=\"lab\" for=\"u-allow\">Weekly allowance</label>\n          <input class=\"field\" id=\"u-allow\" type=\"number\" min=\"0\" max=\"100000\" value=\"${f.allowanceWeekly === undefined ? 500 : f.allowanceWeekly}\">\n          <div class=\"meta\" style=\"margin-top:6px\">Renews every ${esc((st.children[0] || {}).renewsOn || \"Monday\")}. Unspent allowance doesn't carry over. Lowering it applies now; raising it applies at the next renewal.</div></div>` : \"\"}\n        <div><label class=\"lab\">Colour</label>\n          <div class=\"row\" style=\"gap:8px;flex-wrap:wrap\">\n            ${COLORS.map(c => `<button type=\"button\" class=\"btn small ${f.color === c ? \"on\" : \"\"}\" data-act=\"pickColor\" data-c=\"${c}\">\n              <span class=\"avatar sm\" data-color=\"${c}\" style=\"width:18px;height:18px;box-shadow:none\">●</span></button>`).join(\"\")}\n          </div></div>\n        <div class=\"row\" style=\"justify-content:flex-end;margin-top:4px\">\n          ${f.id ? `<button class=\"btn quiet small\" data-act=\"cancelForm\">Cancel</button>` : \"\"}\n          <button class=\"btn accent\" data-act=\"saveUser\">${f.id ? \"Save changes\" : \"Add person\"}</button>\n        </div>\n      </div>\n    </div>\n    <div class=\"card flat\" style=\"margin-bottom:24px\">\n      <div class=\"spread\">\n        <div>\n          <h3>Week starts on</h3>\n          <div class=\"meta\">When every child's allowance renews</div>\n        </div>\n        <div class=\"row\">\n          <button class=\"btn small ${st.settings.weekStartsOn === 0 ? \"accent on\" : \"\"}\" data-act=\"weekStart\" data-d=\"0\">Sunday</button>\n          <button class=\"btn small ${st.settings.weekStartsOn === 1 ? \"accent on\" : \"\"}\" data-act=\"weekStart\" data-d=\"1\">Monday</button>\n        </div>\n      </div>\n    </div>\n    <h2 class=\"section-title\">Children</h2>\n    ${st.children.map(person).join(\"\") || `<p class=\"empty\">No children yet.</p>`}\n    <h2 class=\"section-title\">Parents and guardians</h2>\n    ${st.admins.map(person).join(\"\")}\n    <p class=\"meta mono\" style=\"text-align:center;margin-top:28px;font-size:10px;color:var(--muted)\">\n      build ${esc(String(st.version || \"dev\").slice(0, 12))}\n    </p>`;\n}\n\n/* ---------- render ---------- */\n\nfunction isTyping() {\n  const a = document.activeElement;\n  return a && (a.tagName === \"INPUT\" || a.tagName === \"SELECT\");\n}\n\n// A re-render rebuilds the DOM, so pull anything half-typed back into state first.\nfunction captureForm() {\n  if (!S.form) return;\n  if (S.form.kind === \"task\") readTaskForm(S.form);\n  else if (S.form.kind === \"reward\") readRewardForm(S.form);\n  else if (S.form.kind === \"user\") readUserForm(S.form);\n}\n\nfunction render() {\n  captureForm();\n  let html;\n  if (S.view === \"loading\") html = `<p class=\"empty\" style=\"padding-top:60px\">Loading…</p>`;\n  else if (S.view === \"login\") html = loginView();\n  else if (S.view === \"child\") html = S.focus ? focusView() : childView();\n  else html = adminView();\n\n  root.innerHTML = html + (S.toast ? `<div class=\"toast\">${esc(S.toast)}</div>` : \"\");\n}\n\n/* ---------- ticking ---------- */\n\nfunction tick() {\n  if (!S.state) return;\n  const pool = S.state.tasks || (S.state.board || []).flatMap(b => b.tasks);\n  let needsSync = false;\n\n  for (const t of pool) {\n    if (!t.running) continue;\n    const chore = t.type === \"chore\";\n    const total = chore ? 0 : t.durationMin * 60000;\n    // A chore has no end, so it never needs a sync to settle.\n    const left = chore ? liveElapsed(t) : total - liveElapsed(t);\n    if (!chore && left <= 0) needsSync = true;\n\n    const mini = document.querySelector(`.js-ring[data-id=\"${t.id}\"] .js-mini`);\n    if (mini) mini.textContent = clock(Math.max(0, left));\n    if (!chore) {\n      const arcs = document.querySelectorAll(`.js-ring[data-id=\"${t.id}\"] .js-arc`);\n      arcs.forEach(a => {\n        const c = parseFloat(a.getAttribute(\"stroke-dasharray\"));\n        a.setAttribute(\"stroke-dashoffset\", (c * (1 - Math.min(1, liveElapsed(t) / total))).toFixed(1));\n      });\n    }\n\n    if (S.focus === t.id) {\n      const out = el(\".js-readout\");\n      if (out) out.textContent = clock(Math.max(0, left));\n      const arc = chore ? null : document.querySelector(\".dial .js-arc\");\n      if (arc) {\n        const c = parseFloat(arc.getAttribute(\"stroke-dasharray\"));\n        arc.setAttribute(\"stroke-dashoffset\", (c * (1 - Math.min(1, liveElapsed(t) / total))).toFixed(1));\n      }\n    }\n  }\n  if (needsSync) refresh();\n}\n\nasync function refresh(silent) {\n  try {\n    captureForm();\n    setState(await get(\"state\"));\n    if (silent && isTyping()) return;\n    render();\n  } catch (e) {\n    if (String(e.message).includes(\"Sign in\")) { S.view = \"login\"; S.state = null; render(); }\n  }\n}\n\nsetInterval(tick, 250);\nsetInterval(() => { if (S.state) refresh(true); }, 6000);\n\n/* ---------- events ---------- */\n\nfunction formState(kind, seed) {\n  if (!S.form || S.form.kind !== kind) S.form = Object.assign({ kind }, seed);\n  return S.form;\n}\n\nroot.addEventListener(\"click\", async e => {\n  const node = e.target.closest(\"[data-act]\");\n  if (!node) return;\n  const act = node.dataset.act;\n  if (!act) return;\n\n  try {\n    switch (act) {\n      case \"pick\":\n        S.pick = S.profiles.find(p => p.id === node.dataset.id);\n        S.pin = \"\"; S.err = \"\"; return render();\n      case \"unpick\": S.pick = null; S.pin = \"\"; S.err = \"\"; return render();\n      case \"digit\":\n        if (S.pin.length < 12) S.pin += node.dataset.d;\n        render();\n        if (S.pin.length === 4) submitPin();\n        return;\n      case \"del\": S.pin = S.pin.slice(0, -1); S.err = \"\"; return render();\n\n      case \"tab\": S.tab = +node.dataset.i; S.form = null; return render();\n      case \"taskKind\": S.taskKind = node.dataset.k; S.form = null; return render();\n      case \"logout\":\n        await post(\"logout\"); S.state = null; S.pick = null; S.view = \"login\";\n        S.profiles = (await get(\"profiles\")).profiles; return render();\n\n      case \"open\": S.focus = node.dataset.id; {\n        const t = taskById(S.focus);\n        render();\n        if (t && !t.running && t.status !== \"done\" && t.status !== \"awaiting\") {\n          setState(await post(\"start\", { taskId: t.id })); render();\n        }\n      } return;\n      case \"closeFocus\": S.focus = null; return render();\n      case \"submit\":\n        setState(await post(\"submit\", { taskId: node.dataset.id }));\n        S.focus = null;\n        toast(\"Sent to a parent to check off\"); return;\n      case \"start\": setState(await post(\"start\", { taskId: node.dataset.id })); return render();\n      case \"pause\": setState(await post(\"pause\", { taskId: node.dataset.id })); return render();\n\n      case \"approve\": setState(await post(\"approve\", { key: node.dataset.key })); toast(\"Checked off\"); return;\n      case \"reject\": setState(await post(\"reject\", { key: node.dataset.key })); toast(\"Sent back\"); return;\n      case \"excuse\":\n        if (!confirm(\"Mark this done without points?\")) return;\n        setState(await post(\"excuse\", { key: node.dataset.key })); return render();\n      case \"weekStart\":\n        setState(await post(\"settings\", { weekStartsOn: +node.dataset.d }));\n        toast(\"Allowance renews on \" + (node.dataset.d === \"0\" ? \"Sunday\" : \"Monday\")); return;\n      case \"adjust\": setState(await post(\"adjust\", { childId: node.dataset.id, delta: +node.dataset.delta })); return render();\n\n      case \"redeem\": setState(await post(\"redeem\", { rewardId: node.dataset.id })); toast(\"Sent to a parent\"); return;\n      case \"fulfill\": setState(await post(\"fulfill\", { id: node.dataset.id })); toast(\"Marked as given\"); return;\n      case \"denyRedemption\": setState(await post(\"denyRedemption\", { id: node.dataset.id })); toast(\"Points refunded\"); return;\n\n      case \"toggleDay\": {\n        const f = formState(\"task\", { days: [] });\n        const i = +node.dataset.i;\n        f.days = f.days.includes(i) ? f.days.filter(d => d !== i) : f.days.concat(i).sort();\n        readTaskForm(f); return render();\n      }\n      case \"toggleChild\": {\n        const f = formState(\"reward\", { childIds: [] });\n        readRewardForm(f);\n        if (node.dataset.id === \"all\") f.childIds = [];\n        else f.childIds = f.childIds.includes(node.dataset.id)\n          ? f.childIds.filter(x => x !== node.dataset.id)\n          : f.childIds.concat(node.dataset.id);\n        return render();\n      }\n      case \"roleChanged\": { const f = formState(\"user\", {}); readUserForm(f); f.role = val(\"u-role\"); return render(); }\n      case \"pickColor\": { const f = formState(\"user\", {}); readUserForm(f); f.color = node.dataset.c; return render(); }\n      case \"cancelForm\": S.form = null; return render();\n\n      case \"editTask\": {\n        const t = S.state.allTasks.find(x => x.id === node.dataset.id);\n        S.taskKind = t.type;\n        S.form = Object.assign({ kind: \"task\" }, t); return render();\n      }\n      case \"saveTask\": {\n        const f = formState(\"task\", { id: \"\", days: [0, 1, 2, 3, 4, 5, 6] });\n        readTaskForm(f);\n        setState(await post(\"saveTask\", f));\n        S.form = null; toast(f.id ? \"Task updated\" : \"Task added\"); return;\n      }\n      case \"deleteTask\":\n        if (!confirm(\"Remove this task?\")) return;\n        setState(await post(\"deleteTask\", { id: node.dataset.id })); return render();\n\n      case \"editReward\": {\n        const r = S.state.rewards.find(x => x.id === node.dataset.id);\n        S.form = Object.assign({ kind: \"reward\" }, r); return render();\n      }\n      case \"saveReward\": {\n        const f = formState(\"reward\", { id: \"\", childIds: [] });\n        readRewardForm(f);\n        setState(await post(\"saveReward\", f));\n        S.form = null; toast(f.id ? \"Reward updated\" : \"Reward added\"); return;\n      }\n      case \"deleteReward\":\n        if (!confirm(\"Remove this reward?\")) return;\n        setState(await post(\"deleteReward\", { id: node.dataset.id })); return render();\n\n      case \"editUser\": {\n        const u = [...S.state.children, ...S.state.admins].find(x => x.id === node.dataset.id);\n        S.form = Object.assign({ kind: \"user\", pin: \"\" }, u); return render();\n      }\n      case \"saveUser\": {\n        const f = formState(\"user\", { id: \"\", color: \"ochre\" });\n        readUserForm(f);\n        setState(await post(\"saveUser\", f));\n        S.form = null; toast(\"Saved\"); return;\n      }\n      case \"deleteUser\":\n        if (!confirm(\"Remove this person and their tasks?\")) return;\n        setState(await post(\"deleteUser\", { id: node.dataset.id })); return render();\n    }\n  } catch (err) {\n    toast(err.message);\n  }\n});\n\nfunction val(id) { const n = el(\"#\" + id); return n ? n.value : \"\"; }\n\nfunction readTaskForm(f) {\n  if (el(\"#f-title\")) {\n    f.title = val(\"f-title\");\n    f.childId = val(\"f-child\");\n    f.points = +val(\"f-pts\");\n    if (el(\"#f-dur\")) f.durationMin = +val(\"f-dur\");\n  }\n  if (!f.days || !f.days.length) f.days = [0, 1, 2, 3, 4, 5, 6];\n}\n\nfunction readRewardForm(f) {\n  if (el(\"#r-title\")) { f.title = val(\"r-title\"); f.cost = +val(\"r-cost\"); }\n  if (!f.childIds) f.childIds = [];\n}\n\nfunction readUserForm(f) {\n  if (el(\"#u-name\")) {\n    f.name = val(\"u-name\");\n    f.pin = val(\"u-pin\");\n    if (!f.id) f.role = val(\"u-role\");\n    if (el(\"#u-allow\")) f.allowanceWeekly = +val(\"u-allow\");\n  }\n}\n\nroot.addEventListener(\"change\", e => {\n  const node = e.target.closest(\"[data-act]\");\n  if (node && node.dataset.act === \"roleChanged\") {\n    const f = formState(\"user\", {});\n    readUserForm(f);\n    f.role = node.value;\n    render();\n  }\n});\n\ndocument.addEventListener(\"keydown\", e => {\n  if (S.view === \"login\" && S.pick) {\n    if (/^[0-9]$/.test(e.key) && S.pin.length < 12) {\n      S.pin += e.key; render();\n      if (S.pin.length === 4) submitPin();\n    } else if (e.key === \"Backspace\") { S.pin = S.pin.slice(0, -1); render(); }\n    else if (e.key === \"Escape\") { S.pick = null; S.pin = \"\"; render(); }\n  } else if (e.key === \"Escape\" && S.focus) { S.focus = null; render(); }\n});\n\n/* ---------- boot ---------- */\n\n(async function boot() {\n  try {\n    setState(await get(\"state\"));\n  } catch (e) {\n    S.view = \"login\";\n    S.profiles = (await get(\"profiles\")).profiles;\n  }\n  render();\n})();\n" },
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/* ---------- storage ---------- */

let db = null;
let writeQueued = false;

function hash(secret, salt) {
  return crypto.pbkdf2Sync(String(secret), salt, 120000, 32, "sha256").toString("hex");
}

function makeSecret(secret) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: hash(secret, salt) };
}

function checkSecret(secret, record) {
  if (!record || !record.salt) return false;
  const a = Buffer.from(hash(secret, record.salt), "hex");
  const b = Buffer.from(record.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function id(prefix) {
  return prefix + "_" + crypto.randomBytes(6).toString("hex");
}

const DEFAULT_ALLOWANCE = 500;

function newChild(name, color, pin, earned) {
  return {
    id: id("u"), name, role: "child", color, secret: makeSecret(pin),
    allowanceWeekly: DEFAULT_ALLOWANCE,
    allowanceRemaining: DEFAULT_ALLOWANCE,
    allowanceWeek: null,
    earned: earned || 0,
  };
}

function seed() {
  const parent = { id: id("u"), name: "Parent", role: "admin", color: "sage", secret: makeSecret("1234") };
  const ari = newChild("Ari", "ochre", "1111", 40);
  const nova = newChild("Nova", "clay", "2222", 15);

  const task = (childId, title, type, durationMin, points) => ({
    id: id("t"), childId, title, type, durationMin, points,
    days: [0, 1, 2, 3, 4, 5, 6], active: true,
  });

  return {
    settings: { weekStartsOn: 1 },
    users: [parent, ari, nova],
    tasks: [
      task(ari.id, "Reading", "study", 20, 10),
      task(ari.id, "Math practice", "study", 25, 12),
      task(ari.id, "Tidy bedroom", "chore", 10, 8),
      task(ari.id, "Dishwasher", "chore", 5, 5),
      task(nova.id, "Spelling", "study", 15, 10),
      task(nova.id, "Feed the cat", "chore", 5, 5),
    ],
    logs: {},
    rewards: [
      { id: id("r"), title: "30 min screen time", cost: 20, childIds: [], active: true },
      { id: id("r"), title: "Pick dinner", cost: 45, childIds: [], active: true },
      { id: id("r"), title: "Movie night", cost: 80, childIds: [], active: true },
    ],
    redemptions: [],
  };
}

// Older data files had a single `points` number. Those were all earned, so
// they become savings and everyone picks up a fresh allowance.
function migrate() {
  if (!db.settings) db.settings = { weekStartsOn: 1 };
  for (const u of db.users) {
    if (u.role !== "child") { delete u.points; continue; }
    if (u.earned === undefined) u.earned = typeof u.points === "number" ? u.points : 0;
    if (u.allowanceWeekly === undefined) u.allowanceWeekly = DEFAULT_ALLOWANCE;
    if (u.allowanceRemaining === undefined) u.allowanceRemaining = u.allowanceWeekly;
    if (u.allowanceWeek === undefined) u.allowanceWeek = null;
    delete u.points;
  }
  for (const t of db.tasks || []) {
    if (t.type === "chore" && t.durationMin !== null) t.durationMin = null;
  }
  for (const r of db.redemptions || []) {
    if (r.fromAllowance === undefined) { r.fromAllowance = 0; r.fromEarned = r.cost; }
  }
}

function load() {
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (err) {
    db = seed();
    try {
      save(true);
    } catch (writeErr) {
      if (writeErr.code === "EACCES" || writeErr.code === "EPERM" || writeErr.code === "ENOENT") {
        console.error(
          `\n  Can't write to ${DATA_FILE}\n\n` +
          `  Running in Docker with a bind mount? The container runs as uid 1000,\n` +
          `  so the host directory has to be writable by that user:\n\n` +
          `      sudo mkdir -p /volume1/docker/hearth/data\n` +
          `      sudo chown -R 1000:1000 /volume1/docker/hearth/data\n\n` +
          `  Point the mount at that directory: /volume1/docker/hearth/data:/data\n` +
          `  A named volume avoids this entirely.\n`
        );
        process.exit(1);
      }
      throw writeErr;
    }
    console.log("Seeded a new family in " + DATA_FILE);
  }
  migrate();
}

function save(now) {
  if (now) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    return;
  }
  if (writeQueued) return;
  writeQueued = true;
  setTimeout(() => {
    writeQueued = false;
    fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), () => {});
  }, 400);
}

/* ---------- sessions ---------- */

const sessions = new Map();
const DAY = 86400000;

function loadSessions() {
  for (const [token, s] of Object.entries(db.sessions || {})) {
    if (s.exp > Date.now()) sessions.set(token, s);
  }
}

function persistSessions() {
  db.sessions = Object.fromEntries(sessions);
  save();
}

function newSession(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { userId, exp: Date.now() + 30 * DAY });
  persistSessions();
  return token;
}

function sessionUser(req) {
  const raw = req.headers.cookie || "";
  const match = raw.match(/(?:^|;\s*)sid=([a-f0-9]+)/);
  if (!match) return null;
  const s = sessions.get(match[1]);
  if (!s || s.exp < Date.now()) return null;
  return db.users.find(u => u.id === s.userId) || null;
}

/* ---------- domain ---------- */

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekday() {
  return new Date().getDay();
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The identity of the current week is the date it started on, which stays
// correct across year boundaries in a way that week numbers do not.
function weekKey() {
  const startsOn = db.settings.weekStartsOn === 0 ? 0 : 1;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - startsOn + 7) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Allowance is a fresh grant each week, never a running total: whatever is
// left over on renewal day is simply gone.
function refreshAllowance(child) {
  const key = weekKey();
  if (child.allowanceWeek !== key) {
    child.allowanceWeek = key;
    child.allowanceRemaining = child.allowanceWeekly;
    save();
  }
  return child;
}

function balance(child) {
  return child.allowanceRemaining + child.earned;
}

// Allowance is spent before savings, so points earned by working are the
// last thing to go and survive the week by default.
function spend(child, cost) {
  refreshAllowance(child);
  if (balance(child) < cost) return null;
  const fromAllowance = Math.min(child.allowanceRemaining, cost);
  const fromEarned = cost - fromAllowance;
  child.allowanceRemaining -= fromAllowance;
  child.earned -= fromEarned;
  return { fromAllowance, fromEarned };
}

function logKey(taskId, date) {
  return date + ":" + taskId;
}

function getLog(task, date) {
  const key = logKey(task.id, date);
  if (!db.logs[key]) {
    db.logs[key] = {
      key, taskId: task.id, childId: task.childId, date,
      status: "idle", accumulatedMs: 0, startedAt: null,
      completedAt: null, approvedBy: null, awardedPoints: 0,
    };
  }
  return db.logs[key];
}

function elapsedMs(log) {
  return log.accumulatedMs + (log.startedAt ? Date.now() - log.startedAt : 0);
}

// The timer is the source of truth: a study block is only done when its full
// duration has actually elapsed, and a chore only reaches an admin once its
// timer has run out.
function settle(log, task) {
  if (log.status !== "running") return log;
  // Chores are open-ended: they finish when the child says so, not on a clock.
  if (task.type === "chore") return log;
  const requiredMs = task.durationMin * 60000;
  if (elapsedMs(log) < requiredMs) return log;

  log.accumulatedMs = requiredMs;
  log.startedAt = null;
  log.completedAt = Date.now();

  if (task.type === "study") {
    log.status = "done";
    award(task.childId, task.points, log);
  } else {
    log.status = "awaiting";
  }
  save();
  return log;
}

function award(childId, points, log) {
  const child = db.users.find(u => u.id === childId);
  if (!child) return;
  child.earned += points;
  if (log) log.awardedPoints = points;
}

function tasksFor(childId, date, day) {
  return db.tasks
    .filter(t => t.childId === childId && t.active !== false && t.days.includes(day))
    .map(t => {
      const log = settle(getLog(t, date), t);
      return {
        id: t.id, title: t.title, type: t.type, durationMin: t.durationMin,
        points: t.points, days: t.days, childId: t.childId,
        status: log.status, elapsedMs: elapsedMs(log), running: log.status === "running",
        awardedPoints: log.awardedPoints, key: log.key,
      };
    });
}

function publicUser(u) {
  const base = { id: u.id, name: u.name, role: u.role, color: u.color };
  if (u.role !== "child") return base;
  refreshAllowance(u);
  return Object.assign(base, {
    points: balance(u),
    allowanceWeekly: u.allowanceWeekly,
    allowanceRemaining: u.allowanceRemaining,
    earned: u.earned,
    renewsOn: DAY_NAMES[db.settings.weekStartsOn === 0 ? 0 : 1],
  });
}

function rewardsFor(childId) {
  return db.rewards
    .filter(r => r.active !== false && (r.childIds.length === 0 || r.childIds.includes(childId)))
    .map(r => ({ id: r.id, title: r.title, cost: r.cost, childIds: r.childIds }));
}

function stateFor(user) {
  const date = today();
  const day = weekday();
  const children = db.users.filter(u => u.role === "child");

  if (user.role === "child") {
    // Settle timers first: they can award points, and `me` must reflect that
    // in this response rather than the next one.
    const tasks = tasksFor(user.id, date, day);
    return {
      me: publicUser(user),
      date,
      tasks,
      rewards: rewardsFor(user.id),
      redemptions: db.redemptions
        .filter(r => r.childId === user.id)
        .slice(-12).reverse()
        .map(r => ({ ...r, rewardTitle: (db.rewards.find(x => x.id === r.rewardId) || {}).title || "Reward" })),
    };
  }

  const board = children.map(c => {
    const tasks = tasksFor(c.id, date, day);
    return { child: publicUser(c), tasks };
  });

  return {
    me: publicUser(user),
    date,
    board,
    children: board.map(b => b.child),
    admins: db.users.filter(u => u.role === "admin").map(publicUser),
    settings: db.settings,
    version: VERSION,
    allTasks: db.tasks.filter(t => t.active !== false),
    rewards: db.rewards.filter(r => r.active !== false),
    approvals: board.flatMap(b =>
      b.tasks.filter(t => t.status === "awaiting").map(t => ({ ...t, childName: b.child.name }))
    ),
    redemptions: db.redemptions
      .filter(r => r.status === "pending")
      .map(r => ({
        ...r,
        childName: (db.users.find(u => u.id === r.childId) || {}).name || "?",
        rewardTitle: (db.rewards.find(x => x.id === r.rewardId) || {}).title || "Reward",
      })),
  };
}

/* ---------- http plumbing ---------- */

function json(res, code, body, headers) {
  const payload = JSON.stringify(body);
  res.writeHead(code, Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  }, headers || {}));
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error("body too large"));
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (err) { reject(new Error("invalid json")); }
    });
  });
}

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const asset = ASSETS[rel];
  if (!asset) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": asset.type });
  res.end(asset.body);
}

const num = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

/* ---------- api ---------- */

async function api(req, res, route) {
  const user = sessionUser(req);
  const body = req.method === "POST" ? await readBody(req) : {};

  if (route === "version" && req.method === "GET") {
    return json(res, 200, { version: VERSION, started: STARTED });
  }

  if (route === "profiles" && req.method === "GET") {
    return json(res, 200, {
      profiles: db.users.map(u => ({ id: u.id, name: u.name, role: u.role, color: u.color })),
    });
  }

  if (route === "login" && req.method === "POST") {
    const target = db.users.find(u => u.id === body.userId);
    if (!target || !checkSecret(body.pin, target.secret)) {
      return json(res, 401, { error: "That PIN doesn't match. Try again." });
    }
    const token = newSession(target.id);
    return json(res, 200, { user: publicUser(target) }, {
      "Set-Cookie": `sid=${token}; HttpOnly; Path=/; Max-Age=${30 * DAY / 1000}; SameSite=Lax`,
    });
  }

  if (route === "logout") {
    const raw = req.headers.cookie || "";
    const m = raw.match(/(?:^|;\s*)sid=([a-f0-9]+)/);
    if (m) { sessions.delete(m[1]); persistSessions(); }
    return json(res, 200, { ok: true }, { "Set-Cookie": "sid=; HttpOnly; Path=/; Max-Age=0" });
  }

  if (!user) return json(res, 401, { error: "Sign in to continue." });

  const isAdmin = user.role === "admin";
  const deny = () => json(res, 403, { error: "Only a parent can do that." });

  if (route === "state") return json(res, 200, stateFor(user));

  /* --- timer control (children only, on their own tasks) --- */

  if (route === "start" || route === "pause") {
    const task = db.tasks.find(t => t.id === body.taskId);
    if (!task) return json(res, 404, { error: "Task not found." });
    if (user.role !== "child" || task.childId !== user.id) return json(res, 403, { error: "That isn't your task." });

    const log = settle(getLog(task, today()), task);
    if (log.status === "done" || log.status === "awaiting") {
      return json(res, 409, { error: "This one's already finished." });
    }

    if (route === "start") {
      if (log.status !== "running") { log.startedAt = Date.now(); log.status = "running"; }
    } else {
      if (log.status === "running") {
        log.accumulatedMs = elapsedMs(log);
        log.startedAt = null;
        log.status = "paused";
      }
    }
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "submit") {
    const task = db.tasks.find(t => t.id === body.taskId);
    if (!task) return json(res, 404, { error: "Task not found." });
    if (user.role !== "child" || task.childId !== user.id) return json(res, 403, { error: "That isn't your task." });
    if (task.type !== "chore") return json(res, 400, { error: "Study blocks finish on their own timer." });

    const log = getLog(task, today());
    if (log.status !== "running" && log.status !== "paused") {
      return json(res, 409, { error: "Start it before marking it done." });
    }
    log.accumulatedMs = elapsedMs(log);
    log.startedAt = null;
    log.status = "awaiting";
    log.completedAt = Date.now();
    save();
    return json(res, 200, stateFor(user));
  }

  /* --- admin actions --- */

  if (route === "approve") {
    if (!isAdmin) return deny();
    const log = db.logs[body.key];
    if (!log || log.status !== "awaiting") return json(res, 409, { error: "Nothing to approve here." });
    const task = db.tasks.find(t => t.id === log.taskId);
    log.status = "done";
    log.approvedBy = user.id;
    log.completedAt = Date.now();
    award(log.childId, task ? task.points : 0, log);
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "reject") {
    if (!isAdmin) return deny();
    const log = db.logs[body.key];
    if (!log || log.status !== "awaiting") return json(res, 409, { error: "Nothing to send back." });
    log.status = "paused";
    log.accumulatedMs = 0;
    log.completedAt = null;
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "excuse") {
    if (!isAdmin) return deny();
    const log = db.logs[body.key];
    if (!log) return json(res, 404, { error: "Task not found." });
    log.status = "done";
    log.startedAt = null;
    log.approvedBy = user.id;
    log.completedAt = Date.now();
    log.awardedPoints = 0;
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "adjust") {
    if (!isAdmin) return deny();
    const child = db.users.find(u => u.id === body.childId && u.role === "child");
    if (!child) return json(res, 404, { error: "Child not found." });
    child.earned = Math.max(0, child.earned + num(body.delta, -1000, 1000, 0));
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "saveTask") {
    if (!isAdmin) return deny();
    const title = str(body.title, 60);
    if (!title) return json(res, 400, { error: "Give the task a name." });
    const days = Array.isArray(body.days) && body.days.length
      ? body.days.map(d => num(d, 0, 6, 0)) : [0, 1, 2, 3, 4, 5, 6];
    const type = body.type === "chore" ? "chore" : "study";
    const fields = {
      title,
      type,
      // Chores have no set length; only study blocks run against a clock.
      durationMin: type === "chore" ? null : num(body.durationMin, 1, 240, 15),
      points: num(body.points, 0, 500, 10),
      days,
    };
    const existing = db.tasks.find(t => t.id === body.id);
    if (existing) Object.assign(existing, fields);
    else {
      if (!db.users.some(u => u.id === body.childId && u.role === "child")) {
        return json(res, 400, { error: "Pick a child for this task." });
      }
      db.tasks.push(Object.assign({ id: id("t"), childId: body.childId, active: true }, fields));
    }
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "deleteTask") {
    if (!isAdmin) return deny();
    const task = db.tasks.find(t => t.id === body.id);
    if (task) task.active = false;
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "saveReward") {
    if (!isAdmin) return deny();
    const title = str(body.title, 60);
    if (!title) return json(res, 400, { error: "Give the reward a name." });
    const fields = {
      title,
      cost: num(body.cost, 1, 10000, 20),
      childIds: Array.isArray(body.childIds) ? body.childIds.filter(cid => db.users.some(u => u.id === cid)) : [],
    };
    const existing = db.rewards.find(r => r.id === body.id);
    if (existing) Object.assign(existing, fields);
    else db.rewards.push(Object.assign({ id: id("r"), active: true }, fields));
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "deleteReward") {
    if (!isAdmin) return deny();
    const reward = db.rewards.find(r => r.id === body.id);
    if (reward) reward.active = false;
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "saveUser") {
    if (!isAdmin) return deny();
    const name = str(body.name, 40);
    const pin = str(body.pin, 32);
    if (!name) return json(res, 400, { error: "Give them a name." });
    const existing = db.users.find(u => u.id === body.id);
    if (existing) {
      existing.name = name;
      existing.color = str(body.color, 20) || existing.color;
      if (existing.role === "child" && body.allowanceWeekly !== undefined) {
        existing.allowanceWeekly = num(body.allowanceWeekly, 0, 100000, DEFAULT_ALLOWANCE);
        // A cut takes effect now; a raise waits for renewal day.
        existing.allowanceRemaining = Math.min(existing.allowanceRemaining, existing.allowanceWeekly);
      }
      if (pin) {
        if (pin.length < 4) return json(res, 400, { error: "PIN needs at least 4 characters." });
        existing.secret = makeSecret(pin);
      }
    } else {
      if (pin.length < 4) return json(res, 400, { error: "PIN needs at least 4 characters." });
      const role = body.role === "admin" ? "admin" : "child";
      const person = { id: id("u"), name, role, color: str(body.color, 20) || "sage", secret: makeSecret(pin) };
      if (role === "child") {
        person.allowanceWeekly = num(body.allowanceWeekly, 0, 100000, DEFAULT_ALLOWANCE);
        person.allowanceRemaining = person.allowanceWeekly;
        person.allowanceWeek = weekKey();
        person.earned = 0;
      }
      db.users.push(person);
    }
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "deleteUser") {
    if (!isAdmin) return deny();
    if (body.id === user.id) return json(res, 400, { error: "You can't remove yourself." });
    const target = db.users.find(u => u.id === body.id);
    if (!target) return json(res, 404, { error: "Not found." });
    if (target.role === "admin" && db.users.filter(u => u.role === "admin").length <= 1) {
      return json(res, 400, { error: "Keep at least one parent account." });
    }
    db.users = db.users.filter(u => u.id !== body.id);
    db.tasks = db.tasks.filter(t => t.childId !== body.id);
    for (const [token, s] of sessions) if (s.userId === body.id) sessions.delete(token);
    persistSessions();
    save();
    return json(res, 200, stateFor(user));
  }

  /* --- rewards --- */

  if (route === "settings") {
    if (!isAdmin) return deny();
    db.settings.weekStartsOn = body.weekStartsOn === 0 ? 0 : 1;
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "redeem") {
    if (user.role !== "child") return json(res, 403, { error: "Only a child can redeem." });
    const reward = db.rewards.find(r => r.id === body.rewardId && r.active !== false);
    if (!reward) return json(res, 404, { error: "Reward not found." });
    if (reward.childIds.length && !reward.childIds.includes(user.id)) return json(res, 403, { error: "Not available to you." });
    const split = spend(user, reward.cost);
    if (!split) return json(res, 400, { error: "Not enough points yet." });
    db.redemptions.push({
      id: id("x"), rewardId: reward.id, childId: user.id,
      cost: reward.cost, fromAllowance: split.fromAllowance, fromEarned: split.fromEarned,
      week: weekKey(), at: Date.now(), status: "pending",
    });
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "fulfill" || route === "denyRedemption") {
    if (!isAdmin) return deny();
    const red = db.redemptions.find(r => r.id === body.id);
    if (!red || red.status !== "pending") return json(res, 409, { error: "Already handled." });
    if (route === "fulfill") {
      red.status = "fulfilled";
    } else {
      red.status = "denied";
      const child = db.users.find(u => u.id === red.childId);
      if (child) {
        refreshAllowance(child);
        // Allowance only comes back if it is still the same week it was spent.
        const sameWeek = child.allowanceWeek === weekKey() && red.week === weekKey();
        child.earned += red.fromEarned + (sameWeek ? 0 : red.fromAllowance);
        if (sameWeek) child.allowanceRemaining = Math.min(child.allowanceWeekly, child.allowanceRemaining + red.fromAllowance);
      }
    }
    red.handledBy = user.id;
    save();
    return json(res, 200, stateFor(user));
  }

  return json(res, 404, { error: "Unknown endpoint." });
}

/* ---------- server ---------- */

load();
loadSessions();
setInterval(() => {
  // Settle any timers that ran out while nobody was looking.
  const date = today();
  const day = weekday();
  for (const child of db.users.filter(u => u.role === "child")) {
    refreshAllowance(child);
    tasksFor(child.id, date, day);
  }
}, 5000);

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    const route = req.url.slice(5).split("?")[0];
    api(req, res, route).catch(err => {
      console.error(err);
      json(res, 500, { error: "Something went wrong on the server." });
    });
    return;
  }
  serveStatic(req, res);
});

const STARTED = new Date().toISOString();

server.listen(PORT, () => {
  console.log(`Hearth ${VERSION} running at http://localhost:${PORT}`);
});

// Writes are debounced, so flush before exiting or the last few actions vanish.
function shutdown() {
  try { save(true); } catch (err) { console.error(err); }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
