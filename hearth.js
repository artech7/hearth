"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const VERSION = process.env.HEARTH_VERSION || "dev";
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const ASSETS = {
  "/index.html": { type: "text/html; charset=utf-8", body: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#DDE3DD\">\n<title>Hearth</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link href=\"https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap\" rel=\"stylesheet\">\n<link rel=\"icon\" href=\"/favicon.svg\" type=\"image/svg+xml\">\n<link rel=\"icon\" href=\"/favicon-32.png\" sizes=\"32x32\" type=\"image/png\">\n<link rel=\"icon\" href=\"/favicon-16.png\" sizes=\"16x16\" type=\"image/png\">\n<link rel=\"apple-touch-icon\" href=\"/apple-touch-icon.png\">\n<link rel=\"manifest\" href=\"/site.webmanifest\">\n<link rel=\"stylesheet\" href=\"/styles.css\">\n</head>\n<body>\n<div id=\"root\"></div>\n<script src=\"/app.js\"></script>\n</body>\n</html>\n" },
  "/styles.css": { type: "text/css; charset=utf-8", body: ":root {\n  --bg: #DDE3DD;\n  --light: #F1F7F0;\n  --dark: #B3BCB3;\n  --track: #CBD3CB;\n  --ink: #363E38;\n  --muted: #6E7970;\n  --accent: #A8752A;\n  --accent-ink: #855C1C;\n  --good: #4B7A5C;\n  --warn: #A05A3C;\n  --out: 7px 7px 16px var(--dark), -7px -7px 16px var(--light);\n  --out-sm: 4px 4px 9px var(--dark), -4px -4px 9px var(--light);\n  --out-xs: 2px 2px 5px var(--dark), -2px -2px 5px var(--light);\n  --in: inset 5px 5px 11px var(--dark), inset -5px -5px 11px var(--light);\n  --in-sm: inset 3px 3px 6px var(--dark), inset -3px -3px 6px var(--light);\n  --mono: \"JetBrains Mono\", ui-monospace, SFMono-Regular, monospace;\n}\n\n/* Dark applies when the OS asks for it and the user hasn't overridden,\n   or when the user has explicitly chosen it. */\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme=\"light\"]) {\n    --bg: #262B27;\n    --light: #30362F;\n    --dark: #1A1E1B;\n    --track: #20241F;\n    --ink: #DDE4DD;\n    --muted: #939E95;\n    --accent: #D8A24E;\n    --accent-ink: #E4B76F;\n    --good: #86B999;\n    --warn: #DA9A78;\n  }\n}\n\n:root[data-theme=\"dark\"] {\n    --bg: #262B27;\n    --light: #30362F;\n    --dark: #1A1E1B;\n    --track: #20241F;\n    --ink: #DDE4DD;\n    --muted: #939E95;\n    --accent: #D8A24E;\n    --accent-ink: #E4B76F;\n    --good: #86B999;\n    --warn: #DA9A78;\n}\n\n* { box-sizing: border-box; }\n\nhtml, body { height: 100%; }\n\nbody {\n  margin: 0;\n  background: var(--bg);\n  color: var(--ink);\n  font-family: \"Familjen Grotesk\", system-ui, -apple-system, sans-serif;\n  font-size: 15px;\n  -webkit-font-smoothing: antialiased;\n}\n\nbutton { font: inherit; color: inherit; cursor: pointer; }\ninput, select { font: inherit; color: inherit; }\n\n:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }\n\n/* Fluid shell: one column on a phone, filling the window on a desktop. */\n.wrap {\n  width: 100%;\n  max-width: 1240px;\n  margin: 0 auto;\n  padding: 26px clamp(18px, 3.5vw, 44px) 90px;\n}\n\n/* Card lists flow into columns once there's room for them. */\n.cards { display: grid; gap: 14px; grid-template-columns: 1fr; }\n.cards > .card + .card { margin-top: 0; }\n\n.board { display: grid; gap: 30px; grid-template-columns: 1fr; }\n\n@media (min-width: 760px) {\n  .cards { grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); }\n  .tabs { max-width: 760px; }\n  .card.form { max-width: 700px; }\n}\n\n@media (min-width: 1000px) {\n  .board { grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); align-items: start; }\n  .wrap { padding-top: 34px; }\n}\n\n@media (min-width: 1180px) {\n  .cards { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }\n}\n\n/* ---- primitives ---- */\n\n.raised { background: var(--bg); border-radius: 20px; box-shadow: var(--out); }\n.sunk { border-radius: 20px; box-shadow: var(--in-sm); }\n\n.btn {\n  appearance: none; border: 0; background: var(--bg);\n  padding: 11px 18px; border-radius: 14px;\n  box-shadow: var(--out-sm); font-size: 14px;\n  transition: box-shadow 160ms ease, color 160ms ease;\n}\n.btn:active, .btn.on { box-shadow: var(--in-sm); }\n.btn.accent { color: var(--accent-ink); font-weight: 500; }\n.btn.quiet { color: var(--muted); box-shadow: none; padding: 8px 12px; }\n.btn.quiet:hover { color: var(--ink); }\n.btn.small { padding: 8px 13px; font-size: 13px; border-radius: 12px; }\n.btn[disabled] { color: var(--muted); box-shadow: var(--in-sm); cursor: not-allowed; opacity: .75; }\n\n.chip {\n  font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em;\n  padding: 5px 10px; border-radius: 999px; box-shadow: var(--in-sm); color: var(--muted);\n}\n.chip.live { color: var(--accent-ink); }\n.chip.done { color: var(--good); }\n.chip.await { color: var(--warn); }\n\n.eyebrow {\n  font-family: var(--mono); font-size: 10.5px; letter-spacing: .14em;\n  color: var(--muted); margin: 0 0 12px;\n}\n\n.field {\n  width: 100%; border: 0; background: var(--bg);\n  padding: 11px 14px; border-radius: 13px; box-shadow: var(--in-sm);\n}\n.field::placeholder { color: var(--muted); }\n\nlabel.lab { display: block; font-size: 12.5px; color: var(--muted); margin-bottom: 6px; }\n\n.row { display: flex; align-items: center; gap: 12px; }\n.spread { display: flex; align-items: center; justify-content: space-between; gap: 12px; }\n.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }\n.stack > * + * { margin-top: 12px; }\n.muted { color: var(--muted); }\n.mono { font-family: var(--mono); }\n.hide { display: none !important; }\n\n/* ---- app header ---- */\n\n.top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }\n.brand { display: flex; align-items: center; gap: 12px; }\n.brand h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.02em; margin: 0; }\n.brand .date { font-family: var(--mono); font-size: 10.5px; color: var(--muted); letter-spacing: .06em; }\n\n.avatar {\n  width: 44px; height: 44px; border-radius: 50%;\n  display: grid; place-items: center; font-weight: 600; font-size: 15px;\n  background: var(--bg); box-shadow: var(--out-sm); color: var(--accent-ink);\n}\n.avatar.lg { width: 66px; height: 66px; font-size: 22px; box-shadow: var(--out); }\n.avatar.sm { width: 34px; height: 34px; font-size: 12.5px; box-shadow: var(--out-xs); }\n.avatar[data-color=\"ochre\"] { color: #A8752A; }\n.avatar[data-color=\"clay\"] { color: #A85B3E; }\n.avatar[data-color=\"sage\"] { color: #4B7A5C; }\n.avatar[data-color=\"slate\"] { color: #4C6B86; }\n.avatar[data-color=\"plum\"] { color: #7A5580; }\n\n.points {\n  display: inline-flex; align-items: baseline; gap: 6px;\n  padding: 9px 16px; border-radius: 999px; box-shadow: var(--in-sm);\n}\n.points b { font-size: 17px; font-weight: 600; letter-spacing: -0.02em; }\n.points span { font-family: var(--mono); font-size: 10px; letter-spacing: .1em; color: var(--muted); }\n\n/* ---- tabs ---- */\n\n.tabs {\n  position: relative; display: grid; padding: 5px;\n  border-radius: 16px; box-shadow: var(--in-sm); margin-bottom: 24px;\n}\n.tabs .thumb {\n  position: absolute; top: 5px; left: 5px; bottom: 5px;\n  border-radius: 12px; background: var(--bg); box-shadow: var(--out-sm);\n  transition: transform 340ms cubic-bezier(.34, 1.3, .5, 1);\n}\n.tabs button {\n  position: relative; z-index: 1; border: 0; background: none;\n  padding: 10px 4px; font-size: 13.5px; color: var(--muted);\n  border-radius: 12px; transition: color 200ms ease;\n}\n.tabs button[aria-selected=\"true\"] { color: var(--accent-ink); font-weight: 500; }\n\n/* ---- task cards ---- */\n\n.card { background: var(--bg); border-radius: 20px; box-shadow: var(--out); padding: 16px 18px; }\n.card + .card { margin-top: 14px; }\n.card.flat { box-shadow: var(--in-sm); }\n.card h3 { margin: 0; font-size: 15.5px; font-weight: 500; letter-spacing: -0.01em; }\n.card .meta { font-family: var(--mono); font-size: 10.5px; color: var(--muted); letter-spacing: .05em; margin-top: 4px; }\n\n.ring { position: relative; width: 54px; height: 54px; flex: 0 0 54px; border-radius: 50%; box-shadow: var(--in-sm); }\n.ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }\n.ring svg circle { fill: none; stroke-linecap: round; }\n.ring .label {\n  position: absolute; inset: 0; display: grid; place-items: center;\n  font-family: var(--mono); font-size: 10px; color: var(--muted);\n}\n.ring .label.on { color: var(--accent-ink); }\n\n.pad { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; border: 0; background: var(--bg); box-shadow: var(--out-sm); color: var(--muted); transition: box-shadow 160ms ease, color 160ms ease; }\n.pad:hover { color: var(--ink); }\n.pad:active { box-shadow: var(--in-sm); }\n.pad.accent { color: var(--accent-ink); }\n.pad svg { width: 17px; height: 17px; fill: currentColor; }\n.pad[disabled] { box-shadow: var(--in-sm); cursor: default; }\n\n.section-title { font-size: 13px; color: var(--muted); margin: 26px 0 12px; font-weight: 500; }\n.section-title:first-child { margin-top: 0; }\n\n/* ---- focus overlay ---- */\n\n.overlay {\n  position: fixed; inset: 0; z-index: 40; background: var(--bg);\n  display: flex; flex-direction: column; align-items: center; justify-content: center;\n  padding: 24px; gap: 26px;\n}\n.dial { position: relative; width: 280px; height: 280px; border-radius: 50%; box-shadow: var(--in); }\n.dial svg { position: absolute; inset: 0; transform: rotate(-90deg); }\n.dial svg circle { fill: none; stroke-linecap: round; }\n.dial .face {\n  position: absolute; inset: 30px; border-radius: 50%;\n  background: var(--bg); box-shadow: var(--out);\n  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;\n}\n.readout { font-size: 54px; font-weight: 500; letter-spacing: -0.035em; font-variant-numeric: tabular-nums; line-height: 1; }\n.caption { font-family: var(--mono); font-size: 10.5px; letter-spacing: .12em; color: var(--muted); text-align: center; }\n.key {\n  width: 78px; height: 78px; border-radius: 50%; border: 0; background: var(--bg);\n  display: grid; place-items: center; box-shadow: var(--out); color: var(--accent-ink);\n  transition: box-shadow 180ms ease;\n}\n.key:active, .key.on { box-shadow: var(--in); }\n.key svg { width: 26px; height: 26px; fill: currentColor; }\n.key[disabled] { color: var(--muted); box-shadow: var(--in); cursor: default; }\n\n/* ---- login ---- */\n\n.login { min-height: 100%; display: grid; place-items: center; padding: 40px 20px; }\n.login .panel { width: 100%; max-width: 380px; padding: 30px 28px; border-radius: 30px; box-shadow: var(--out); }\n.profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 14px; }\n.profile {\n  border: 0; background: var(--bg); border-radius: 20px; box-shadow: var(--out-sm);\n  padding: 16px 8px; display: flex; flex-direction: column; align-items: center; gap: 9px;\n  transition: box-shadow 160ms ease;\n}\n.profile:active { box-shadow: var(--in-sm); }\n.profile .nm { font-size: 13.5px; font-weight: 500; }\n.profile .rl { font-family: var(--mono); font-size: 9.5px; letter-spacing: .1em; color: var(--muted); }\n\n.pin-dots { display: flex; justify-content: center; gap: 13px; margin: 22px 0 26px; }\n.pin-dots i { width: 13px; height: 13px; border-radius: 50%; box-shadow: var(--in-sm); }\n.pin-dots i.filled { background: var(--accent); box-shadow: var(--out-xs); }\n.keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 13px; }\n.keypad button {\n  border: 0; background: var(--bg); border-radius: 18px; padding: 15px 0;\n  font-size: 20px; font-weight: 500; box-shadow: var(--out-sm);\n  transition: box-shadow 130ms ease;\n}\n.keypad button:active { box-shadow: var(--in-sm); }\n.keypad button.util { font-size: 13px; color: var(--muted); box-shadow: none; }\n\n.err { color: var(--warn); font-size: 13px; min-height: 18px; text-align: center; }\n\n.toast {\n  position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%);\n  padding: 12px 20px; border-radius: 14px; background: var(--bg); box-shadow: var(--out);\n  font-size: 13.5px; z-index: 60; max-width: 90vw;\n}\n\n.empty { text-align: center; color: var(--muted); font-size: 13.5px; padding: 30px 10px; }\n\n@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }\n\n@media (max-width: 420px) {\n  .dial { width: 244px; height: 244px; }\n  .readout { font-size: 46px; }\n}\n\n@media (min-width: 900px) and (min-height: 720px) {\n  .dial { width: 340px; height: 340px; }\n  .dial .face { inset: 36px; }\n  .readout { font-size: 66px; }\n}\n\n/* theme switch */\n.theme {\n  width: 34px; height: 34px; border-radius: 50%; border: 0;\n  background: var(--bg); box-shadow: var(--out-xs); color: var(--muted);\n  display: grid; place-items: center; flex: 0 0 34px;\n  transition: box-shadow 160ms ease, color 160ms ease;\n}\n.theme:hover { color: var(--ink); }\n.theme:active { box-shadow: var(--in-sm); }\n.theme svg { width: 16px; height: 16px; fill: currentColor; }\n\n/* ---- reward cards: layered parallax scenes ---- */\n\n.reward-grid {\n  display: grid;\n  gap: 20px;\n  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));\n}\n\n.rcard {\n  position: relative;\n  aspect-ratio: 350 / 500;\n  perspective: 1000px;\n  overflow: hidden;\n  border-radius: 26px;\n  background: #1B2320;\n  isolation: isolate;\n  /* Inverse of the raised shadow: the page lip catches light at the\n     bottom-right and falls into shade at the top-left, so the card reads as\n     set into the surface rather than sitting on it. */\n  box-shadow:\n    3px 3px 9px var(--light),\n    -3px -3px 9px var(--dark);\n}\n\n.player {\n  position: absolute;\n  inset: -14%;\n  transform-origin: center;\n  will-change: transform;\n  transition: transform 420ms cubic-bezier(.22,.9,.3,1);\n}\n.rcard.live .player { transition: transform 90ms linear; }\n\n.player svg { width: 100%; height: 100%; display: block; }\n\n.player:nth-child(1) { z-index: 0; filter: blur(5px); }\n.player:nth-child(2) { z-index: 1; filter: blur(3px); }\n.player:nth-child(3) { z-index: 2; filter: blur(2px); }\n.player:nth-child(4) { z-index: 3; }\n.player:nth-child(5) { z-index: 4; filter: blur(2px); }\n.player:nth-child(6) { z-index: 5; filter: blur(3px); }\n.player:nth-child(7) { z-index: 6; filter: blur(5px); }\n\n/* Keeps the text legible over whatever the scene does. */\n.rcard::after {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  z-index: 8;\n  border-radius: inherit;\n  background: linear-gradient(to top, rgba(12,18,15,.88) 0%, rgba(12,18,15,.45) 34%, rgba(12,18,15,0) 62%);\n  /* The bevel proper: the surrounding page overhangs the top-left edge and\n     casts onto the artwork, while the far lip picks up a thin highlight.\n     Kept tight to the edge so it frames the scene instead of fogging it. */\n  box-shadow:\n    inset 6px 6px 11px rgba(0,0,0,.66),\n    inset -5px -5px 11px rgba(255,255,255,.13),\n    inset 0 0 0 1px rgba(0,0,0,.38);\n  pointer-events: none;\n}\n\n.rcard-body {\n  position: absolute;\n  z-index: 10;\n  left: 0; right: 0; bottom: 0;\n  padding: 18px 18px 16px;\n  display: flex;\n  align-items: flex-end;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.rcard-body h3 {\n  margin: 0 0 5px;\n  font-size: 17px;\n  font-weight: 600;\n  letter-spacing: -0.02em;\n  color: #F2F6F0;\n  text-shadow: 0 1px 10px rgba(0,0,0,.6);\n}\n\n.rcard-body .cost {\n  font-family: var(--mono);\n  font-size: 10.5px;\n  letter-spacing: .07em;\n  color: #C8D2C6;\n}\n\n.rcard-redeem {\n  flex: 0 0 auto;\n  border: 0;\n  border-radius: 13px;\n  padding: 10px 15px;\n  font-size: 13px;\n  font-weight: 500;\n  color: #2A2013;\n  background: #D8A24E;\n  box-shadow: 0 5px 16px rgba(0,0,0,.45);\n  transition: transform 140ms ease, background 140ms ease;\n}\n.rcard-redeem:hover { background: #E4B36A; }\n.rcard-redeem:active { transform: translateY(1px); }\n.rcard-redeem[disabled] {\n  background: rgba(226,232,224,.16);\n  color: #C0CABE;\n  box-shadow: none;\n  cursor: not-allowed;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .player { transition: none; transform: none !important; }\n}\n\n/* ---- sky picker ---- */\n\n.sky-picker {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));\n  gap: 8px;\n}\n\n.swatch {\n  height: 34px;\n  border: 0;\n  border-radius: 11px;\n  box-shadow: var(--out-xs);\n  transition: box-shadow 150ms ease, transform 150ms ease;\n}\n.swatch:hover { transform: translateY(-1px); }\n.swatch.on {\n  box-shadow: var(--out-xs), 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);\n}\n\n.swatch.auto {\n  background: var(--bg);\n  color: var(--muted);\n  font-size: 11px;\n  font-family: var(--mono);\n  letter-spacing: .04em;\n}\n.swatch.auto.on { color: var(--accent-ink); }\n\n/* The form preview is a real card, just smaller and inert. */\n.rcard.preview {\n  max-width: 240px;\n  pointer-events: none;\n  box-shadow:\n    2px 2px 6px var(--light),\n    -2px -2px 6px var(--dark);\n}\n.rcard.preview .rcard-body { padding: 14px; }\n.rcard.preview .rcard-body h3 { font-size: 15px; }\n\n/* ---- week calendar ---- */\n\n.calendar {\n  display: grid;\n  grid-template-columns: repeat(7, 1fr);\n  gap: 7px;\n  margin-bottom: 14px;\n}\n\n.cday {\n  border: 0;\n  background: var(--bg);\n  border-radius: 15px;\n  padding: 10px 2px 9px;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 5px;\n  box-shadow: var(--in-sm);\n  transition: box-shadow 180ms ease, color 180ms ease;\n}\n\n.cday .dw {\n  font-family: var(--mono);\n  font-size: 9.5px;\n  letter-spacing: .08em;\n  color: var(--muted);\n}\n\n.cday .dn {\n  font-size: 15px;\n  font-weight: 500;\n  letter-spacing: -0.02em;\n  font-variant-numeric: tabular-nums;\n}\n\n.cday .dbar {\n  width: 60%;\n  height: 3px;\n  border-radius: 2px;\n  background: var(--track);\n  overflow: hidden;\n}\n.cday .dbar i { display: block; height: 100%; background: var(--accent); border-radius: 2px; }\n.cday.rest .dbar { opacity: .35; }\n\n/* Today is raised out of the strip; the day you're looking at gets the ring. */\n.cday.today { box-shadow: var(--out-sm); }\n.cday.today .dn { color: var(--accent-ink); font-weight: 600; }\n.cday.sel { box-shadow: var(--out-sm), 0 0 0 2px var(--bg), 0 0 0 4px var(--accent); }\n.cday.today.sel .dn { color: var(--accent-ink); }\n\n.calnote {\n  font-family: var(--mono);\n  font-size: 10.5px;\n  letter-spacing: .06em;\n  color: var(--muted);\n  text-align: center;\n  margin: -4px 0 16px;\n}\n\n.streak-line {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  font-size: 13px;\n  color: var(--muted);\n  margin-bottom: 18px;\n}\n\n/* ---- month planner ---- */\n\n.mhead {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  margin-bottom: 16px;\n}\n.mtitle { font-size: 16px; font-weight: 500; letter-spacing: -0.02em; }\n\n.mgrid-head {\n  display: grid;\n  grid-template-columns: repeat(7, 1fr);\n  gap: 6px;\n  margin-bottom: 7px;\n}\n.mgrid-head span {\n  text-align: center;\n  font-family: var(--mono);\n  font-size: 9.5px;\n  letter-spacing: .08em;\n  color: var(--muted);\n}\n\n.mgrid {\n  display: grid;\n  grid-template-columns: repeat(7, 1fr);\n  gap: 6px;\n  margin-bottom: 26px;\n}\n\n.mcell {\n  border: 0;\n  background: var(--bg);\n  border-radius: 13px;\n  aspect-ratio: 1;\n  padding: 7px 4px 6px;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 4px;\n  box-shadow: var(--in-sm);\n  transition: box-shadow 160ms ease;\n}\n.mcell.empty { box-shadow: none; background: none; }\n.mcell.today { box-shadow: var(--out-sm); }\n.mcell.today .mnum { color: var(--accent-ink); font-weight: 600; }\n.mcell.sel { box-shadow: var(--out-sm), 0 0 0 2px var(--bg), 0 0 0 3px var(--accent); }\n\n.mnum { font-size: 13.5px; font-variant-numeric: tabular-nums; }\n\n.mbar {\n  width: 62%;\n  height: 3px;\n  border-radius: 2px;\n  background: var(--track);\n  overflow: hidden;\n}\n.mbar.blank { opacity: 0; }\n.mbar i { display: block; height: 100%; background: var(--accent); }\n\n.mdots { display: flex; gap: 3px; height: 5px; }\n.mdots i {\n  width: 4px; height: 4px; border-radius: 50%;\n  background: var(--accent-ink); opacity: .85;\n}\n.mdots i.done { background: var(--muted); opacity: .5; }\n\n.daypanel { border-top: 0.5px solid var(--track); padding-top: 22px; }\n\n@media (max-width: 460px) {\n  .mgrid, .mgrid-head { gap: 4px; }\n  .mcell { border-radius: 10px; padding: 4px 2px; }\n  .mnum { font-size: 12px; }\n}\n\n/* ---- motion ----\n   Everything here is short and settles. The surfaces are meant to feel like\n   pressed material, so things ease into place rather than bouncing. */\n\n@keyframes rise {\n  from { opacity: 0; transform: translateY(9px); }\n  to   { opacity: 1; transform: none; }\n}\n\n@keyframes settle {\n  0%   { box-shadow: var(--out); }\n  45%  { box-shadow: var(--in-sm), 0 0 0 2px var(--accent); }\n  100% { box-shadow: var(--out); }\n}\n\n@keyframes bump {\n  0%   { transform: scale(1); }\n  40%  { transform: scale(1.09); }\n  100% { transform: scale(1); }\n}\n\n@keyframes fadeScale {\n  from { opacity: 0; transform: scale(.97); }\n  to   { opacity: 1; transform: none; }\n}\n\n@keyframes toastIn {\n  from { opacity: 0; transform: translate(-50%, 14px); }\n  to   { opacity: 1; transform: translate(-50%, 0); }\n}\n\n@keyframes dotPop {\n  0%   { transform: scale(.4); }\n  60%  { transform: scale(1.15); }\n  100% { transform: scale(1); }\n}\n\n@keyframes breathe {\n  0%, 100% { opacity: .55; }\n  50%      { opacity: 1; }\n}\n\n.view.enter > * {\n  animation: rise 400ms cubic-bezier(.22, .9, .3, 1) both;\n}\n.view.enter > *:nth-child(1) { animation-delay: 0ms; }\n.view.enter > *:nth-child(2) { animation-delay: 45ms; }\n.view.enter > *:nth-child(3) { animation-delay: 90ms; }\n.view.enter > *:nth-child(4) { animation-delay: 130ms; }\n.view.enter > *:nth-child(5) { animation-delay: 165ms; }\n.view.enter > *:nth-child(n+6) { animation-delay: 195ms; }\n\n/* Cards inside a grid fan in rather than arriving as a block. */\n.view.enter .cards > *:nth-child(1) { animation: rise 420ms cubic-bezier(.22,.9,.3,1) both 60ms; }\n.view.enter .cards > *:nth-child(2) { animation: rise 420ms cubic-bezier(.22,.9,.3,1) both 110ms; }\n.view.enter .cards > *:nth-child(3) { animation: rise 420ms cubic-bezier(.22,.9,.3,1) both 160ms; }\n.view.enter .cards > *:nth-child(4) { animation: rise 420ms cubic-bezier(.22,.9,.3,1) both 205ms; }\n.view.enter .cards > *:nth-child(n+5) { animation: rise 420ms cubic-bezier(.22,.9,.3,1) both 245ms; }\n\n.card.settled { animation: settle 900ms ease-out; }\n.points.bump { animation: bump 520ms cubic-bezier(.3, 1.5, .5, 1); }\n.overlay { animation: fadeScale 260ms cubic-bezier(.22, .9, .3, 1); }\n.toast { animation: toastIn 320ms cubic-bezier(.22, .9, .3, 1); }\n.pin-dots i.filled { animation: dotPop 260ms cubic-bezier(.3, 1.5, .5, 1); }\n\n/* Login profiles arrive one after another. */\n.profile { animation: rise 380ms cubic-bezier(.22,.9,.3,1) both; }\n.profile:nth-child(2) { animation-delay: 55ms; }\n.profile:nth-child(3) { animation-delay: 110ms; }\n.profile:nth-child(n+4) { animation-delay: 160ms; }\n\n/* The month grid fills in row by row. */\n.view.enter .mcell { animation: rise 300ms ease-out both; }\n.view.enter .mcell:nth-child(7n+1) { animation-delay: 30ms; }\n.view.enter .mcell:nth-child(7n+4) { animation-delay: 60ms; }\n.view.enter .mcell:nth-child(7n)   { animation-delay: 90ms; }\n\n/* Bars and rings ease to their new value instead of snapping. */\n.mbar i, .cday .dbar i { transition: width 520ms cubic-bezier(.22, .9, .3, 1); }\n.ring .js-arc { transition: stroke-dashoffset 700ms cubic-bezier(.22, .9, .3, 1); }\n\n.empty { animation: breathe 2.4s ease-in-out infinite; }\n\n.streak-line .chip.live { animation: bump 700ms cubic-bezier(.3, 1.4, .5, 1); }\n\n@media (prefers-reduced-motion: reduce) {\n  *, .view.enter > *, .view.enter .cards > *, .view.enter .mcell,\n  .card.settled, .points.bump, .overlay, .toast, .profile, .empty {\n    animation: none !important;\n    transition: none !important;\n  }\n}\n\n/* ---- day selection ---- */\n\n.selbar { margin-bottom: 18px; }\n\n.mcell.picked {\n  box-shadow: var(--out-sm), 0 0 0 2px var(--bg), 0 0 0 3px var(--accent-ink);\n}\n.mcell.picked .mnum { color: var(--accent-ink); font-weight: 600; }\n\n.seldays {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  margin-top: 14px;\n  padding-top: 12px;\n  border-top: 0.5px solid var(--track);\n}\n\n.selchip {\n  border: 0;\n  background: var(--bg);\n  border-radius: 9px;\n  padding: 5px 9px;\n  font-family: var(--mono);\n  font-size: 10.5px;\n  color: var(--muted);\n  box-shadow: var(--out-xs);\n  transition: color 150ms ease, box-shadow 150ms ease;\n}\n.selchip:hover { color: var(--warn); }\n.selchip:active { box-shadow: var(--in-sm); }\n" },
  "/app.js": { type: "text/javascript; charset=utf-8", body: "\"use strict\";\n\nconst root = document.getElementById(\"root\");\nconst DAYS = [\"S\", \"M\", \"T\", \"W\", \"T\", \"F\", \"S\"];\nconst COLORS = [\"ochre\", \"clay\", \"sage\", \"slate\", \"plum\"];\n\nconst S = {\n  view: \"loading\",\n  profiles: [],\n  pick: null,\n  pin: \"\",\n  err: \"\",\n  state: null,\n  tab: 0,\n  focus: null,\n  fetchedAt: 0,\n  form: null,\n  entering: false,\n  lastKey: \"\",\n  bump: false,\n  justDone: [],\n  month: null,\n  monthData: null,\n  selecting: false,\n  sel: [],\n  toast: \"\",\n  taskKind: \"study\",\n  day: null,        // null means today\n  dayData: null,    // fetched view for a non-current day\n};\n\n/* ---------- theme ---------- */\n\nconst THEMES = [\"system\", \"light\", \"dark\"];\n\nfunction currentTheme() {\n  try {\n    const saved = localStorage.getItem(\"hearth-theme\");\n    return THEMES.includes(saved) ? saved : \"system\";\n  } catch (err) {\n    return \"system\";\n  }\n}\n\n// Old browsers and some webviews have no matchMedia; theming must not take\n// the whole app down with it.\nfunction darkMedia() {\n  return typeof window.matchMedia === \"function\"\n    ? window.matchMedia(\"(prefers-color-scheme: dark)\")\n    : null;\n}\n\nfunction applyTheme(mode) {\n  const root = document.documentElement;\n  if (mode === \"system\") root.removeAttribute(\"data-theme\");\n  else root.setAttribute(\"data-theme\", mode);\n  const mq = darkMedia();\n  const dark = mode === \"dark\" || (mode === \"system\" && !!mq && mq.matches);\n  const meta = document.querySelector('meta[name=\"theme-color\"]');\n  if (meta) meta.setAttribute(\"content\", dark ? \"#262B27\" : \"#DDE3DD\");\n}\n\nfunction cycleTheme() {\n  const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];\n  try { localStorage.setItem(\"hearth-theme\", next); } catch (err) { /* private mode */ }\n  applyTheme(next);\n  return next;\n}\n\napplyTheme(currentTheme());\nconst themeMedia = darkMedia();\nif (themeMedia && themeMedia.addEventListener) {\n  themeMedia.addEventListener(\"change\", () => {\n    if (currentTheme() === \"system\") applyTheme(\"system\");\n  });\n}\n\n/* ---------- helpers ---------- */\n\nconst esc = s => String(s == null ? \"\" : s).replace(/[&<>\"']/g, c =>\n  ({ \"&\": \"&amp;\", \"<\": \"&lt;\", \">\": \"&gt;\", '\"': \"&quot;\", \"'\": \"&#39;\" }[c]));\n\nconst initials = name => name.trim().split(/\\s+/).map(w => w[0]).join(\"\").slice(0, 2).toUpperCase();\n\nconst clock = ms => {\n  const s = Math.max(0, Math.round(ms / 1000));\n  return String(Math.floor(s / 60)).padStart(2, \"0\") + \":\" + String(s % 60).padStart(2, \"0\");\n};\n\nconst el = sel => document.querySelector(sel);\n\nasync function post(route, body) {\n  const res = await fetch(\"/api/\" + route, {\n    method: \"POST\",\n    headers: { \"Content-Type\": \"application/json\" },\n    body: JSON.stringify(body || {}),\n  });\n  const data = await res.json().catch(() => ({}));\n  if (!res.ok) throw new Error(data.error || \"Something went wrong.\");\n  return data;\n}\n\nasync function get(route) {\n  const res = await fetch(\"/api/\" + route, { headers: { \"Accept\": \"application/json\" } });\n  const data = await res.json().catch(() => ({}));\n  if (!res.ok) throw new Error(data.error || \"Something went wrong.\");\n  return data;\n}\n\nfunction toast(msg) {\n  S.toast = msg;\n  render();\n  clearTimeout(toast.t);\n  toast.t = setTimeout(() => { S.toast = \"\"; render(); }, 2600);\n}\n\nfunction setState(data) {\n  if (S.state && S.state.me && data.me && typeof data.me.points === \"number\"\n      && S.state.me.points !== data.me.points) S.bump = true;\n  if (data.tasks && S.state) notifyFinished(data.tasks);\n  else if (data.tasks) data.tasks.forEach(t => chimed.add(\"seen:\" + (t.key || t.id)));\n  S.state = data;\n  S.fetchedAt = Date.now();\n  S.view = data.me.role === \"admin\" ? \"admin\" : \"child\";\n}\n\n// The selected day: live state when it's today, a fetched snapshot otherwise.\nfunction dayView() {\n  const st = S.state;\n  if (!S.day || S.day === st.date) {\n    return { date: st.date, live: true, tasks: st.tasks, board: st.board, week: st.week };\n  }\n  if (S.dayData && S.dayData.date === S.day) return S.dayData;\n  return { date: S.day, live: false, tasks: [], board: [], week: st.week, loading: true };\n}\n\n/* ---------- live elapsed ---------- */\n\nfunction liveElapsed(task) {\n  return task.elapsedMs + (task.running ? Date.now() - S.fetchedAt : 0);\n}\n\nfunction taskById(id) {\n  if (!S.state) return null;\n  const pool = S.state.tasks || (S.state.board || []).flatMap(b => b.tasks);\n  return pool.find(t => t.id === id) || null;\n}\n\n/* ---------- svg bits ---------- */\n\nconst ICON = {\n  play: '<svg viewBox=\"0 0 24 24\"><path d=\"M8 5v14l11-7z\"/></svg>',\n  pause: '<svg viewBox=\"0 0 24 24\"><path d=\"M7 5h4v14H7zm6 0h4v14h-4z\"/></svg>',\n  check: '<svg viewBox=\"0 0 24 24\"><path d=\"M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z\"/></svg>',\n  back: '<svg viewBox=\"0 0 24 24\"><path d=\"M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z\"/></svg>',\n  system: '<svg viewBox=\"0 0 24 24\"><path d=\"M4 5h16v10H4zm0 12h16v2H4z\"/></svg>',\n  sun: '<svg viewBox=\"0 0 24 24\"><path d=\"M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5h0v3h0zm-1 0h2v3h-2zm0 19h2v3h-2zM2 11h3v2H2zm17 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zM16.3 17.7l1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z\"/></svg>',\n  moon: '<svg viewBox=\"0 0 24 24\"><path d=\"M12.3 3a7.5 7.5 0 1 0 8.7 9.6A6.5 6.5 0 0 1 12.3 3z\"/></svg>',\n  lock: '<svg viewBox=\"0 0 24 24\"><path d=\"M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2zM9 7a3 3 0 0 1 6 0v2H9V7z\"/></svg>',\n};\n\nfunction ringSvg(pct, r, sw) {\n  const c = 2 * Math.PI * r;\n  const size = (r + sw) * 2;\n  return `<svg viewBox=\"0 0 ${size} ${size}\">\n    <circle cx=\"${size / 2}\" cy=\"${size / 2}\" r=\"${r}\" stroke=\"var(--track)\" stroke-width=\"${sw}\"></circle>\n    <circle class=\"js-arc\" cx=\"${size / 2}\" cy=\"${size / 2}\" r=\"${r}\" stroke=\"var(--accent)\" stroke-width=\"${sw}\"\n      stroke-dasharray=\"${c.toFixed(1)}\" stroke-dashoffset=\"${(c * (1 - pct)).toFixed(1)}\"></circle>\n  </svg>`;\n}\n\n/* ---------- login ---------- */\n\nfunction loginView() {\n  if (!S.pick) {\n    return `<div class=\"login\"><div class=\"panel\">\n      <div class=\"spread\" style=\"margin-bottom:18px\">\n        <p class=\"eyebrow\" style=\"margin:0\">Hearth</p>\n        ${themeButton()}\n      </div>\n      <h2 style=\"margin:0 0 20px;font-size:19px;font-weight:600;letter-spacing:-.02em\">Who's here?</h2>\n      <div class=\"profile-grid\">\n        ${S.profiles.map(p => `\n          <button class=\"profile\" data-act=\"pick\" data-id=\"${p.id}\">\n            <span class=\"avatar\" data-color=\"${esc(p.color)}\">${esc(initials(p.name))}</span>\n            <span class=\"nm\">${esc(p.name)}</span>\n            <span class=\"rl\">${p.role === \"admin\" ? \"parent\" : \"child\"}</span>\n          </button>`).join(\"\")}\n      </div>\n    </div></div>`;\n  }\n\n  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];\n  return `<div class=\"login\"><div class=\"panel\">\n    <div style=\"display:flex;flex-direction:column;align-items:center;gap:10px\">\n      <span class=\"avatar lg\" data-color=\"${esc(S.pick.color)}\">${esc(initials(S.pick.name))}</span>\n      <div style=\"font-size:16px;font-weight:500\">${esc(S.pick.name)}</div>\n      <div class=\"rl mono\" style=\"font-size:10px;letter-spacing:.1em;color:var(--muted)\">enter pin</div>\n    </div>\n    <div class=\"pin-dots\">\n      ${[0, 1, 2, 3].map(i => `<i class=\"${i < S.pin.length ? \"filled\" : \"\"}\"></i>`).join(\"\")}\n    </div>\n    <p class=\"err\">${esc(S.err)}</p>\n    <div class=\"keypad\" style=\"margin-top:14px\">\n      ${keys.map(k => `<button data-act=\"digit\" data-d=\"${k}\">${k}</button>`).join(\"\")}\n      <button class=\"util\" data-act=\"unpick\">Back</button>\n      <button data-act=\"digit\" data-d=\"0\">0</button>\n      <button class=\"util\" data-act=\"del\">Delete</button>\n    </div>\n  </div></div>`;\n}\n\nasync function submitPin() {\n  try {\n    await post(\"login\", { userId: S.pick.id, pin: S.pin });\n    S.pin = \"\"; S.err = \"\"; S.pick = null;\n    setState(await get(\"state\"));\n    render();\n  } catch (e) {\n    S.err = e.message;\n    S.pin = \"\";\n    render();\n  }\n}\n\n\n/* ---------- reward scenes ---------- */\n\n// Each reward gets a scene generated from its own name, so a reward added\n// later gets its own artwork without anyone drawing anything.\nfunction seedFrom(str) {\n  let h = 2166136261;\n  for (let i = 0; i < str.length; i++) {\n    h ^= str.charCodeAt(i);\n    h = Math.imul(h, 16777619);\n  }\n  return h >>> 0;\n}\n\nfunction makeRng(seed) {\n  let s = seed || 1;\n  return () => {\n    s ^= s << 13; s >>>= 0;\n    s ^= s >> 17;\n    s ^= s << 5; s >>>= 0;\n    return s / 4294967296;\n  };\n}\n\nconst SKIES = [\n  { id: \"midnight\", name: \"Midnight\", from: \"#12305C\", to: \"#2E5E7E\" },\n  { id: \"slate\",    name: \"Slate\",    from: \"#1B2E4A\", to: \"#4A5F78\" },\n  { id: \"ink\",      name: \"Ink\",      from: \"#0E1420\", to: \"#2B3B55\" },\n  { id: \"ice\",      name: \"Ice\",      from: \"#152B33\", to: \"#4E8092\" },\n  { id: \"pine\",     name: \"Pine\",     from: \"#0F2E3A\", to: \"#356A63\" },\n  { id: \"aurora\",   name: \"Aurora\",   from: \"#08221F\", to: \"#1F6B57\" },\n  { id: \"moss\",     name: \"Moss\",     from: \"#17281B\", to: \"#46704A\" },\n  { id: \"plum\",     name: \"Plum\",     from: \"#241F4A\", to: \"#5B4A72\" },\n  { id: \"violet\",   name: \"Violet\",   from: \"#1A1240\", to: \"#4B3A8C\" },\n  { id: \"dusk\",     name: \"Dusk\",     from: \"#221A2E\", to: \"#6E5A7A\" },\n  { id: \"mauve\",    name: \"Mauve\",    from: \"#2A1E38\", to: \"#6B4763\" },\n  { id: \"rose\",     name: \"Rose\",     from: \"#331726\", to: \"#8A4A5E\" },\n  { id: \"ember\",    name: \"Ember\",    from: \"#2B1A18\", to: \"#7A4230\" },\n  { id: \"rust\",     name: \"Rust\",     from: \"#301C12\", to: \"#8A5326\" },\n  { id: \"copper\",   name: \"Copper\",   from: \"#241410\", to: \"#96602B\" },\n  { id: \"steel\",    name: \"Steel\",    from: \"#13263A\", to: \"#3E6B84\" },\n];\n\nfunction skyFor(title, chosen) {\n  const picked = SKIES.find(s => s.id === chosen);\n  return picked || SKIES[seedFrom(title) % SKIES.length];\n}\n\nfunction ridge(rand, baseY, height, jag, width) {\n  const step = width / 9;\n  let d = `M0 ${baseY + height}`;\n  let x = 0;\n  d += ` L0 ${baseY - rand() * height * 0.3}`;\n  while (x < width) {\n    x += step;\n    const peak = baseY - (0.35 + rand() * jag) * height;\n    d += ` L${(x - step / 2).toFixed(1)} ${peak.toFixed(1)} L${x.toFixed(1)} ${(baseY - rand() * height * 0.35).toFixed(1)}`;\n  }\n  return d + ` L${width} ${baseY + height} Z`;\n}\n\nfunction trees(rand, count, baseY, size, width, fill) {\n  let out = \"\";\n  for (let i = 0; i < count; i++) {\n    const x = rand() * width;\n    const h = size * (0.7 + rand() * 0.6);\n    const w = h * 0.42;\n    out += `<path d=\"M${x.toFixed(1)} ${(baseY - h).toFixed(1)}\n      L${(x + w).toFixed(1)} ${baseY} L${(x - w).toFixed(1)} ${baseY} Z\" fill=\"${fill}\"/>`;\n    out += `<rect x=\"${(x - w * 0.11).toFixed(1)}\" y=\"${(baseY - 2).toFixed(1)}\"\n      width=\"${(w * 0.22).toFixed(1)}\" height=\"${(h * 0.16).toFixed(1)}\" fill=\"${fill}\"/>`;\n  }\n  return out;\n}\n\nfunction svgLayer(inner, w, h) {\n  return `<div class=\"player\"><svg viewBox=\"0 0 ${w} ${h}\" preserveAspectRatio=\"xMidYMid slice\">${inner}</svg></div>`;\n}\n\nfunction rewardScene(title, uid, chosenSky) {\n  const rand = makeRng(seedFrom(title));\n  const W = 360, H = 520;\n  // Gradient ids share one document across the whole grid, so they have to be\n  // unique per card or every card renders with the first card's sky.\n  const gid = \"s\" + (uid || seedFrom(title).toString(36));\n  const sky = skyFor(title, chosenSky);\n  const layers = [];\n\n  // 1 — sky, moon, stars\n  let stars = \"\";\n  for (let i = 0; i < 40; i++) {\n    stars += `<circle cx=\"${(rand() * W).toFixed(1)}\" cy=\"${(rand() * H * 0.55).toFixed(1)}\"\n      r=\"${(0.5 + rand() * 1.4).toFixed(2)}\" fill=\"#F4F8F2\" opacity=\"${(0.25 + rand() * 0.6).toFixed(2)}\"/>`;\n  }\n  layers.push(svgLayer(`\n    <defs><linearGradient id=\"sky-${gid}\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">\n      <stop offset=\"0\" stop-color=\"${sky.from}\"/><stop offset=\"1\" stop-color=\"${sky.to}\"/>\n    </linearGradient></defs>\n    <rect width=\"${W}\" height=\"${H}\" fill=\"url(#sky-${gid})\"/>\n    ${stars}\n    <circle cx=\"${(60 + rand() * 240).toFixed(0)}\" cy=\"${(60 + rand() * 70).toFixed(0)}\"\n      r=\"${(16 + rand() * 12).toFixed(0)}\" fill=\"#EDF2E8\" opacity=\".82\"/>`, W, H));\n\n  // 2 — far peaks\n  layers.push(svgLayer(`<path d=\"${ridge(rand, 300, 150, 0.55, W)}\" fill=\"#2C4258\" opacity=\".85\"/>`, W, H));\n\n  // 3 — nearer ridge\n  layers.push(svgLayer(`<path d=\"${ridge(rand, 340, 120, 0.5, W)}\" fill=\"#22323F\"/>`, W, H));\n\n  // 4 — the hall, lit from within\n  const hx = 120 + rand() * 120;\n  layers.push(svgLayer(`\n    <defs><radialGradient id=\"glow-${gid}\">\n      <stop offset=\"0\" stop-color=\"#E9A94A\" stop-opacity=\".95\"/>\n      <stop offset=\"1\" stop-color=\"#E9A94A\" stop-opacity=\"0\"/>\n    </radialGradient></defs>\n    <circle cx=\"${hx}\" cy=\"392\" r=\"86\" fill=\"url(#glow-${gid})\"/>\n    <path d=\"M${hx - 62} 404 L${hx} 344 L${hx + 62} 404 Z\" fill=\"#16211C\"/>\n    <path d=\"M${hx - 62} 404 L${hx + 62} 404 L${hx + 62} 424 L${hx - 62} 424 Z\" fill=\"#16211C\"/>\n    <path d=\"M${hx - 14} 348 L${hx + 6} 330 M${hx + 14} 348 L${hx - 6} 330\"\n      stroke=\"#16211C\" stroke-width=\"5\" stroke-linecap=\"round\"/>\n    <path d=\"M${hx} 372 C${hx + 8} 384 ${hx + 13} 389 ${hx + 13} 397\n      A13 13 0 0 1 ${hx - 13} 397 C${hx - 13} 388 ${hx - 5} 384 ${hx} 372 Z\" fill=\"#F0B45B\"/>`, W, H));\n\n  // 5–7 — the near bank, closing in\n  layers.push(svgLayer(`<path d=\"${ridge(rand, 430, 70, 0.4, W)}\" fill=\"#16211C\"/>\n    ${trees(rand, 7, 438, 54, W, \"#111A16\")}`, W, H));\n  layers.push(svgLayer(trees(rand, 5, 486, 78, W, \"#0D1512\"), W, H));\n  layers.push(svgLayer(`<path d=\"M0 ${H} L0 500 Q ${W / 2} 470 ${W} 505 L${W} ${H} Z\" fill=\"#0A100D\"/>\n    ${trees(rand, 3, 528, 104, W, \"#080D0B\")}`, W, H));\n\n  return layers.join(\"\");\n}\n\n\n/* ---------- week calendar ---------- */\n\nconst DOW = [\"S\", \"M\", \"T\", \"W\", \"T\", \"F\", \"S\"];\n\nfunction dayNumber(date) {\n  return Number(date.slice(8, 10));\n}\n\nfunction monthLabel(date) {\n  const d = new Date(date + \"T12:00:00\");\n  return d.toLocaleDateString(undefined, { weekday: \"long\", day: \"numeric\", month: \"long\" });\n}\n\nfunction weekCalendar(week, opts) {\n  const today = (S.state && S.state.date) || \"\";\n  const selected = S.day || today;\n  return `<div class=\"calendar\">\n    ${week.map(d => {\n      const isToday = d.date === today;\n      const isSel = d.date === selected;\n      const state = d.total === 0 ? \"rest\" : d.done >= d.total ? \"full\" : d.done > 0 ? \"part\" : \"none\";\n      return `<button class=\"cday ${state} ${isToday ? \"today\" : \"\"} ${isSel ? \"sel\" : \"\"}\"\n        data-act=\"pickDay\" data-date=\"${d.date}\"\n        aria-current=\"${isToday ? \"date\" : \"false\"}\"\n        aria-label=\"${monthLabel(d.date)}, ${d.done} of ${d.total} done\">\n        <span class=\"dw\">${DOW[new Date(d.date + \"T12:00:00\").getDay()]}</span>\n        <span class=\"dn\">${dayNumber(d.date)}</span>\n        <span class=\"dbar\"><i style=\"width:${d.total ? Math.round((d.done / d.total) * 100) : 0}%\"></i></span>\n      </button>`;\n    }).join(\"\")}\n  </div>\n  ${opts && opts.note ? `<div class=\"calnote\">${opts.note}</div>` : \"\"}`;\n}\n\n/* ---------- child ---------- */\n\nfunction statusChip(t) {\n  if (t.status === \"done\") return `<span class=\"chip done\">done · +${t.awardedPoints || 0}</span>`;\n  if (t.status === \"awaiting\") return `<span class=\"chip await\">waiting on parent</span>`;\n  if (t.status === \"running\") return `<span class=\"chip live\">running</span>`;\n  if (t.status === \"paused\") return `<span class=\"chip\">paused</span>`;\n  return `<span class=\"chip\">not started</span>`;\n}\n\nfunction liveDay() {\n  return !S.day || !S.state || S.day === S.state.date;\n}\n\nfunction taskCard(t) {\n  const chore = t.type === \"chore\";\n  const total = chore ? 0 : t.durationMin * 60000;\n  const done = t.status === \"done\" || t.status === \"awaiting\";\n  const pct = done ? 1 : chore ? 0 : Math.min(1, liveElapsed(t) / total);\n  // Study counts down to zero; a chore counts up until the child is finished.\n  const face = done ? \"✓\" : chore ? clock(liveElapsed(t)) : clock(Math.max(0, total - liveElapsed(t)));\n  const started = t.status === \"running\" || t.status === \"paused\";\n\n  return `<div class=\"card ${S.justDone.includes(t.id) ? \"settled\" : \"\"}\">\n    <div class=\"row\">\n      <div class=\"ring js-ring\" data-id=\"${t.id}\" data-mode=\"${chore ? \"up\" : \"down\"}\">\n        ${ringSvg(pct, 22, 5)}\n        <span class=\"label js-mini ${t.running ? \"on\" : \"\"}\">${face}</span>\n      </div>\n      <div style=\"flex:1;min-width:0\">\n        <h3>${esc(t.title)}</h3>\n        <div class=\"meta\">${chore ? \"chore · no set time\" : t.durationMin + \" min · study\"} · ${t.points} pts${t.shared ? \" · shared\" : \"\"}${t.onceOn ? \" · today only\" : \"\"}</div>\n        <div style=\"margin-top:8px\">${statusChip(t)}</div>\n      </div>\n      ${!liveDay() ? \"\" : done ? `<button class=\"pad\" disabled aria-label=\"Finished\">${ICON.check}</button>`\n        : `<button class=\"pad accent\" data-act=\"open\" data-id=\"${t.id}\"\n             aria-label=\"${t.running ? \"Open timer\" : \"Start\"} ${esc(t.title)}\">${t.running ? ICON.pause : ICON.play}</button>`}\n    </div>\n    ${chore && started && liveDay() ? `<div class=\"row\" style=\"justify-content:flex-end;margin-top:12px\">\n      <button class=\"btn small accent\" data-act=\"submit\" data-id=\"${t.id}\">I'm done</button>\n    </div>` : \"\"}\n  </div>`;\n}\n\nfunction childView() {\n  const st = S.state;\n  const tabs = [\"Today\", \"Rewards\"];\n  const body = S.tab === 0 ? childToday() : childRewards();\n\n  return `<div class=\"wrap\">\n    <div class=\"top\">\n      <div class=\"brand\">\n        <span class=\"avatar\" data-color=\"${esc(st.me.color)}\">${esc(initials(st.me.name))}</span>\n        <div>\n          <h1>${esc(st.me.name)}</h1>\n          <div class=\"date\">${esc(st.date)}</div>\n        </div>\n      </div>\n      <div class=\"row\">\n        <span class=\"points ${S.bump ? \"bump\" : \"\"}\" title=\"allowance + saved\">\n          <b>${st.me.points}</b><span>PTS</span>\n        </span>\n        ${themeButton()}\n        <button class=\"btn quiet small\" data-act=\"logout\">Sign out</button>\n      </div>\n    </div>\n    ${tabBar(tabs)}\n    <div class=\"view ${S.entering ? \"enter\" : \"\"}\">${body}</div>\n  </div>`;\n}\n\nfunction streakLine(streak, live) {\n  if (!streak) return \"\";\n  return `<div class=\"streak-line\">\n    <span class=\"chip live\">${streak}</span>\n    <span>${streak} day${streak === 1 ? \"\" : \"s\"} running${live ? \" · finish today to keep it going\" : \"\"}</span>\n  </div>`;\n}\n\nfunction childToday() {\n  const st = S.state;\n  const view = dayView();\n  const tasks = view.tasks;\n  const study = tasks.filter(t => t.type === \"study\");\n  const chores = tasks.filter(t => t.type === \"chore\");\n  const left = tasks.filter(t => t.status !== \"done\").length;\n  const head = weekCalendar(view.week || st.week || [], {\n    note: view.live ? \"\" : monthLabel(view.date),\n  }) + streakLine(st.streak || 0, view.live);\n\n  const events = view.events || st.events || [];\n  const agenda = events.length ? `<h2 class=\"section-title\">What's on</h2><div class=\"cards\" style=\"margin-bottom:4px\">\n    ${events.map(e => `<div class=\"card flat\">\n      <div class=\"spread\">\n        <div style=\"min-width:0\">\n          <h3 style=\"${e.done ? \"text-decoration:line-through;opacity:.6\" : \"\"}\">${esc(e.title)}</h3>\n          <div class=\"meta\">${e.time ? esc(e.time) : \"any time\"}${e.note ? \" · \" + esc(e.note) : \"\"}</div>\n        </div>\n        <button class=\"btn small quiet\" data-act=\"toggleEvent\" data-id=\"${e.id}\">${e.done ? \"Undo\" : \"Done\"}</button>\n      </div>\n    </div>`).join(\"\")}</div>` : \"\";\n\n  if (!tasks.length) return head + agenda + `<p class=\"empty\">${view.live ? \"Nothing assigned for today.\" : \"Nothing scheduled that day.\"}</p>`;\n\n  return head + `\n    <div class=\"card flat\" style=\"margin-bottom:20px\">\n      <div class=\"spread\">\n        <div>\n          <div style=\"font-size:15px;font-weight:500\">${left === 0 ? \"All finished\" : left + (view.live ? \" left today\" : \" to do\")}</div>\n          <div class=\"meta\" style=\"margin-top:4px\">${tasks.length - left} of ${tasks.length} complete</div>\n        </div>\n        <div class=\"ring\" style=\"width:44px;height:44px;flex-basis:44px\">\n          ${ringSvg((tasks.length - left) / tasks.length, 18, 4)}\n        </div>\n      </div>\n    </div>\n    ${agenda}\n    ${study.length ? `<h2 class=\"section-title\">Studying</h2><div class=\"cards\">${study.map(taskCard).join(\"\")}</div>` : \"\"}\n    ${chores.length ? `<h2 class=\"section-title\">Chores</h2><div class=\"cards\">${chores.map(taskCard).join(\"\")}</div>` : \"\"}`;\n}\n\nfunction balanceCard(me) {\n  const pct = me.allowanceWeekly ? me.allowanceRemaining / me.allowanceWeekly : 0;\n  return `<div class=\"card\" style=\"margin-bottom:20px\">\n    <div class=\"spread\" style=\"align-items:flex-start\">\n      <div>\n        <div class=\"meta\">Allowance</div>\n        <div style=\"font-size:26px;font-weight:500;letter-spacing:-.03em;margin:2px 0 4px\">${me.allowanceRemaining}</div>\n        <div class=\"meta\">of ${me.allowanceWeekly} · resets ${esc(me.renewsOn || \"Monday\")}</div>\n      </div>\n      <div class=\"ring\" style=\"width:48px;height:48px;flex-basis:48px\">${ringSvg(pct, 20, 4)}</div>\n      <div style=\"text-align:right\">\n        <div class=\"meta\">Saved</div>\n        <div style=\"font-size:26px;font-weight:500;letter-spacing:-.03em;margin:2px 0 4px\">${me.earned}</div>\n        <div class=\"meta\">yours to keep</div>\n      </div>\n    </div>\n    <div class=\"meta\" style=\"margin-top:14px;padding-top:12px;border-top:0.5px solid var(--track)\">\n      Allowance is spent first, so points you earn stay saved.\n    </div>\n  </div>`;\n}\n\nfunction childRewards() {\n  const st = S.state;\n  return `\n    ${balanceCard(st.me)}\n    ${st.rewards.length ? `<div class=\"reward-grid\">` + st.rewards.map(r => {\n      const afford = st.me.points >= r.cost;\n      return `<div class=\"rcard\" data-scene=\"${esc(r.id)}\">\n        ${rewardScene(r.title + r.id, r.id.replace(/[^a-zA-Z0-9]/g, \"\"), r.sky)}\n        <div class=\"rcard-body\">\n          <div style=\"min-width:0\">\n            <h3>${esc(r.title)}</h3>\n            <div class=\"cost\">${r.cost} POINTS${afford ? \"\" : ` · ${r.cost - st.me.points} TO GO`}</div>\n          </div>\n          <button class=\"rcard-redeem\" data-act=\"redeem\" data-id=\"${r.id}\" ${afford ? \"\" : \"disabled\"}>Redeem</button>\n        </div>\n      </div>`;\n    }).join(\"\") + `</div>` : `<p class=\"empty\">No rewards set up yet.</p>`}\n    ${st.redemptions.length ? `<h2 class=\"section-title\">Your requests</h2>\n      <div class=\"cards\">${st.redemptions.map(r => `<div class=\"card flat\">\n        <div class=\"spread\">\n          <div><h3>${esc(r.rewardTitle)}</h3><div class=\"meta\">${r.cost} pts</div></div>\n          <span class=\"chip ${r.status === \"fulfilled\" ? \"done\" : r.status === \"denied\" ? \"await\" : \"\"}\">${r.status}</span>\n        </div>\n      </div>`).join(\"\")}</div>` : \"\"}`;\n}\n\n/* ---------- focus overlay ---------- */\n\nfunction focusView() {\n  const t = taskById(S.focus);\n  if (!t) return \"\";\n  const chore = t.type === \"chore\";\n  const total = chore ? 0 : t.durationMin * 60000;\n  const done = t.status === \"done\" || t.status === \"awaiting\";\n  const remaining = done ? 0 : chore ? liveElapsed(t) : Math.max(0, total - liveElapsed(t));\n  const pct = done ? 1 : chore ? 0 : Math.min(1, liveElapsed(t) / total);\n  const started = t.status === \"running\" || t.status === \"paused\";\n\n  const note = done\n    ? (chore ? \"Sent to a parent to check off\" : \"Finished · +\" + t.points + \" points\")\n    : chore\n      ? \"take as long as you need, then tap done\"\n      : \"the timer has to finish · pause is fine\";\n\n  return `<div class=\"overlay\">\n    <button class=\"btn quiet\" data-act=\"closeFocus\" style=\"position:absolute;top:20px;left:16px\">${ICON.back} Back</button>\n    <div style=\"text-align:center\">\n      <div class=\"mono\" style=\"font-size:10.5px;letter-spacing:.14em;color:var(--muted)\">${esc(t.type)}</div>\n      <div style=\"font-size:19px;font-weight:500;margin-top:6px\">${esc(t.title)}</div>\n    </div>\n    <div class=\"dial\">\n      ${ringSvg(pct, 125, 7)}\n      <div class=\"face\">\n        <div class=\"readout js-readout\">${clock(remaining)}</div>\n        <div class=\"caption\">${chore ? \"elapsed\" : t.durationMin + \" min\"} · ${t.points} pts</div>\n      </div>\n    </div>\n    <button class=\"key ${t.running ? \"on\" : \"\"}\" data-act=\"${done ? \"\" : t.running ? \"pause\" : \"start\"}\" data-id=\"${t.id}\"\n      ${done ? \"disabled\" : \"\"} aria-label=\"${t.running ? \"Pause\" : \"Start\"}\">\n      ${done ? ICON.check : t.running ? ICON.pause : ICON.play}\n    </button>\n    ${chore && started && !done ? `<button class=\"btn accent\" data-act=\"submit\" data-id=\"${t.id}\">I'm done</button>` : \"\"}\n    <p class=\"caption\" style=\"max-width:260px\">${esc(note)}</p>\n  </div>`;\n}\n\n\n/* ---------- month planner ---------- */\n\nconst MONTHS = [\"January\", \"February\", \"March\", \"April\", \"May\", \"June\",\n  \"July\", \"August\", \"September\", \"October\", \"November\", \"December\"];\n\nfunction monthAnchor() {\n  return S.month || (S.state && S.state.date) || \"\";\n}\n\nfunction datesBetween(from, to) {\n  if (!from || !to || from > to) return [];\n  const out = [];\n  let d = from;\n  for (let i = 0; i < 400 && d <= to; i++) { out.push(d); d = shiftDay(d, 1); }\n  return out;\n}\n\nfunction shiftDay(date, delta) {\n  const d = new Date(date + \"T12:00:00\");\n  d.setDate(d.getDate() + delta);\n  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, \"0\")}-${String(d.getDate()).padStart(2, \"0\")}`;\n}\n\nfunction shiftMonth(anchor, delta) {\n  const d = new Date(anchor + \"T12:00:00\");\n  d.setDate(1);\n  d.setMonth(d.getMonth() + delta);\n  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, \"0\")}-01`;\n}\n\nfunction adminCalendar() {\n  const st = S.state;\n  const data = S.monthData;\n  const anchor = monthAnchor();\n  const label = new Date(anchor + \"T12:00:00\");\n\n  if (!data || data.month !== anchor.slice(0, 7)) {\n    loadMonth(anchor);\n    return `<p class=\"empty\">Loading…</p>`;\n  }\n\n  const startsOn = (st.settings && st.settings.weekStartsOn === 0) ? 0 : 1;\n  const firstDow = new Date(data.days[0].date + \"T12:00:00\").getDay();\n  const lead = (firstDow - startsOn + 7) % 7;\n  const letters = startsOn === 0\n    ? [\"S\", \"M\", \"T\", \"W\", \"T\", \"F\", \"S\"]\n    : [\"M\", \"T\", \"W\", \"T\", \"F\", \"S\", \"S\"];\n\n  const selected = S.day || st.date;\n  const cells = [];\n  for (let i = 0; i < lead; i++) cells.push(`<div class=\"mcell empty\"></div>`);\n  for (const d of data.days) {\n    const isToday = d.date === st.date;\n    const isSel = d.date === selected;\n    const pct = d.total ? Math.round((d.done / d.total) * 100) : 0;\n    const picked = S.sel.includes(d.date);\n    cells.push(`<button class=\"mcell ${isToday ? \"today\" : \"\"} ${isSel && !S.selecting ? \"sel\" : \"\"} ${picked ? \"picked\" : \"\"}\"\n      data-act=\"pickDay\" data-date=\"${d.date}\"\n      aria-label=\"${d.date}, ${d.done} of ${d.total} done, ${d.events.length} events\">\n      <span class=\"mnum\">${Number(d.date.slice(8))}</span>\n      ${d.total ? `<span class=\"mbar\"><i style=\"width:${pct}%\"></i></span>` : `<span class=\"mbar blank\"></span>`}\n      ${d.events.length ? `<span class=\"mdots\">${d.events.slice(0, 3).map(e =>\n        `<i class=\"${e.done ? \"done\" : \"\"}\"></i>`).join(\"\")}</span>` : `<span class=\"mdots\"></span>`}\n    </button>`);\n  }\n\n  const selBar = S.selecting ? `\n    <div class=\"card form selbar\">\n      <div class=\"spread\" style=\"margin-bottom:12px\">\n        <div>\n          <div style=\"font-size:15px;font-weight:500\">${S.sel.length} day${S.sel.length === 1 ? \"\" : \"s\"} selected</div>\n          <div class=\"meta\" style=\"margin-top:3px\">Tap days to add or remove them</div>\n        </div>\n        <div class=\"row\">\n          ${S.sel.length ? `<button class=\"btn small quiet\" data-act=\"clearSel\">Clear</button>` : \"\"}\n          <button class=\"btn small\" data-act=\"selectMode\" data-on=\"0\">Done</button>\n        </div>\n      </div>\n      <div class=\"grid2\">\n        <div><label class=\"lab\" for=\"r-from\">From</label>\n          <input class=\"field\" id=\"r-from\" type=\"date\" value=\"${esc(S.rangeFrom || S.state.date)}\"></div>\n        <div><label class=\"lab\" for=\"r-to\">To</label>\n          <input class=\"field\" id=\"r-to\" type=\"date\" value=\"${esc(S.rangeTo || S.state.date)}\"></div>\n      </div>\n      <div class=\"row\" style=\"gap:8px;margin-top:12px;flex-wrap:wrap\">\n        <button class=\"btn small accent\" data-act=\"addRange\">Add range</button>\n        <button class=\"btn small quiet\" data-act=\"removeRange\">Remove range</button>\n        <button class=\"btn small quiet\" data-act=\"selWeekdays\">Weekdays</button>\n        <button class=\"btn small quiet\" data-act=\"selWeekends\">Weekends</button>\n      </div>\n      ${S.sel.length ? `<div class=\"seldays\">${S.sel.slice(0, 40).map(d =>\n        `<button class=\"selchip\" data-act=\"unpickSel\" data-date=\"${d}\" title=\"Remove ${d}\">${\n          Number(d.slice(8))}/${Number(d.slice(5, 7))} ×</button>`).join(\"\")}${\n        S.sel.length > 40 ? `<span class=\"meta\">+${S.sel.length - 40} more</span>` : \"\"}</div>` : \"\"}\n    </div>` : \"\";\n\n  return `\n    ${selBar}\n    <div class=\"mhead\">\n      <button class=\"btn quiet small\" data-act=\"month\" data-d=\"-1\" aria-label=\"Previous month\">‹</button>\n      <div class=\"mtitle\">${MONTHS[label.getMonth()]} ${label.getFullYear()}</div>\n      <button class=\"btn quiet small\" data-act=\"month\" data-d=\"1\" aria-label=\"Next month\">›</button>\n    </div>\n    ${S.selecting ? \"\" : `<div class=\"row\" style=\"justify-content:flex-end;margin-bottom:12px\">\n      <button class=\"btn small quiet\" data-act=\"selectMode\" data-on=\"1\">Select days</button>\n    </div>`}\n    <div class=\"mgrid-head\">${letters.map(l => `<span>${l}</span>`).join(\"\")}</div>\n    <div class=\"mgrid\">${cells.join(\"\")}</div>\n    ${dayPanel(selected)}`;\n}\n\nfunction loadMonth(anchor) {\n  post(\"month\", { date: anchor })\n    .then(data => { S.monthData = data; render(); })\n    .catch(err => toast(err.message));\n}\n\nfunction dayPanel(date) {\n  const st = S.state;\n  const data = S.monthData;\n  const rec = data && data.days.find(d => d.date === date);\n  const view = dayView();\n  const board = view.board && view.board.length ? view.board : (view.live ? st.board : []);\n  const past = date <= st.date;\n\n  const f = S.form && S.form.kind === \"event\" ? S.form : null;\n\n  return `<div class=\"daypanel\">\n    <div class=\"spread\" style=\"margin-bottom:14px\">\n      <h2 class=\"section-title\" style=\"margin:0\">${esc(monthLabel(date))}</h2>\n      <button class=\"btn small ${f ? \"on\" : \"accent\"}\" data-act=\"${f ? \"cancelForm\" : \"newEvent\"}\" data-date=\"${date}\">\n        ${f ? \"Cancel\" : S.sel.length > 1 ? `Add to ${S.sel.length} days` : \"Add something\"}\n      </button>\n    </div>\n\n    ${f ? eventForm(f) : \"\"}\n\n    ${rec && rec.events.length ? `<div class=\"cards\" style=\"margin-bottom:22px\">\n      ${rec.events.map(e => `<div class=\"card flat\">\n        <div class=\"spread\">\n          <div style=\"min-width:0\">\n            <h3 style=\"${e.done ? \"text-decoration:line-through;opacity:.6\" : \"\"}\">${esc(e.title)}</h3>\n            <div class=\"meta\">${e.time ? esc(e.time) + \" · \" : \"\"}${\n              e.who.length ? esc(e.who.join(\", \")) : \"everyone\"}${e.note ? \" · \" + esc(e.note) : \"\"}${\n              e.groupSize > 1 ? \" · 1 of \" + e.groupSize + \" days\" : \"\"}</div>\n          </div>\n          <div class=\"row\">\n            <button class=\"btn small quiet\" data-act=\"toggleEvent\" data-id=\"${e.id}\">${e.done ? \"Undo\" : \"Done\"}</button>\n            <button class=\"btn small quiet\" data-act=\"editEvent\" data-id=\"${e.id}\">Edit</button>\n            <button class=\"btn small quiet\" data-act=\"deleteEvent\" data-id=\"${e.id}\">Remove</button>\n            ${e.groupSize > 1 ? `<button class=\"btn small quiet\" data-act=\"deleteSeries\" data-id=\"${e.id}\"\n              title=\"Remove this from all ${e.groupSize} days\">Remove all ${e.groupSize}</button>` : \"\"}\n          </div>\n        </div>\n      </div>`).join(\"\")}\n    </div>` : `<p class=\"meta\" style=\"margin-bottom:22px\">Nothing scheduled.</p>`}\n\n    ${board.map(b => `\n      <h2 class=\"section-title\">${esc(b.child.name)}</h2>\n      ${b.tasks.length ? `<div class=\"cards\">${b.tasks.map(t => `<div class=\"card flat\">\n        <div class=\"spread\">\n          <div style=\"min-width:0\">\n            <h3>${esc(t.title)}</h3>\n            <div class=\"meta\">${t.type === \"chore\" ? \"chore\" : t.durationMin + \" min study\"} · ${t.points} pts</div>\n          </div>\n          <div class=\"row\">\n            ${statusChip(t)}\n            ${past && t.status !== \"done\" ? `<button class=\"btn small accent\" data-act=\"credit\"\n              data-task=\"${t.id}\" data-child=\"${b.child.id}\" data-date=\"${date}\">Mark done</button>` : \"\"}\n            ${t.status === \"done\" ? `<button class=\"btn small quiet\" data-act=\"undo\" data-key=\"${t.key}\">Undo</button>` : \"\"}\n          </div>\n        </div>\n      </div>`).join(\"\")}</div>` : `<p class=\"meta\">Nothing scheduled.</p>`}\n    `).join(\"\")}\n  </div>`;\n}\n\nfunction eventForm(f) {\n  const st = S.state;\n  return `<div class=\"card form\" style=\"margin-bottom:20px\">\n    <p class=\"eyebrow\">${f.id ? \"Edit\" : \"New\"}</p>\n    <div class=\"stack\">\n      <div><label class=\"lab\" for=\"e-title\">What</label>\n        <input class=\"field\" id=\"e-title\" value=\"${esc(f.title || \"\")}\" placeholder=\"Dentist, football, grandma visits…\"></div>\n      <div class=\"grid2\">\n        ${f.dates && f.dates.length > 1\n          ? `<div><label class=\"lab\">Days</label>\n               <div class=\"field\" style=\"box-shadow:var(--in-sm)\">${f.dates.length} days selected</div></div>`\n          : `<div><label class=\"lab\" for=\"e-date\">Date</label>\n               <input class=\"field\" id=\"e-date\" type=\"date\" value=\"${esc(f.date || \"\")}\"></div>`}\n        <div><label class=\"lab\" for=\"e-time\">Time (optional)</label>\n          <input class=\"field\" id=\"e-time\" type=\"time\" value=\"${esc(f.time || \"\")}\"></div>\n      </div>\n      ${f.dates && f.dates.length > 1 ? `<div class=\"meta\">${\n        f.dates[0]} → ${f.dates[f.dates.length - 1]}, one entry per day so each can be ticked off separately.</div>` : \"\"}\n      <div><label class=\"lab\" for=\"e-note\">Note (optional)</label>\n        <input class=\"field\" id=\"e-note\" value=\"${esc(f.note || \"\")}\" placeholder=\"Bring kit\"></div>\n      <div><label class=\"lab\">Who</label>\n        <div class=\"row\" style=\"gap:8px;flex-wrap:wrap\">\n          <button type=\"button\" class=\"btn small ${(f.childIds || []).length === 0 ? \"accent on\" : \"\"}\"\n            data-act=\"eventWho\" data-id=\"all\">Everyone</button>\n          ${st.children.map(c => `<button type=\"button\" class=\"btn small ${(f.childIds || []).includes(c.id) ? \"accent on\" : \"\"}\"\n            data-act=\"eventWho\" data-id=\"${c.id}\">${esc(c.name)}</button>`).join(\"\")}\n        </div></div>\n      <div class=\"row\" style=\"justify-content:flex-end\">\n        <button class=\"btn accent\" data-act=\"saveEvent\">${f.id ? \"Save\" : \"Add\"}</button>\n      </div>\n    </div>\n  </div>`;\n}\n\n/* ---------- admin ---------- */\n\nfunction themeButton() {\n  const mode = currentTheme();\n  const icon = mode === \"light\" ? ICON.sun : mode === \"dark\" ? ICON.moon : ICON.system;\n  return `<button class=\"theme\" data-act=\"theme\" title=\"Theme: ${mode}\"\n    aria-label=\"Theme: ${mode}. Tap to change.\">${icon}</button>`;\n}\n\nfunction tabBar(labels) {\n  return `<div class=\"tabs\" style=\"grid-template-columns:repeat(${labels.length},1fr)\">\n    <span class=\"thumb\" style=\"width:calc((100% - 10px)/${labels.length});transform:translateX(calc(${S.tab} * 100%))\"></span>\n    ${labels.map((l, i) => `<button data-act=\"tab\" data-i=\"${i}\" aria-selected=\"${i === S.tab}\">${l}</button>`).join(\"\")}\n  </div>`;\n}\n\nfunction adminView() {\n  const st = S.state;\n  const pending = st.approvals.length + st.redemptions.length;\n  const tabs = [\"Today\", \"Queue\" + (pending ? \" \" + pending : \"\"), \"Plan\", \"Tasks\", \"Rewards\", \"Family\"];\n  const body = [adminToday, adminApprovals, adminCalendar, adminTasks, adminRewards, adminFamily][S.tab]();\n\n  return `<div class=\"wrap\">\n    <div class=\"top\">\n      <div class=\"brand\">\n        <span class=\"avatar\" data-color=\"${esc(st.me.color)}\">${esc(initials(st.me.name))}</span>\n        <div><h1>${esc(st.me.name)}</h1><div class=\"date\">${esc(st.date)}</div></div>\n      </div>\n      <div class=\"row\">\n        ${themeButton()}\n        <button class=\"btn quiet small\" data-act=\"logout\">Sign out</button>\n      </div>\n    </div>\n    ${tabBar(tabs)}\n    <div class=\"view ${S.entering ? \"enter\" : \"\"}\">${body}</div>\n  </div>`;\n}\n\nfunction adminToday() {\n  const st = S.state;\n  if (!st.board.length) return `<p class=\"empty\">Add a child in the Family tab to get started.</p>`;\n\n  const view = dayView();\n  const board = view.board && view.board.length ? view.board : st.board;\n  const head = weekCalendar((board[0] && board[0].week) || [], {\n    note: view.live ? \"\" : monthLabel(view.date) + (view.loading ? \" · loading\" : \"\"),\n  });\n\n  return head + `<div class=\"board\">` + board.map(b => {\n    const done = b.tasks.filter(t => t.status === \"done\").length;\n    return `<div>\n      <div class=\"spread\" style=\"margin-bottom:12px\">\n        <div class=\"row\">\n          <span class=\"avatar sm\" data-color=\"${esc(b.child.color)}\">${esc(initials(b.child.name))}</span>\n          <div>\n            <div style=\"font-size:15px;font-weight:500\">${esc(b.child.name)}</div>\n            <div class=\"meta mono\" style=\"font-size:10.5px;color:var(--muted)\">${done}/${b.tasks.length} done today${\n              b.streak > 0 ? \" · \" + b.streak + \" day streak\" : \"\"}</div>\n          </div>\n        </div>\n        <div style=\"text-align:right\">\n          <span class=\"points\"><b>${b.child.points}</b><span>PTS</span></span>\n          <div class=\"meta mono\" style=\"font-size:10px;color:var(--muted);margin-top:5px\">${b.child.allowanceRemaining} allowance · ${b.child.earned} saved</div>\n        </div>\n      </div>\n      ${b.tasks.length ? `<div class=\"cards\">` + b.tasks.map(t => `<div class=\"card flat\">\n        <div class=\"spread\">\n          <div style=\"min-width:0\">\n            <h3>${esc(t.title)}</h3>\n            <div class=\"meta\">${t.type === \"chore\" ? \"chore\" : t.durationMin + \" min study\"} · ${Math.floor(liveElapsed(t) / 60000)} min logged</div>\n          </div>\n          <div class=\"row\">\n            ${statusChip(t)}\n            ${t.status === \"awaiting\" ? `<button class=\"btn small accent\" data-act=\"approve\" data-key=\"${t.key}\">Check off</button>` : \"\"}\n            ${liveDay() && t.status !== \"done\" && t.status !== \"awaiting\" ? `<button class=\"btn small quiet\" data-act=\"excuse\" data-key=\"${t.key}\">Excuse</button>` : \"\"}\n            ${t.status === \"done\" ? `<button class=\"btn small quiet\" data-act=\"undo\" data-key=\"${t.key}\">Undo</button>` : \"\"}\n          </div>\n        </div>\n      </div>`).join(\"\") + `</div>` : `<p class=\"empty\">No tasks scheduled today.</p>`}\n    </div>`;\n  }).join(\"\") + `</div>`;\n}\n\nfunction adminApprovals() {\n  const st = S.state;\n  if (!st.approvals.length && !st.redemptions.length) return `<p class=\"empty\">Nothing waiting on you.</p>`;\n\n  return `\n    ${st.approvals.length ? `<h2 class=\"section-title\">Chores to check off</h2>\n      <div class=\"cards\">${st.approvals.map(t => `<div class=\"card\">\n        <div class=\"spread\">\n          <div>\n            <h3>${esc(t.title)}</h3>\n            <div class=\"meta\">${esc(t.childName)} · ${Math.floor(liveElapsed(t) / 60000)} min logged · ${t.points} pts</div>\n          </div>\n          <div class=\"row\">\n            <button class=\"btn small quiet\" data-act=\"reject\" data-key=\"${t.key}\">Send back</button>\n            <button class=\"btn small accent\" data-act=\"approve\" data-key=\"${t.key}\">Check off</button>\n          </div>\n        </div>\n      </div>`).join(\"\")}</div>` : \"\"}\n    ${st.redemptions.length ? `<h2 class=\"section-title\">Reward requests</h2>\n      <div class=\"cards\">${st.redemptions.map(r => `<div class=\"card\">\n        <div class=\"spread\">\n          <div>\n            <h3>${esc(r.rewardTitle)}</h3>\n            <div class=\"meta\">${esc(r.childName)} · ${r.cost} pts already deducted</div>\n          </div>\n          <div class=\"row\">\n            <button class=\"btn small quiet\" data-act=\"denyRedemption\" data-id=\"${r.id}\">Refund</button>\n            <button class=\"btn small accent\" data-act=\"fulfill\" data-id=\"${r.id}\">Given</button>\n          </div>\n        </div>\n      </div>`).join(\"\")}</div>` : \"\"}`;\n}\n\nfunction dayChips(days) {\n  return `<div class=\"row\" style=\"gap:7px;flex-wrap:wrap\">\n    ${DAYS.map((d, i) => `<button type=\"button\" class=\"btn small ${days.includes(i) ? \"accent on\" : \"\"}\"\n      data-act=\"toggleDay\" data-i=\"${i}\" style=\"width:38px;padding:8px 0;text-align:center\">${d}</button>`).join(\"\")}\n  </div>`;\n}\n\nfunction adminTasks() {\n  const st = S.state;\n  const kind = S.taskKind === \"chore\" ? \"chore\" : \"study\";\n  const f = formState(\"task\", { id: \"\", childId: (st.children[0] || {}).id || \"\", title: \"\", type: kind, durationMin: 20, points: 10, days: [0, 1, 2, 3, 4, 5, 6] });\n  // Editing a task pins the form to that task's type.\n  if (!f.id) f.type = kind;\n\n  return `\n    <div class=\"tabs\" style=\"grid-template-columns:repeat(2,1fr);margin-bottom:20px\">\n      <span class=\"thumb\" style=\"width:calc((100% - 10px)/2);transform:translateX(calc(${kind === \"chore\" ? 1 : 0} * 100%))\"></span>\n      <button data-act=\"taskKind\" data-k=\"study\" aria-selected=\"${kind === \"study\"}\">Study</button>\n      <button data-act=\"taskKind\" data-k=\"chore\" aria-selected=\"${kind === \"chore\"}\">Chores</button>\n    </div>\n    <div class=\"card form\" style=\"margin-bottom:24px\">\n      <p class=\"eyebrow\">${f.id ? \"Edit\" : \"New\"} ${kind === \"chore\" ? \"chore\" : \"study block\"}</p>\n      <div class=\"stack\">\n        <div><label class=\"lab\" for=\"f-title\">Name</label>\n          <input class=\"field\" id=\"f-title\" value=\"${esc(f.title)}\" placeholder=\"Reading, dishwasher, piano…\"></div>\n        <div class=\"grid2\">\n          <div><label class=\"lab\" for=\"f-child\">Child</label>\n            <select class=\"field\" id=\"f-child\">\n              <option value=\"all\" ${f.childId === \"all\" ? \"selected\" : \"\"}>All children</option>\n              ${st.children.map(c => `<option value=\"${c.id}\" ${c.id === f.childId ? \"selected\" : \"\"}>${esc(c.name)}</option>`).join(\"\")}\n            </select></div>\n          ${f.type === \"chore\" ? \"\" : `<div><label class=\"lab\" for=\"f-dur\">Minutes</label>\n            <input class=\"field\" id=\"f-dur\" type=\"number\" min=\"1\" max=\"240\" value=\"${f.durationMin || 20}\"></div>`}\n          <div><label class=\"lab\" for=\"f-pts\">Points</label>\n            <input class=\"field\" id=\"f-pts\" type=\"number\" min=\"0\" max=\"500\" value=\"${f.points}\"></div>\n        </div>\n        ${f.type === \"chore\" ? `<div class=\"meta\">No set length. The child runs a timer while they work and taps done when they're finished; you check it off from the queue.</div>` : \"\"}\n        <div class=\"spread\" style=\"gap:8px\">\n          <label class=\"lab\" style=\"margin:0\">Repeats</label>\n          <div class=\"row\" style=\"gap:6px\">\n            <button type=\"button\" class=\"btn small ${f.onceOn ? \"\" : \"accent on\"}\" data-act=\"repeatMode\" data-m=\"weekly\">Weekly</button>\n            <button type=\"button\" class=\"btn small ${f.onceOn ? \"accent on\" : \"\"}\" data-act=\"repeatMode\" data-m=\"once\">One-off</button>\n          </div>\n        </div>\n        ${f.onceOn ? `<div>\n          <label class=\"lab\" for=\"f-once\">Date</label>\n          <input class=\"field\" id=\"f-once\" type=\"date\" value=\"${esc(f.onceOn)}\">\n          <div class=\"meta\" style=\"margin-top:6px\">Appears on this day only, then retires itself.</div>\n        </div>` : `<div>\n          <div class=\"spread\" style=\"margin-bottom:6px\">\n            <label class=\"lab\" style=\"margin:0\">Days</label>\n            <div class=\"row\" style=\"gap:6px\">\n              <button type=\"button\" class=\"btn quiet small\" data-act=\"allDays\">All</button>\n              <button type=\"button\" class=\"btn quiet small\" data-act=\"noDays\">None</button>\n            </div>\n          </div>\n          ${dayChips(f.days)}\n          ${f.days.length ? \"\" : `<div class=\"meta\" style=\"margin-top:8px;color:var(--warn)\">No days selected — pick at least one before saving.</div>`}\n        </div>`}\n        <div class=\"row\" style=\"justify-content:flex-end;margin-top:4px\">\n          ${f.id ? `<button class=\"btn quiet small\" data-act=\"cancelForm\">Cancel</button>` : \"\"}\n          <button class=\"btn accent\" data-act=\"saveTask\">${f.id ? \"Save changes\" : \"Add task\"}</button>\n        </div>\n      </div>\n    </div>\n    ${[{ id: \"all\", name: \"Everyone\" }].concat(st.children).map(c => {\n      const list = st.allTasks.filter(t => t.childId === c.id && t.type === kind);\n      if (!list.length) return \"\";\n      return `<h2 class=\"section-title\">${esc(c.name)}</h2>\n        <div class=\"cards\">${list.map(t => `<div class=\"card flat\">\n          <div class=\"spread\">\n            <div>\n              <h3>${esc(t.title)}</h3>\n              <div class=\"meta\">${t.type === \"chore\" ? \"no set time\" : t.durationMin + \" min\"} · ${t.points} pts · ${\n                t.onceOn ? \"once on \" + t.onceOn : t.days.length === 7 ? \"daily\" : t.days.map(d => DAYS[d]).join(\"\")}</div>\n            </div>\n            <div class=\"row\">\n              <button class=\"btn small quiet\" data-act=\"editTask\" data-id=\"${t.id}\">Edit</button>\n              <button class=\"btn small quiet\" data-act=\"deleteTask\" data-id=\"${t.id}\">Remove</button>\n            </div>\n          </div>\n        </div>`).join(\"\")}</div>`;\n    }).join(\"\")}`;\n}\n\nfunction adminRewards() {\n  const st = S.state;\n  const f = formState(\"reward\", { id: \"\", title: \"\", cost: 25, childIds: [], sky: \"\" });\n  const previewTitle = f.title || \"Reward name\";\n\n  return `\n    <div class=\"card form\" style=\"margin-bottom:24px\">\n      <p class=\"eyebrow\">${f.id ? \"Edit reward\" : \"New reward\"}</p>\n      <div class=\"stack\">\n        <div><label class=\"lab\" for=\"r-title\">Reward</label>\n          <input class=\"field\" id=\"r-title\" value=\"${esc(f.title)}\" placeholder=\"Movie night, later bedtime…\"></div>\n        <div><label class=\"lab\" for=\"r-cost\">Cost in points</label>\n          <input class=\"field\" id=\"r-cost\" type=\"number\" min=\"1\" max=\"10000\" value=\"${f.cost}\"></div>\n        <div>\n          <label class=\"lab\">Card sky</label>\n          <div class=\"sky-picker\">\n            <button type=\"button\" class=\"swatch auto ${f.sky ? \"\" : \"on\"}\" data-act=\"pickSky\" data-sky=\"\"\n              title=\"Chosen from the reward's name\">Auto</button>\n            ${SKIES.map(k => `<button type=\"button\" class=\"swatch ${f.sky === k.id ? \"on\" : \"\"}\"\n              data-act=\"pickSky\" data-sky=\"${k.id}\" title=\"${k.name}\"\n              style=\"background:linear-gradient(160deg, ${k.from}, ${k.to})\"></button>`).join(\"\")}\n          </div>\n          <div class=\"rcard preview\" style=\"margin-top:14px\">\n            ${rewardScene(previewTitle + (f.id || \"preview\"), \"prev\", f.sky)}\n            <div class=\"rcard-body\">\n              <div style=\"min-width:0\">\n                <h3>${esc(previewTitle)}</h3>\n                <div class=\"cost\">${f.cost || 0} POINTS</div>\n              </div>\n            </div>\n          </div>\n        </div>\n        <div><label class=\"lab\">Who can redeem it</label>\n          <div class=\"row\" style=\"gap:8px;flex-wrap:wrap\">\n            <button type=\"button\" class=\"btn small ${f.childIds.length === 0 ? \"accent on\" : \"\"}\" data-act=\"toggleChild\" data-id=\"all\">Everyone</button>\n            ${st.children.map(c => `<button type=\"button\" class=\"btn small ${f.childIds.includes(c.id) ? \"accent on\" : \"\"}\"\n              data-act=\"toggleChild\" data-id=\"${c.id}\">${esc(c.name)}</button>`).join(\"\")}\n          </div></div>\n        <div class=\"row\" style=\"justify-content:flex-end;margin-top:4px\">\n          ${f.id ? `<button class=\"btn quiet small\" data-act=\"cancelForm\">Cancel</button>` : \"\"}\n          <button class=\"btn accent\" data-act=\"saveReward\">${f.id ? \"Save changes\" : \"Add reward\"}</button>\n        </div>\n      </div>\n    </div>\n    <div class=\"cards\">${st.rewards.map(r => `<div class=\"card flat\">\n      <div class=\"spread\">\n        <div>\n          <h3>${esc(r.title)}</h3>\n          <div class=\"meta\">${r.cost} pts · ${r.childIds.length ? r.childIds.map(cid => (st.children.find(c => c.id === cid) || {}).name).join(\", \") : \"everyone\"} · ${esc(skyFor(r.title + r.id, r.sky).name.toLowerCase())}${r.sky ? \"\" : \" (auto)\"}</div>\n        </div>\n        <div class=\"row\">\n          <button class=\"btn small quiet\" data-act=\"editReward\" data-id=\"${r.id}\">Edit</button>\n          <button class=\"btn small quiet\" data-act=\"deleteReward\" data-id=\"${r.id}\">Remove</button>\n        </div>\n      </div>\n    </div>`).join(\"\")}</div>`;\n}\n\nfunction adminFamily() {\n  const st = S.state;\n  const f = formState(\"user\", { id: \"\", name: \"\", role: \"child\", color: \"ochre\", pin: \"\" });\n\n  const person = u => `<div class=\"card flat\">\n    <div class=\"spread\">\n      <div class=\"row\">\n        <span class=\"avatar sm\" data-color=\"${esc(u.color)}\">${esc(initials(u.name))}</span>\n        <div>\n          <h3>${esc(u.name)}</h3>\n          <div class=\"meta\">${u.role === \"admin\" ? \"parent\"\n            : u.allowanceRemaining + \"/\" + u.allowanceWeekly + \" allowance · \" + u.earned + \" saved\"}</div>\n        </div>\n      </div>\n      <div class=\"row\">\n        ${u.role === \"child\" ? `<button class=\"btn small quiet\" data-act=\"adjust\" data-id=\"${u.id}\" data-delta=\"-5\">−5</button>\n        <button class=\"btn small quiet\" data-act=\"adjust\" data-id=\"${u.id}\" data-delta=\"5\">+5</button>` : \"\"}\n        <button class=\"btn small quiet\" data-act=\"editUser\" data-id=\"${u.id}\">Edit</button>\n        ${u.id === st.me.id ? \"\" : `<button class=\"btn small quiet\" data-act=\"deleteUser\" data-id=\"${u.id}\">Remove</button>`}\n      </div>\n    </div>\n  </div>`;\n\n  return `\n    <div class=\"card form\" style=\"margin-bottom:24px\">\n      <p class=\"eyebrow\">${f.id ? \"Edit person\" : \"Add someone\"}</p>\n      <div class=\"stack\">\n        <div><label class=\"lab\" for=\"u-name\">Name</label>\n          <input class=\"field\" id=\"u-name\" value=\"${esc(f.name)}\"></div>\n        <div class=\"grid2\">\n          <div><label class=\"lab\" for=\"u-role\">Role</label>\n            <select class=\"field\" id=\"u-role\" data-act=\"roleChanged\" ${f.id ? \"disabled\" : \"\"}>\n              <option value=\"child\" ${f.role === \"child\" ? \"selected\" : \"\"}>Child</option>\n              <option value=\"admin\" ${f.role === \"admin\" ? \"selected\" : \"\"}>Parent / guardian</option>\n            </select></div>\n          <div><label class=\"lab\" for=\"u-pin\">PIN ${f.id ? \"(blank keeps current)\" : \"\"}</label>\n            <input class=\"field\" id=\"u-pin\" type=\"password\" inputmode=\"numeric\" autocomplete=\"new-password\" placeholder=\"4+ digits\"></div>\n        </div>\n        ${f.role === \"child\" ? `<div><label class=\"lab\" for=\"u-allow\">Weekly allowance</label>\n          <input class=\"field\" id=\"u-allow\" type=\"number\" min=\"0\" max=\"100000\" value=\"${f.allowanceWeekly === undefined ? 500 : f.allowanceWeekly}\">\n          <div class=\"meta\" style=\"margin-top:6px\">Renews every ${esc((st.children[0] || {}).renewsOn || \"Monday\")}. Unspent allowance doesn't carry over. Lowering it applies now; raising it applies at the next renewal.</div></div>` : \"\"}\n        <div><label class=\"lab\">Colour</label>\n          <div class=\"row\" style=\"gap:8px;flex-wrap:wrap\">\n            ${COLORS.map(c => `<button type=\"button\" class=\"btn small ${f.color === c ? \"on\" : \"\"}\" data-act=\"pickColor\" data-c=\"${c}\">\n              <span class=\"avatar sm\" data-color=\"${c}\" style=\"width:18px;height:18px;box-shadow:none\">●</span></button>`).join(\"\")}\n          </div></div>\n        <div class=\"row\" style=\"justify-content:flex-end;margin-top:4px\">\n          ${f.id ? `<button class=\"btn quiet small\" data-act=\"cancelForm\">Cancel</button>` : \"\"}\n          <button class=\"btn accent\" data-act=\"saveUser\">${f.id ? \"Save changes\" : \"Add person\"}</button>\n        </div>\n      </div>\n    </div>\n    <div class=\"card flat form\" style=\"margin-bottom:24px\">\n      <div class=\"spread\">\n        <div>\n          <h3>Week starts on</h3>\n          <div class=\"meta\">When every child's allowance renews</div>\n        </div>\n        <div class=\"row\">\n          <button class=\"btn small ${st.settings.weekStartsOn === 0 ? \"accent on\" : \"\"}\" data-act=\"weekStart\" data-d=\"0\">Sunday</button>\n          <button class=\"btn small ${st.settings.weekStartsOn === 1 ? \"accent on\" : \"\"}\" data-act=\"weekStart\" data-d=\"1\">Monday</button>\n        </div>\n      </div>\n    </div>\n    <h2 class=\"section-title\">Children</h2>\n    ${st.children.length ? `<div class=\"cards\">${st.children.map(person).join(\"\")}</div>` : `<p class=\"empty\">No children yet.</p>`}\n    <h2 class=\"section-title\">Parents and guardians</h2>\n    <div class=\"cards\">${st.admins.map(person).join(\"\")}</div>\n    <p class=\"meta mono\" style=\"text-align:center;margin-top:28px;font-size:10px;color:var(--muted)\">\n      build ${esc(String(st.version || \"dev\").slice(0, 12))}\n    </p>`;\n}\n\n/* ---------- render ---------- */\n\nfunction isTyping() {\n  const a = document.activeElement;\n  return a && (a.tagName === \"INPUT\" || a.tagName === \"SELECT\");\n}\n\n// A re-render rebuilds the DOM, so pull anything half-typed back into state first.\nfunction captureForm() {\n  if (!S.form) return;\n  if (S.form.kind === \"event\") readEventForm(S.form);\n  else if (S.form.kind === \"task\") readTaskForm(S.form);\n  else if (S.form.kind === \"reward\") readRewardForm(S.form);\n  else if (S.form.kind === \"user\") readUserForm(S.form);\n}\n\nfunction viewKey() {\n  return [S.view, S.tab, S.day || \"\", S.focus || \"\", S.month || \"\"].join(\"|\");\n}\n\nfunction render() {\n  captureForm();\n  // Entrance animations run when you move somewhere new. A background refresh\n  // rebuilds the same DOM, and replaying them every six seconds would twitch.\n  S.entering = viewKey() !== S.lastKey;\n  S.lastKey = viewKey();\n  let html;\n  if (S.view === \"loading\") html = `<p class=\"empty\" style=\"padding-top:60px\">Loading…</p>`;\n  else if (S.view === \"login\") html = loginView();\n  else if (S.view === \"child\") html = S.focus ? focusView() : childView();\n  else html = adminView();\n\n  root.innerHTML = html + (S.toast ? `<div class=\"toast\">${esc(S.toast)}</div>` : \"\");\n  // One-shot flags: clear them so the next render is calm.\n  S.bump = false;\n  if (S.justDone.length) setTimeout(() => { S.justDone = []; }, 900);\n}\n\n/* ---------- ticking ---------- */\n\nfunction tick() {\n  if (!S.state) return;\n  const pool = S.state.tasks || (S.state.board || []).flatMap(b => b.tasks);\n  let needsSync = false;\n\n  for (const t of pool) {\n    if (!t.running) continue;\n    const chore = t.type === \"chore\";\n    const total = chore ? 0 : t.durationMin * 60000;\n    // A chore has no end, so it never needs a sync to settle.\n    const left = chore ? liveElapsed(t) : total - liveElapsed(t);\n    if (!chore && left <= 0) needsSync = true;\n\n    const mini = document.querySelector(`.js-ring[data-id=\"${t.id}\"] .js-mini`);\n    if (mini) mini.textContent = clock(Math.max(0, left));\n    if (!chore) {\n      const arcs = document.querySelectorAll(`.js-ring[data-id=\"${t.id}\"] .js-arc`);\n      arcs.forEach(a => {\n        const c = parseFloat(a.getAttribute(\"stroke-dasharray\"));\n        a.setAttribute(\"stroke-dashoffset\", (c * (1 - Math.min(1, liveElapsed(t) / total))).toFixed(1));\n      });\n    }\n\n    if (S.focus === t.id) {\n      const out = el(\".js-readout\");\n      if (out) out.textContent = clock(Math.max(0, left));\n      const arc = chore ? null : document.querySelector(\".dial .js-arc\");\n      if (arc) {\n        const c = parseFloat(arc.getAttribute(\"stroke-dasharray\"));\n        arc.setAttribute(\"stroke-dashoffset\", (c * (1 - Math.min(1, liveElapsed(t) / total))).toFixed(1));\n      }\n    }\n  }\n  if (needsSync) refresh();\n}\n\nasync function refresh(silent) {\n  try {\n    captureForm();\n    setState(await get(\"state\"));\n    if (S.day && S.day !== S.state.date) {\n      try { S.dayData = await post(\"day\", { date: S.day }); } catch (err) { /* keep what we have */ }\n    }\n    if (silent && isTyping()) return;\n    render();\n  } catch (e) {\n    if (String(e.message).includes(\"Sign in\")) { S.view = \"login\"; S.state = null; render(); }\n  }\n}\n\nsetInterval(tick, 250);\nsetInterval(() => { if (S.state) refresh(true); }, 6000);\n\n\n\n/* ---------- completion signal ---------- */\n\n// The audio context is created on a tap (starting a timer), so browsers allow\n// it to make noise later when the timer actually finishes.\nlet audio = null;\nconst chimed = new Set();\n\nfunction wakeAudio() {\n  if (audio || typeof window.AudioContext !== \"function\" && typeof window.webkitAudioContext !== \"function\") return;\n  try {\n    audio = new (window.AudioContext || window.webkitAudioContext)();\n  } catch (err) {\n    audio = null;\n  }\n}\n\nfunction chime() {\n  if (audio && audio.state === \"suspended\") audio.resume();\n  if (audio) {\n    // Two soft notes a fifth apart, short enough not to startle anyone.\n    [[660, 0], [990, 0.16]].forEach(([freq, delay]) => {\n      const osc = audio.createOscillator();\n      const gain = audio.createGain();\n      osc.type = \"sine\";\n      osc.frequency.value = freq;\n      const t = audio.currentTime + delay;\n      gain.gain.setValueAtTime(0.0001, t);\n      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);\n      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);\n      osc.connect(gain).connect(audio.destination);\n      osc.start(t);\n      osc.stop(t + 0.6);\n    });\n  }\n  if (navigator.vibrate) navigator.vibrate([90, 60, 90]);\n}\n\nfunction notifyFinished(tasks) {\n  for (const t of tasks) {\n    const key = t.key || t.id;\n    if (t.status === \"done\" || t.status === \"awaiting\") {\n      if (chimed.has(key) === false && chimed.has(\"seen:\" + key)) { chime(); S.justDone.push(t.id); }\n      chimed.add(\"seen:\" + key);\n      chimed.add(key);\n    } else {\n      chimed.add(\"seen:\" + key);\n      chimed.delete(key);\n    }\n  }\n}\n\n/* ---------- parallax ---------- */\n\n// Pointer drives the tilt; untouched cards drift on their own so the grid\n// isn't dead on a phone, where there's no pointer at all.\nconst parallax = { hovered: null, phase: Math.random() * Math.PI * 2 };\n\nfunction tiltCard(card, x, y) {\n  const layers = card.querySelectorAll(\".player\");\n  const tiltY = (x - 0.5) * 22;\n  layers.forEach((layer, i) => {\n    const moveX = (x - 0.5) * i * 13;\n    const moveY = (y - 0.5) * i * 6;\n    layer.style.transform =\n      `translate(${moveX.toFixed(2)}px, ${moveY.toFixed(2)}px) rotateY(${tiltY.toFixed(2)}deg)`;\n  });\n}\n\nfunction driftFrame() {\n  if (!reducedMotion()) {\n    parallax.phase += 0.006;\n    const cards = document.querySelectorAll(\".rcard\");\n    cards.forEach((card, i) => {\n      if (card === parallax.hovered) return;\n      const x = Math.sin(parallax.phase + i * 0.7) * 0.5 + 0.5;\n      tiltCard(card, x, 0.5);\n    });\n  }\n  requestAnimationFrame(driftFrame);\n}\n\nfunction reducedMotion() {\n  return typeof window.matchMedia === \"function\" &&\n    window.matchMedia(\"(prefers-reduced-motion: reduce)\").matches;\n}\n\nif (typeof requestAnimationFrame === \"function\") requestAnimationFrame(driftFrame);\n\nroot.addEventListener(\"pointermove\", e => {\n  const card = e.target.closest(\".rcard\");\n  if (!card) return;\n  const rect = card.getBoundingClientRect();\n  parallax.hovered = card;\n  card.classList.add(\"live\");\n  tiltCard(card, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);\n});\n\nroot.addEventListener(\"pointerleave\", e => {\n  const card = e.target.closest && e.target.closest(\".rcard\");\n  if (card) card.classList.remove(\"live\");\n  if (parallax.hovered === card) parallax.hovered = null;\n}, true);\n\n/* ---------- events ---------- */\n\nasync function reloadMonth() {\n  const anchor = monthAnchor();\n  try {\n    S.monthData = await post(\"month\", { date: anchor });\n    if (S.day && S.day !== S.state.date) S.dayData = await post(\"day\", { date: S.day });\n  } catch (err) { /* leave what we have */ }\n  render();\n}\n\nfunction readEventForm(f) {\n  if (el(\"#e-title\")) {\n    f.title = val(\"e-title\");\n    if (el(\"#e-date\")) { f.date = val(\"e-date\"); f.dates = [f.date]; }\n    f.time = val(\"e-time\");\n    f.note = val(\"e-note\");\n  }\n  if (!Array.isArray(f.childIds)) f.childIds = [];\n}\n\nfunction formState(kind, seed) {\n  if (!S.form || S.form.kind !== kind) S.form = Object.assign({ kind }, seed);\n  return S.form;\n}\n\nroot.addEventListener(\"click\", async e => {\n  const node = e.target.closest(\"[data-act]\");\n  if (!node) return;\n  const act = node.dataset.act;\n  if (!act) return;\n\n  try {\n    switch (act) {\n      case \"pick\":\n        S.pick = S.profiles.find(p => p.id === node.dataset.id);\n        S.pin = \"\"; S.err = \"\"; return render();\n      case \"unpick\": S.pick = null; S.pin = \"\"; S.err = \"\"; return render();\n      case \"digit\":\n        if (S.pin.length < 12) S.pin += node.dataset.d;\n        render();\n        if (S.pin.length === 4) submitPin();\n        return;\n      case \"del\": S.pin = S.pin.slice(0, -1); S.err = \"\"; return render();\n\n      case \"theme\": cycleTheme(); return render();\n      case \"pickDay\": {\n        const date = node.dataset.date;\n        if (S.selecting) {\n          S.sel = S.sel.includes(date)\n            ? S.sel.filter(d => d !== date)\n            : [...S.sel, date].sort();\n          return render();\n        }\n        S.day = date;\n        if (date === S.state.date) { S.dayData = null; return render(); }\n        render();\n        S.dayData = await post(\"day\", { date });\n        return render();\n      }\n      case \"selectMode\":\n        S.selecting = node.dataset.on === \"1\";\n        if (!S.selecting) S.sel = [];\n        S.form = null;\n        return render();\n      case \"clearSel\": S.sel = []; return render();\n      case \"unpickSel\":\n        S.sel = S.sel.filter(d => d !== node.dataset.date);\n        return render();\n      case \"addRange\":\n      case \"removeRange\": {\n        const from = val(\"r-from\"), to = val(\"r-to\");\n        if (!from || !to) return toast(\"Pick both dates.\");\n        const span = datesBetween(from, to);\n        if (!span.length) return toast(\"That range is the wrong way round.\");\n        if (span.length > 366) return toast(\"That's more than a year.\");\n        S.rangeFrom = from; S.rangeTo = to;\n        S.sel = act === \"addRange\"\n          ? [...new Set(S.sel.concat(span))].sort()\n          : S.sel.filter(d => !span.includes(d));\n        return render();\n      }\n      case \"selWeekdays\":\n      case \"selWeekends\": {\n        const wantWeekend = act === \"selWeekends\";\n        const from = val(\"r-from\") || S.state.date, to = val(\"r-to\") || S.state.date;\n        const span = datesBetween(from, to).filter(d => {\n          const dow = new Date(d + \"T12:00:00\").getDay();\n          return wantWeekend ? (dow === 0 || dow === 6) : (dow > 0 && dow < 6);\n        });\n        if (!span.length) return toast(\"Nothing in that range.\");\n        S.rangeFrom = from; S.rangeTo = to;\n        S.sel = [...new Set(S.sel.concat(span))].sort();\n        return render();\n      }\n      case \"month\": {\n        S.month = shiftMonth(monthAnchor(), +node.dataset.d);\n        S.monthData = null;\n        return render();\n      }\n      case \"newEvent\":\n        S.form = {\n          kind: \"event\", id: \"\", title: \"\", time: \"\", note: \"\", childIds: [],\n          date: node.dataset.date,\n          dates: S.sel.length ? S.sel.slice() : [node.dataset.date],\n        };\n        return render();\n      case \"editEvent\": {\n        const ev = (S.monthData.days.flatMap(d => d.events)).find(e => e.id === node.dataset.id);\n        S.form = Object.assign({ kind: \"event\" }, ev);\n        return render();\n      }\n      case \"saveEvent\": {\n        const f = S.form && S.form.kind === \"event\" ? S.form : { kind: \"event\", childIds: [] };\n        readEventForm(f);\n        if (!f.title) return toast(\"Give it a name.\");\n        const result = await post(\"saveEvent\", f);\n        const n = result.count || 1;\n        S.form = null;\n        if (!f.id) { S.sel = []; S.selecting = false; }\n        await reloadMonth();\n        return toast(f.id ? \"Updated\" : n > 1 ? `Added to ${n} days` : \"Added\");\n      }\n      case \"eventWho\": {\n        const f = S.form && S.form.kind === \"event\" ? S.form : null;\n        if (!f) return;\n        readEventForm(f);\n        if (node.dataset.id === \"all\") f.childIds = [];\n        else f.childIds = (f.childIds || []).includes(node.dataset.id)\n          ? f.childIds.filter(x => x !== node.dataset.id)\n          : (f.childIds || []).concat(node.dataset.id);\n        return render();\n      }\n      case \"toggleEvent\":\n        await post(\"toggleEvent\", { id: node.dataset.id });\n        if (S.state.me.role === \"child\") return refresh();\n        return reloadMonth();\n      case \"deleteEvent\":\n        if (!confirm(\"Remove this?\")) return;\n        await post(\"deleteEvent\", { id: node.dataset.id });\n        return reloadMonth();\n      case \"deleteSeries\": {\n        if (!confirm(\"Remove this from every day it's on?\")) return;\n        const r = await post(\"deleteEvent\", { id: node.dataset.id, group: true });\n        await reloadMonth();\n        return toast(`Removed from ${r.removed} days`);\n      }\n      case \"credit\":\n        await post(\"credit\", {\n          taskId: node.dataset.task, childId: node.dataset.child, date: node.dataset.date,\n        });\n        await refresh();\n        await reloadMonth();\n        return toast(\"Marked done\");\n      case \"tab\": S.tab = +node.dataset.i; S.form = null; S.day = null; S.dayData = null; return render();\n      case \"taskKind\": S.taskKind = node.dataset.k; S.form = null; return render();\n      case \"logout\":\n        await post(\"logout\"); S.state = null; S.pick = null; S.view = \"login\";\n        S.profiles = (await get(\"profiles\")).profiles; return render();\n\n      case \"open\": wakeAudio(); S.focus = node.dataset.id; {\n        const t = taskById(S.focus);\n        render();\n        if (t && !t.running && t.status !== \"done\" && t.status !== \"awaiting\") {\n          setState(await post(\"start\", { taskId: t.id })); render();\n        }\n      } return;\n      case \"closeFocus\": S.focus = null; return render();\n      case \"submit\":\n        setState(await post(\"submit\", { taskId: node.dataset.id }));\n        S.focus = null;\n        toast(\"Sent to a parent to check off\"); return;\n      case \"start\": wakeAudio(); setState(await post(\"start\", { taskId: node.dataset.id })); return render();\n      case \"pause\": setState(await post(\"pause\", { taskId: node.dataset.id })); return render();\n\n      case \"approve\": setState(await post(\"approve\", { key: node.dataset.key })); toast(\"Checked off\"); return;\n      case \"undo\": setState(await post(\"undo\", { key: node.dataset.key })); toast(\"Undone\"); return;\n      case \"reject\": setState(await post(\"reject\", { key: node.dataset.key })); toast(\"Sent back\"); return;\n      case \"excuse\":\n        if (!confirm(\"Mark this done without points?\")) return;\n        setState(await post(\"excuse\", { key: node.dataset.key })); return render();\n      case \"weekStart\":\n        setState(await post(\"settings\", { weekStartsOn: +node.dataset.d }));\n        toast(\"Allowance renews on \" + (node.dataset.d === \"0\" ? \"Sunday\" : \"Monday\")); return;\n      case \"adjust\": setState(await post(\"adjust\", { childId: node.dataset.id, delta: +node.dataset.delta })); return render();\n\n      case \"redeem\": setState(await post(\"redeem\", { rewardId: node.dataset.id })); toast(\"Sent to a parent\"); return;\n      case \"fulfill\": setState(await post(\"fulfill\", { id: node.dataset.id })); toast(\"Marked as given\"); return;\n      case \"denyRedemption\": setState(await post(\"denyRedemption\", { id: node.dataset.id })); toast(\"Points refunded\"); return;\n\n      case \"repeatMode\": {\n        const f = formState(\"task\", { days: [0, 1, 2, 3, 4, 5, 6] });\n        readTaskForm(f);\n        f.onceOn = node.dataset.m === \"once\" ? (S.state.date || \"\") : null;\n        return render();\n      }\n      case \"allDays\": {\n        const f = formState(\"task\", { days: [] });\n        readTaskForm(f);\n        f.days = [0, 1, 2, 3, 4, 5, 6];\n        return render();\n      }\n      case \"noDays\": {\n        const f = formState(\"task\", { days: [] });\n        readTaskForm(f);\n        f.days = [];\n        return render();\n      }\n      case \"toggleDay\": {\n        const f = formState(\"task\", { days: [] });\n        const i = +node.dataset.i;\n        f.days = f.days.includes(i) ? f.days.filter(d => d !== i) : f.days.concat(i).sort();\n        readTaskForm(f); return render();\n      }\n      case \"pickSky\": {\n        const f = formState(\"reward\", { childIds: [] });\n        readRewardForm(f);\n        f.sky = node.dataset.sky;\n        return render();\n      }\n      case \"toggleChild\": {\n        const f = formState(\"reward\", { childIds: [] });\n        readRewardForm(f);\n        if (node.dataset.id === \"all\") f.childIds = [];\n        else f.childIds = f.childIds.includes(node.dataset.id)\n          ? f.childIds.filter(x => x !== node.dataset.id)\n          : f.childIds.concat(node.dataset.id);\n        return render();\n      }\n      case \"roleChanged\": { const f = formState(\"user\", {}); readUserForm(f); f.role = val(\"u-role\"); return render(); }\n      case \"pickColor\": { const f = formState(\"user\", {}); readUserForm(f); f.color = node.dataset.c; return render(); }\n      case \"cancelForm\": S.form = null; return render();\n\n      case \"editTask\": {\n        const t = S.state.allTasks.find(x => x.id === node.dataset.id);\n        S.taskKind = t.type;\n        S.form = Object.assign({ kind: \"task\" }, t); return render();\n      }\n      case \"saveTask\": {\n        const f = formState(\"task\", { id: \"\", days: [0, 1, 2, 3, 4, 5, 6] });\n        readTaskForm(f);\n        if (!f.onceOn && !f.days.length) return toast(\"Pick at least one day.\");\n        if (f.onceOn && !/^\\d{4}-\\d{2}-\\d{2}$/.test(f.onceOn)) return toast(\"Pick a date for the one-off.\");\n        setState(await post(\"saveTask\", f));\n        S.form = null; toast(f.id ? \"Task updated\" : \"Task added\"); return;\n      }\n      case \"deleteTask\":\n        if (!confirm(\"Remove this task?\")) return;\n        setState(await post(\"deleteTask\", { id: node.dataset.id })); return render();\n\n      case \"editReward\": {\n        const r = S.state.rewards.find(x => x.id === node.dataset.id);\n        S.form = Object.assign({ kind: \"reward\", sky: \"\" }, r); return render();\n      }\n      case \"saveReward\": {\n        const f = formState(\"reward\", { id: \"\", childIds: [] });\n        readRewardForm(f);\n        setState(await post(\"saveReward\", f));\n        S.form = null; toast(f.id ? \"Reward updated\" : \"Reward added\"); return;\n      }\n      case \"deleteReward\":\n        if (!confirm(\"Remove this reward?\")) return;\n        setState(await post(\"deleteReward\", { id: node.dataset.id })); return render();\n\n      case \"editUser\": {\n        const u = [...S.state.children, ...S.state.admins].find(x => x.id === node.dataset.id);\n        S.form = Object.assign({ kind: \"user\", pin: \"\" }, u); return render();\n      }\n      case \"saveUser\": {\n        const f = formState(\"user\", { id: \"\", color: \"ochre\" });\n        readUserForm(f);\n        setState(await post(\"saveUser\", f));\n        S.form = null; toast(\"Saved\"); return;\n      }\n      case \"deleteUser\":\n        if (!confirm(\"Remove this person and their tasks?\")) return;\n        setState(await post(\"deleteUser\", { id: node.dataset.id })); return render();\n    }\n  } catch (err) {\n    toast(err.message);\n  }\n});\n\nfunction val(id) { const n = el(\"#\" + id); return n ? n.value : \"\"; }\n\nfunction readTaskForm(f) {\n  if (el(\"#f-title\")) {\n    f.title = val(\"f-title\");\n    f.childId = val(\"f-child\");\n    f.points = +val(\"f-pts\");\n    if (el(\"#f-dur\")) f.durationMin = +val(\"f-dur\");\n    // Only read the date while the form is actually in one-off mode, or the\n    // capture that runs before every render undoes a switch back to weekly.\n    if (el(\"#f-once\") && f.onceOn) f.onceOn = val(\"f-once\");\n  }\n  // An empty selection stays empty — clearing the days is a legitimate step\n  // on the way to picking one, not a signal to select them all.\n  if (!Array.isArray(f.days)) f.days = [];\n}\n\nfunction readRewardForm(f) {\n  if (el(\"#r-title\")) { f.title = val(\"r-title\"); f.cost = +val(\"r-cost\"); }\n  if (!f.childIds) f.childIds = [];\n  if (f.sky === undefined) f.sky = \"\";\n}\n\nfunction readUserForm(f) {\n  if (el(\"#u-name\")) {\n    f.name = val(\"u-name\");\n    f.pin = val(\"u-pin\");\n    if (!f.id) f.role = val(\"u-role\");\n    if (el(\"#u-allow\")) f.allowanceWeekly = +val(\"u-allow\");\n  }\n}\n\nroot.addEventListener(\"change\", e => {\n  const node = e.target.closest(\"[data-act]\");\n  if (node && node.dataset.act === \"roleChanged\") {\n    const f = formState(\"user\", {});\n    readUserForm(f);\n    f.role = node.value;\n    render();\n  }\n});\n\ndocument.addEventListener(\"keydown\", e => {\n  if (S.view === \"login\" && S.pick) {\n    if (/^[0-9]$/.test(e.key) && S.pin.length < 12) {\n      S.pin += e.key; render();\n      if (S.pin.length === 4) submitPin();\n    } else if (e.key === \"Backspace\") { S.pin = S.pin.slice(0, -1); render(); }\n    else if (e.key === \"Escape\") { S.pick = null; S.pin = \"\"; render(); }\n  } else if (e.key === \"Escape\" && S.focus) { S.focus = null; render(); }\n});\n\n/* ---------- boot ---------- */\n\n(async function boot() {\n  try {\n    setState(await get(\"state\"));\n  } catch (e) {\n    S.view = \"login\";\n    S.profiles = (await get(\"profiles\")).profiles;\n  }\n  render();\n})();\n" },
  "/site.webmanifest": { type: "application/manifest+json", body: "{\n  \"name\": \"Hearth\",\n  \"short_name\": \"Hearth\",\n  \"start_url\": \"/\",\n  \"display\": \"standalone\",\n  \"background_color\": \"#DDE3DD\",\n  \"theme_color\": \"#DDE3DD\",\n  \"icons\": [\n    { \"src\": \"/icon-192.png\", \"sizes\": \"192x192\", \"type\": \"image/png\", \"purpose\": \"any maskable\" },\n    { \"src\": \"/icon-512.png\", \"sizes\": \"512x512\", \"type\": \"image/png\", \"purpose\": \"any maskable\" }\n  ]\n}\n" },
  "/favicon.svg": { type: "image/svg+xml", body: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 120 120\" role=\"img\" aria-label=\"Hearth\">\n  <title>Hearth</title>\n  <rect width=\"120\" height=\"120\" rx=\"26\" fill=\"#DDE3DD\"/>\n  <path d=\"M46 30 L62 14 M74 30 L58 14\" fill=\"none\" stroke=\"#3E4C41\" stroke-width=\"7\" stroke-linecap=\"round\"/>\n  <path d=\"M60 24 L106 76 A7 7 0 0 1 101 88 L19 88 A7 7 0 0 1 14 76 Z\" fill=\"#3E4C41\"/>\n  <path d=\"M60 52 C68 66 75 71 75 79 A15 15 0 0 1 45 79 C45 68 54 64 60 52 Z\" fill=\"#DDE3DD\"/>\n  <path d=\"M60 58 C66 69 71 72 71 79 A11 11 0 0 1 49 79 C49 70 56 68 60 58 Z\" fill=\"#A8752A\"/>\n</svg>\n" },
  "/favicon-16.png": { type: "image/png", b64: "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAB1ElEQVQ4jY2TXUtUQRjHf8+47pIt3WhBrr3hXkWRBkpEVLB0EeWF36O+gV+gq7ISZckyKSoIe9kTFkhvlhVL9mJk0VkL1sBz0YV4LGb1zHixcBbXs9r/ap633zzzzIwAuEW3W6z0IOwH6llfgSCfjTJn0qn0hLhFt1uQkQ2KorSkRB1VYqWnVobWGq11rXC9seacQtgX2WcQ0Jftp7f/EstBUAvSqYB4tdday9DNYaa+fmH6+zcGr1/FWhsFSKgo70juPq/evA7tt/l33Hv4ILKFNYAX4y9xRh8BUKcsMSnvnHvsMPbs6fqAj1OfGL5zI7Q7mhbp3OqH9q27t3n/YTIaMPPrJwODWUxgANid1LQ3/uVA4z92bC4BYIwhe+0KPwruasCc53G+rze8sk11hkxqHsEiWDLN88RVGVxaKnFx4DJznlcB5EYdfL/S6s6kJqEqU2+IGXYlS6Ht+z7Ok/KcYgCnT54itb05TIgvFmE2t+qsHYeO0dbQAoCIcLCtvbwuFAua6rdgLTNjF/gzXZ56094T7MmcBRGqpKUwWxjHcqQ6AqAXPLBCYsu2qDBAXtzf7mEx8pyNf+FaCV0qnUpPWGWPY5kElv+jrATkEbpaW1qdFaZwsw7HqXTYAAAAAElFTkSuQmCC" },
  "/favicon-32.png": { type: "image/png", b64: "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABmJLR0QA/wD/AP+gvaeTAAAD1klEQVRYhcWX609cRRjGf3M4oVVz1oi90CjV5W5JxMTaUmzKB02aFOuVNm0wSEIs2gSb6D/hJ0upLRBKU5B7aKW20LBhbSlyE0W5SFjYBRq8QBdcy24UttkzfpBiN7sLPbrK82nOO/M87zNzZuY9R3AfbNO2J1TUD4ADQCzwMOGBGxhFUBspI0tiYmL+uNch7jXsP9pzhBTFYUwaCg6BeDM2JnZwxcBy8gojKlJKbjtvA7Bl8xaEEGsw/PCbrut7E55K+EEsL/sYBmfe1dNNWUU5AO++k0d62h4jdIDRxYXFVGX5nRte9vEJe9C2ASRv1DbmqUCmUWZdYwM3OtoxaRoANzra2RC5gSNZh41KZavA00YYjU0XabVa0DSN3OwcFEXhQvVntFotSHSOZh15cDHBswrwyIOOb7VaaG69hknTOJ6XT01DPRW1VRzLzcOkaVisbbRaLUbmoylGRquqyrat0Zw4XkDtxQbmfp3D5XJR01jPifcK2LY1GlVVjUgiHNMOaYTg8/k4dfY0QyPDfvHkpCQ+KvgQNSLCkAFDKyCl5EJVZUBygFGbjfKK80hpaD7GDHx+pYmvejpD9vf09dJ09fJ/Y6C98yZXrjWvOe6LlqtY278Mr4HB4SEqa6sC4kKIoFdwTUMd/QPfhcfA1K0pzp4rQffpAX17dqXx4u70gLiu65SWl+GYmPh3Bpxzc5w8U8TS0lJAn0kzcehgJlmZ+9GWb8T74b3rpbC4iJnZ2X9mwOPxcPLTQhbcC4GkCIX38/Lx2Cy4Bi6Rm50TUuOTM8E1VjXgvevlVMlpfpmdCUo69PpbPPmoZKb/Es4RC/GPCTL27gs61ul0UhhiFYMa0HWd0vNl2B2OoIQdyc/wUvpuHC0fI3UfSMlkWyGHX32FTVGbgnImb01RXF4adB8FGKhprKP/+9A7OHP/AX7qrcbrmV+JeT3zzA9c5o2Dr4XkDQwNUlkfeJL8DFisbVivr36G4+PiuDPZFxB32bt4LjV1VW57x03arltDG+js7VpVAEAQ/NNLSh8REWsXoq7e7tAGkhMT1xQYc4wTlZgREH88KYOx8bE1+UkJSX7PftVQ9+n0fvs1LpcrpIDJZCJt505+7q5kbsQKAjbveJnotLfp6fsGt9sdkhsVFcWu519AUf6et+FyHG4o/PXTsF7wKMDQOhqYUJBUr1t6SbOy6F48B9jWIb1H8SlFSkpKildKmQXc+R+TSyTHzGbzjAIQvz1+WCD2AcELQHjhQZIdtz2uFvC/1qanpx/yCm8+kqNAMmAKU9LfgXEkLYpPKTKbzStl9k8tXnxuXwyEkAAAAABJRU5ErkJggg==" },
  "/favicon-48.png": { type: "image/png", b64: "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" },
  "/apple-touch-icon.png": { type: "image/png", b64: "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" },
  "/icon-192.png": { type: "image/png", b64: "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" },
  "/icon-512.png": { type: "image/png", b64: "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAAAABmJLR0QA/wD/AP+gvaeTAAAgAElEQVR4nO3deXhV5b3o8T1lgAAJAWRGFMLgxKAiKgiKQ2utU62ztdra1trW2vb0nNPnOefe55x7e237QOYEUCZBhpKiQTGlRBBQZM4AAULIQELYSTYZSLIz7GndP3K0LSRrZ9h7vWut9/v5i7pXVn5FWV+yhndZS6tKLQAA+dhEDwAAEIMAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkCAAASIoAAICkHKIHAMLL5/Mdyz+eV5BfeaGquaU5KjLqmmtGzZw2867580fGj7RYLJcaLh04ePD02dN1da5OT+ewocMmTZg4Z9bsW2fPdTj4AwIzs5ZWlYqeAQiXvML89/+8qb6+/uqPbHbbvQsWWyyWPZ9/FvAHrt5gxIgRLzz93JxbZod7SEAUAgDT2rb9g4//+omiKP3eg9VqfeQbDz/56BMhnArQ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UgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACRFAABAUgQAACT1/wEsZ/FupBeeuwAAAABJRU5ErkJggg==" },
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
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
const SHARED = "all";

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
    days: [0, 1, 2, 3, 4, 5, 6], active: true, onceOn: null, createdAt: null,
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
    events: [],
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
  if (!Array.isArray(db.events)) db.events = [];
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
    if (t.onceOn === undefined) t.onceOn = null;
    // Tasks that predate this field count as always having existed, so old
    // history isn't retroactively marked incomplete.
    if (t.createdAt === undefined) t.createdAt = null;
  }
  // Log keys used to be date:taskId. They now carry the child, since a task
  // can belong to everyone.
  for (const key of Object.keys(db.logs || {})) {
    if (key.split(":").length === 2) {
      const log = db.logs[key];
      const moved = key + ":" + log.childId;
      log.key = moved;
      db.logs[moved] = log;
      delete db.logs[key];
    }
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

// A 4-digit PIN is 10,000 guesses. Without a delay a script walks them in
// under a minute, which matters now that Hearth can be reached from outside.
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60000;

function lockStatus(key) {
  const rec = attempts.get(key);
  if (!rec) return 0;
  if (rec.until && rec.until > Date.now()) return Math.ceil((rec.until - Date.now()) / 1000);
  if (rec.until && rec.until <= Date.now()) attempts.delete(key);
  return 0;
}

function noteFailure(key) {
  const rec = attempts.get(key) || { count: 0, until: 0 };
  rec.count++;
  if (rec.count >= MAX_ATTEMPTS) {
    // Each further run of failures locks for longer.
    rec.until = Date.now() + LOCK_MS * Math.pow(2, Math.min(4, Math.floor(rec.count / MAX_ATTEMPTS) - 1));
  }
  attempts.set(key, rec);
}

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

function eventVisibleTo(ev, childId) {
  return ev.childIds.length === 0 || ev.childIds.includes(childId);
}

function ownsTask(task, childId) {
  return task.childId === childId || task.childId === SHARED;
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

function logKey(taskId, date, childId) {
  return date + ":" + taskId + ":" + childId;
}

function getLog(task, date, childId) {
  const key = logKey(task.id, date, childId);
  if (!db.logs[key]) {
    db.logs[key] = {
      key, taskId: task.id, childId, date,
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
    award(log.childId, task.points, log);
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

function scheduledOn(task, date, day) {
  if (task.createdAt && task.createdAt > date) return false;
  if (task.onceOn) return task.onceOn === date;
  return task.days.includes(day);
}

function tasksFor(childId, date, day, live) {
  const isLive = live !== false;
  return db.tasks
    .filter(t => (t.childId === childId || t.childId === SHARED) && t.active !== false && scheduledOn(t, date, day))
    .map(t => {
      // Looking at another day is a read: no log is created, no timer settles,
      // no points move.
      const log = isLive
        ? settle(getLog(t, date, childId), t)
        : (db.logs[logKey(t.id, date, childId)] || {
            key: logKey(t.id, date, childId), status: "idle",
            accumulatedMs: 0, startedAt: null, awardedPoints: 0,
          });
      return {
        id: t.id, title: t.title, type: t.type, durationMin: t.durationMin,
        points: t.points, days: t.days, childId: t.childId, shared: t.childId === SHARED,
        onceOn: t.onceOn || null,
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
    .map(r => ({ id: r.id, title: r.title, cost: r.cost, childIds: r.childIds, sky: r.sky || "" }));
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
      week: weekOf(user.id, date),
      streak: streakFor(user.id),
      events: eventsOn(date, user.id),
      redemptions: db.redemptions
        .filter(r => r.childId === user.id)
        .slice(-12).reverse()
        .map(r => ({ ...r, rewardTitle: (db.rewards.find(x => x.id === r.rewardId) || {}).title || "Reward" })),
    };
  }

  const board = children.map(c => {
    const tasks = tasksFor(c.id, date, day);
    return { child: publicUser(c), tasks, streak: streakFor(c.id), week: weekOf(c.id, date) };
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
    events: eventsOn(date, null),
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


/* ---------- history ---------- */

function shiftDate(date, delta) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayOfDate(date) {
  return new Date(date + "T12:00:00").getDay();
}

// A day's record is rebuilt from the logs rather than stored, so it stays
// correct if a task is edited or removed later.
function dayRecord(childId, date) {
  const day = dayOfDate(date);
  const scheduled = db.tasks.filter(t =>
    (t.childId === childId || t.childId === SHARED) && t.active !== false && scheduledOn(t, date, day));

  let done = 0, points = 0;
  for (const t of scheduled) {
    const log = db.logs[logKey(t.id, date, childId)];
    if (log && log.status === "done") { done++; points += log.awardedPoints || 0; }
  }
  return { date, total: scheduled.length, done, points };
}

function groupSize(groupId) {
  return groupId ? db.events.filter(e => e.groupId === groupId).length : 1;
}

function eventsOn(date, childId) {
  return db.events
    .filter(e => e.date === date && (!childId || eventVisibleTo(e, childId)))
    .map(e => ({
      ...e,
      who: e.childIds.map(cid => (db.users.find(u => u.id === cid) || {}).name).filter(Boolean),
      groupSize: groupSize(e.groupId),
    }))
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}

function weekStartOf(date) {
  const startsOn = db.settings.weekStartsOn === 0 ? 0 : 1;
  return shiftDate(date, -((dayOfDate(date) - startsOn + 7) % 7));
}

function weekOf(childId, date) {
  const start = weekStartOf(date);
  const out = [];
  for (let i = 0; i < 7; i++) out.push(dayRecord(childId, shiftDate(start, i)));
  return out;
}

function historyFor(childId, days) {
  const out = [];
  let date = today();
  for (let i = 0; i < days; i++) {
    out.push(dayRecord(childId, date));
    date = shiftDate(date, -1);
  }
  return out.reverse();
}

// A day with nothing scheduled doesn't extend a streak but doesn't break one
// either — a rest day shouldn't cost a child nine days of momentum. Today only
// counts once it's actually finished, so a streak isn't broken at breakfast.
function streakFor(childId) {
  let streak = 0;
  let date = today();
  const now = dayRecord(childId, date);
  if (!(now.total > 0 && now.done >= now.total)) date = shiftDate(date, -1);

  for (let i = 0; i < 400; i++) {
    const rec = dayRecord(childId, date);
    if (rec.total === 0) { date = shiftDate(date, -1); continue; }
    if (rec.done < rec.total) break;
    streak++;
    date = shiftDate(date, -1);
  }
  return streak;
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
  const body = asset.b64 ? Buffer.from(asset.b64, "base64") : asset.body;
  res.writeHead(200, {
    "Content-Type": asset.type,
    "Cache-Control": "no-cache",
    "ETag": `"${VERSION}"`,
  });
  res.end(body);
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
    const key = String(body.userId || "?");
    const wait = lockStatus(key);
    if (wait) {
      return json(res, 429, {
        error: `Too many tries. Wait ${wait > 60 ? Math.ceil(wait / 60) + " minutes" : wait + " seconds"} and try again.`,
      });
    }
    const target = db.users.find(u => u.id === body.userId);
    if (!target || !checkSecret(body.pin, target.secret)) {
      noteFailure(key);
      const left = MAX_ATTEMPTS - (attempts.get(key) || { count: 0 }).count;
      return json(res, 401, {
        error: left > 0 && left <= 2
          ? `That PIN doesn't match. ${left} ${left === 1 ? "try" : "tries"} left.`
          : "That PIN doesn't match. Try again.",
      });
    }
    attempts.delete(key);
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

  if (route === "day") {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? body.date : today();
    const span = Math.abs(Math.round((new Date(date + "T12:00:00") - new Date(today() + "T12:00:00")) / 86400000));
    if (span > 366) return json(res, 400, { error: "That date is too far away." });
    const live = date === today();
    const day = dayOfDate(date);

    if (user.role === "child") {
      return json(res, 200, {
        date, live,
        tasks: tasksFor(user.id, date, day, live),
        week: weekOf(user.id, date),
        events: eventsOn(date, user.id),
      });
    }
    const children = db.users.filter(u => u.role === "child");
    return json(res, 200, {
      date, live,
      board: children.map(c => ({
        child: publicUser(c),
        tasks: tasksFor(c.id, date, day, live),
        streak: streakFor(c.id),
        week: weekOf(c.id, date),
      })),
      events: eventsOn(date, null),
    });
  }

  if (route === "saveEvent") {
    if (!isAdmin) return deny();
    const title = str(body.title, 80);
    if (!title) return json(res, 400, { error: "Give it a name." });

    const valid = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
    // One item can be scheduled across many days. Each day gets its own record
    // so a child can tick off Tuesday without touching Thursday.
    let dates = Array.isArray(body.dates) ? body.dates.filter(valid) : [];
    if (!dates.length && valid(body.date)) dates = [body.date];
    dates = [...new Set(dates)].sort();
    if (!dates.length) return json(res, 400, { error: "Pick at least one date." });
    if (dates.length > 366) return json(res, 400, { error: "That's more than a year of days." });

    const shared = {
      title,
      time: /^\d{2}:\d{2}$/.test(String(body.time || "")) ? body.time : "",
      note: str(body.note, 300),
      childIds: Array.isArray(body.childIds)
        ? body.childIds.filter(cid => db.users.some(u => u.id === cid && u.role === "child")) : [],
    };

    const existing = db.events.find(e => e.id === body.id);
    if (existing) {
      // Editing touches the one day you opened, not the whole series.
      Object.assign(existing, shared, { date: dates[0] });
      save();
      return json(res, 200, { ok: true, count: 1 });
    }

    const groupId = dates.length > 1 ? id("g") : null;
    for (const date of dates) {
      db.events.push(Object.assign({ id: id("e"), done: false, groupId, date }, shared));
    }
    save();
    return json(res, 200, { ok: true, count: dates.length });
  }

  if (route === "deleteEvent") {
    if (!isAdmin) return deny();
    const target = db.events.find(e => e.id === body.id);
    if (!target) return json(res, 404, { error: "Not found." });
    if (body.group && target.groupId) {
      const before = db.events.length;
      db.events = db.events.filter(e => e.groupId !== target.groupId);
      save();
      return json(res, 200, { ok: true, removed: before - db.events.length });
    }
    db.events = db.events.filter(e => e.id !== body.id);
    save();
    return json(res, 200, { ok: true, removed: 1 });
  }

  if (route === "toggleEvent") {
    const ev = db.events.find(e => e.id === body.id);
    if (!ev) return json(res, 404, { error: "Not found." });
    if (!isAdmin && !eventVisibleTo(ev, user.id)) return json(res, 403, { error: "Not yours." });
    ev.done = !ev.done;
    save();
    return json(res, 200, { ok: true });
  }

  if (route === "month") {
    const anchor = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? body.date : today();
    const first = anchor.slice(0, 8) + "01";
    const d = new Date(first + "T12:00:00");
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const children = user.role === "child"
      ? db.users.filter(u => u.id === user.id)
      : db.users.filter(u => u.role === "child");

    const days = [];
    for (let i = 0; i < daysInMonth; i++) {
      const date = shiftDate(first, i);
      const day = dayOfDate(date);
      let total = 0, done = 0;
      for (const c of children) {
        const rec = dayRecord(c.id, date);
        total += rec.total;
        done += rec.done;
      }
      days.push({
        date, total, done,
        events: db.events
          .filter(e => e.date === date && (user.role !== "child" || eventVisibleTo(e, user.id)))
          .map(e => ({
            ...e,
            who: e.childIds.map(cid => (db.users.find(u => u.id === cid) || {}).name).filter(Boolean),
            groupSize: groupSize(e.groupId),
          }))
          .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")),
      });
    }
    return json(res, 200, { month: first.slice(0, 7), days });
  }

  if (route === "history") {
    const childId = user.role === "child" ? user.id : str(body.childId, 40);
    if (user.role === "child" && body.childId && body.childId !== user.id) {
      return json(res, 403, { error: "That isn't your history." });
    }
    const child = db.users.find(u => u.id === childId && u.role === "child");
    if (!child) return json(res, 404, { error: "Child not found." });
    return json(res, 200, {
      childId,
      name: child.name,
      streak: streakFor(childId),
      days: historyFor(childId, num(body.days, 7, 90, 30)),
    });
  }

  /* --- timer control (children only, on their own tasks) --- */

  if (route === "start" || route === "pause") {
    const task = db.tasks.find(t => t.id === body.taskId);
    if (!task) return json(res, 404, { error: "Task not found." });
    if (user.role !== "child" || !ownsTask(task, user.id)) return json(res, 403, { error: "That isn't your task." });

    const log = settle(getLog(task, today(), user.id), task);
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
    if (user.role !== "child" || !ownsTask(task, user.id)) return json(res, 403, { error: "That isn't your task." });
    if (task.type !== "chore") return json(res, 400, { error: "Study blocks finish on their own timer." });

    const log = getLog(task, today(), user.id);
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

  if (route === "undo") {
    if (!isAdmin) return deny();
    const log = db.logs[body.key];
    if (!log || log.status !== "done") return json(res, 409, { error: "Nothing to undo." });
    const task = db.tasks.find(t => t.id === log.taskId);
    const child = db.users.find(u => u.id === log.childId);
    if (child && log.awardedPoints) child.earned = Math.max(0, child.earned - log.awardedPoints);
    log.awardedPoints = 0;
    log.approvedBy = null;
    log.completedAt = null;
    // A chore goes back to the queue. A study block already served its time,
    // so it returns to paused with the clock it had rather than to zero.
    if (task && task.type === "chore") {
      log.status = "awaiting";
    } else {
      log.status = "paused";
      if (task && task.durationMin) log.accumulatedMs = task.durationMin * 60000;
    }
    save();
    return json(res, 200, stateFor(user));
  }

  if (route === "credit") {
    if (!isAdmin) return deny();
    const task = db.tasks.find(t => t.id === body.taskId);
    const child = db.users.find(u => u.id === body.childId && u.role === "child");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? body.date : today();
    if (!task || !child) return json(res, 404, { error: "Task or child not found." });
    if (!ownsTask(task, child.id)) return json(res, 400, { error: "That task isn't theirs." });
    if (date > today()) return json(res, 400, { error: "That day hasn't happened yet." });
    if (!scheduledOn(task, date, dayOfDate(date))) {
      return json(res, 400, { error: "That task wasn't scheduled that day." });
    }

    // The log may not exist at all: nobody started it, and browsing a past day
    // deliberately creates nothing.
    const key = logKey(task.id, date, child.id);
    const log = db.logs[key] || (db.logs[key] = {
      key, taskId: task.id, childId: child.id, date,
      status: "idle", accumulatedMs: 0, startedAt: null,
      completedAt: null, approvedBy: null, awardedPoints: 0,
    });
    if (log.status === "done") return json(res, 409, { error: "Already marked done." });

    log.status = "done";
    log.startedAt = null;
    log.completedAt = Date.now();
    log.approvedBy = user.id;
    log.backfilled = true;
    if (task.durationMin) log.accumulatedMs = Math.max(log.accumulatedMs, task.durationMin * 60000);
    award(child.id, task.points, log);
    save();
    return json(res, 200, { ok: true });
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
    // A one-off carries a date instead of a weekday pattern.
    const once = /^\d{4}-\d{2}-\d{2}$/.test(String(body.onceOn || "")) ? body.onceOn : null;
    // An explicitly empty list is a mistake worth reporting; a missing one
    // just means "every day".
    if (!once && Array.isArray(body.days) && !body.days.length) {
      return json(res, 400, { error: "Pick at least one day." });
    }
    const days = Array.isArray(body.days)
      ? [...new Set(body.days.map(d => num(d, 0, 6, 0)))].sort()
      : [0, 1, 2, 3, 4, 5, 6];
    const type = body.type === "chore" ? "chore" : "study";
    const fields = {
      title,
      type,
      // Chores have no set length; only study blocks run against a clock.
      durationMin: type === "chore" ? null : num(body.durationMin, 1, 240, 15),
      points: num(body.points, 0, 500, 10),
      days,
      onceOn: once,
    };
    const existing = db.tasks.find(t => t.id === body.id);
    if (existing) {
      Object.assign(existing, fields);
      if (body.childId === SHARED || db.users.some(u => u.id === body.childId && u.role === "child")) {
        existing.childId = body.childId;
      }
    }
    else {
      const forAll = body.childId === SHARED;
      if (!forAll && !db.users.some(u => u.id === body.childId && u.role === "child")) {
        return json(res, 400, { error: "Pick a child for this task." });
      }
      db.tasks.push(Object.assign({ id: id("t"), childId: body.childId, active: true, createdAt: today() }, fields));
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
      // Empty means the card picks its own sky from the reward's name.
      sky: str(body.sky, 20).replace(/[^a-z]/g, ""),
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
    db.tasks = db.tasks.filter(t => t.childId !== body.id);  // shared tasks survive
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


/* ---------- command line ---------- */

// PINs are hashed, so a forgotten one can't be recovered — only replaced, by
// someone with access to the container. That's the recovery path.
function runCommand(argv) {
  const cmd = argv[2];

  if (cmd === "--list-users") {
    console.log("\n  Everyone in this Hearth:\n");
    for (const u of db.users) {
      console.log(`    ${u.name.padEnd(18)} ${u.role.padEnd(7)} ${u.id}`);
    }
    console.log("");
    return true;
  }

  if (cmd === "--reset-pin") {
    const who = argv[3];
    const pin = argv[4];
    if (!who || !pin) {
      console.error("\n  Usage: node server.js --reset-pin <name-or-id> <new-pin>\n");
      process.exit(1);
    }
    if (String(pin).length < 4) {
      console.error("\n  A PIN needs at least 4 characters.\n");
      process.exit(1);
    }
    const lower = String(who).toLowerCase();
    const matches = db.users.filter(u => u.id === who || u.name.toLowerCase() === lower);
    if (!matches.length) {
      console.error(`\n  No one here called "${who}". Try --list-users.\n`);
      process.exit(1);
    }
    if (matches.length > 1) {
      console.error(`\n  More than one person called "${who}". Use the id instead:`);
      matches.forEach(u => console.error(`    ${u.name}  ${u.id}`));
      console.error("");
      process.exit(1);
    }
    const target = matches[0];
    target.secret = makeSecret(pin);
    // Any existing sessions for that account are no longer trustworthy.
    for (const [token, sess] of sessions) if (sess.userId === target.id) sessions.delete(token);
    persistSessions();
    save(true);
    console.log(`\n  PIN reset for ${target.name} (${target.role}). Sign in with the new one.\n`);
    return true;
  }

  return false;
}

load();
loadSessions();

if (runCommand(process.argv)) process.exit(0);
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
