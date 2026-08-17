"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const VERSION = process.env.HEARTH_VERSION || "dev";
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");

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

function tasksFor(childId, date, day) {
  return db.tasks
    .filter(t => (t.childId === childId || t.childId === SHARED) && t.active !== false && t.days.includes(day))
    .map(t => {
      const log = settle(getLog(t, date, childId), t);
      return {
        id: t.id, title: t.title, type: t.type, durationMin: t.durationMin,
        points: t.points, days: t.days, childId: t.childId, shared: t.childId === SHARED,
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
  const file = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    // Revalidate on every load. Without this a browser can keep serving the
    // old app.js from cache after an update, so a deploy appears to do nothing.
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "ETag": `"${VERSION}"`,
    });
    res.end(buf);
  });
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
    // An explicitly empty list is a mistake worth reporting; a missing one
    // just means "every day".
    if (Array.isArray(body.days) && !body.days.length) {
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
  if (!fs.existsSync(path.join(PUBLIC_DIR, "index.html"))) {
    console.warn(
      `\n  Heads up: no index.html found in ${PUBLIC_DIR}\n` +
      `  Every page will return "not found" until it's there.\n` +
      `  Expected layout:\n` +
      `      server.js\n` +
      `      public/index.html\n` +
      `      public/app.js\n` +
      `      public/styles.css\n` +
      `  Check the files kept their extensions when you downloaded them.\n`
    );
  }
});

// Writes are debounced, so flush before exiting or the last few actions vanish.
function shutdown() {
  try { save(true); } catch (err) { console.error(err); }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
