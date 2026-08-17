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
  toast: "",
};

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
  S.state = data;
  S.fetchedAt = Date.now();
  S.view = data.me.role === "admin" ? "admin" : "child";
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
  back: '<svg viewBox="0 0 24 24"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/></svg>',
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
      <p class="eyebrow">Hearth</p>
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

/* ---------- child ---------- */

function statusChip(t) {
  if (t.status === "done") return `<span class="chip done">done · +${t.awardedPoints || 0}</span>`;
  if (t.status === "awaiting") return `<span class="chip await">waiting on parent</span>`;
  if (t.status === "running") return `<span class="chip live">running</span>`;
  if (t.status === "paused") return `<span class="chip">paused</span>`;
  return `<span class="chip">not started</span>`;
}

function taskCard(t) {
  const total = t.durationMin * 60000;
  const done = t.status === "done" || t.status === "awaiting";
  const pct = done ? 1 : Math.min(1, liveElapsed(t) / total);
  const remaining = done ? 0 : Math.max(0, total - liveElapsed(t));

  return `<div class="card">
    <div class="row">
      <div class="ring js-ring" data-id="${t.id}">
        ${ringSvg(pct, 22, 5)}
        <span class="label js-mini ${t.running ? "on" : ""}">${done ? "✓" : clock(remaining)}</span>
      </div>
      <div style="flex:1;min-width:0">
        <h3>${esc(t.title)}</h3>
        <div class="meta">${t.durationMin} min · ${t.points} pts · ${t.type}</div>
        <div style="margin-top:8px">${statusChip(t)}</div>
      </div>
      ${done ? `<button class="pad" disabled aria-label="Finished">${ICON.check}</button>`
        : `<button class="pad accent" data-act="open" data-id="${t.id}"
             aria-label="${t.running ? "Open timer" : "Start"} ${esc(t.title)}">${t.running ? ICON.pause : ICON.play}</button>`}
    </div>
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
        <span class="points" title="allowance + saved">
          <b>${st.me.points}</b><span>PTS</span>
        </span>
        <button class="btn quiet small" data-act="logout">Sign out</button>
      </div>
    </div>
    ${tabBar(tabs)}
    ${body}
  </div>`;
}

function childToday() {
  const st = S.state;
  const study = st.tasks.filter(t => t.type === "study");
  const chores = st.tasks.filter(t => t.type === "chore");
  const left = st.tasks.filter(t => t.status !== "done").length;

  if (!st.tasks.length) return `<p class="empty">Nothing assigned for today.</p>`;

  return `
    <div class="card flat" style="margin-bottom:20px">
      <div class="spread">
        <div>
          <div style="font-size:15px;font-weight:500">${left === 0 ? "All finished" : left + " left today"}</div>
          <div class="meta" style="margin-top:4px">${st.tasks.length - left} of ${st.tasks.length} complete</div>
        </div>
        <div class="ring" style="width:44px;height:44px;flex-basis:44px">
          ${ringSvg((st.tasks.length - left) / st.tasks.length, 18, 4)}
        </div>
      </div>
    </div>
    ${study.length ? `<h2 class="section-title">Studying</h2>${study.map(taskCard).join("")}` : ""}
    ${chores.length ? `<h2 class="section-title">Chores</h2>${chores.map(taskCard).join("")}` : ""}`;
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
    ${st.rewards.length ? st.rewards.map(r => {
      const afford = st.me.points >= r.cost;
      return `<div class="card">
        <div class="spread">
          <div>
            <h3>${esc(r.title)}</h3>
            <div class="meta">${r.cost} points${afford ? "" : ` · ${r.cost - st.me.points} to go`}</div>
          </div>
          <button class="btn ${afford ? "accent" : ""}" data-act="redeem" data-id="${r.id}" ${afford ? "" : "disabled"}>Redeem</button>
        </div>
      </div>`;
    }).join("") : `<p class="empty">No rewards set up yet.</p>`}
    ${st.redemptions.length ? `<h2 class="section-title">Your requests</h2>
      ${st.redemptions.map(r => `<div class="card flat">
        <div class="spread">
          <div><h3>${esc(r.rewardTitle)}</h3><div class="meta">${r.cost} pts</div></div>
          <span class="chip ${r.status === "fulfilled" ? "done" : r.status === "denied" ? "await" : ""}">${r.status}</span>
        </div>
      </div>`).join("")}` : ""}`;
}

/* ---------- focus overlay ---------- */

function focusView() {
  const t = taskById(S.focus);
  if (!t) return "";
  const total = t.durationMin * 60000;
  const done = t.status === "done" || t.status === "awaiting";
  const remaining = done ? 0 : Math.max(0, total - liveElapsed(t));
  const pct = done ? 1 : Math.min(1, liveElapsed(t) / total);

  const note = done
    ? (t.type === "chore" ? "Sent to a parent to check off" : "Finished · +" + t.points + " points")
    : t.type === "chore"
      ? "run the timer, then a parent checks it off"
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
        <div class="caption">${t.durationMin} min · ${t.points} pts</div>
      </div>
    </div>
    <button class="key ${t.running ? "on" : ""}" data-act="${done ? "" : t.running ? "pause" : "start"}" data-id="${t.id}"
      ${done ? "disabled" : ""} aria-label="${t.running ? "Pause" : "Start"}">
      ${done ? ICON.check : t.running ? ICON.pause : ICON.play}
    </button>
    <p class="caption" style="max-width:260px">${esc(note)}</p>
  </div>`;
}

/* ---------- admin ---------- */

function tabBar(labels) {
  return `<div class="tabs" style="grid-template-columns:repeat(${labels.length},1fr)">
    <span class="thumb" style="width:calc((100% - 10px)/${labels.length});transform:translateX(calc(${S.tab} * 100%))"></span>
    ${labels.map((l, i) => `<button data-act="tab" data-i="${i}" aria-selected="${i === S.tab}">${l}</button>`).join("")}
  </div>`;
}

function adminView() {
  const st = S.state;
  const pending = st.approvals.length + st.redemptions.length;
  const tabs = ["Today", "Queue" + (pending ? " " + pending : ""), "Tasks", "Rewards", "Family"];
  const body = [adminToday, adminApprovals, adminTasks, adminRewards, adminFamily][S.tab]();

  return `<div class="wrap">
    <div class="top">
      <div class="brand">
        <span class="avatar" data-color="${esc(st.me.color)}">${esc(initials(st.me.name))}</span>
        <div><h1>${esc(st.me.name)}</h1><div class="date">${esc(st.date)}</div></div>
      </div>
      <button class="btn quiet small" data-act="logout">Sign out</button>
    </div>
    ${tabBar(tabs)}
    ${body}
  </div>`;
}

function adminToday() {
  const st = S.state;
  if (!st.board.length) return `<p class="empty">Add a child in the Family tab to get started.</p>`;

  return st.board.map(b => {
    const done = b.tasks.filter(t => t.status === "done").length;
    return `<div style="margin-bottom:30px">
      <div class="spread" style="margin-bottom:12px">
        <div class="row">
          <span class="avatar sm" data-color="${esc(b.child.color)}">${esc(initials(b.child.name))}</span>
          <div>
            <div style="font-size:15px;font-weight:500">${esc(b.child.name)}</div>
            <div class="meta mono" style="font-size:10.5px;color:var(--muted)">${done}/${b.tasks.length} done today</div>
          </div>
        </div>
        <div style="text-align:right">
          <span class="points"><b>${b.child.points}</b><span>PTS</span></span>
          <div class="meta mono" style="font-size:10px;color:var(--muted);margin-top:5px">${b.child.allowanceRemaining} allowance · ${b.child.earned} saved</div>
        </div>
      </div>
      ${b.tasks.length ? b.tasks.map(t => `<div class="card flat">
        <div class="spread">
          <div style="min-width:0">
            <h3>${esc(t.title)}</h3>
            <div class="meta">${t.type} · ${t.durationMin} min · ${Math.floor(liveElapsed(t) / 60000)} min logged</div>
          </div>
          <div class="row">
            ${statusChip(t)}
            ${t.status === "awaiting" ? `<button class="btn small accent" data-act="approve" data-key="${t.key}">Check off</button>` : ""}
            ${t.status !== "done" && t.status !== "awaiting" ? `<button class="btn small quiet" data-act="excuse" data-key="${t.key}">Excuse</button>` : ""}
          </div>
        </div>
      </div>`).join("") : `<p class="empty">No tasks scheduled today.</p>`}
    </div>`;
  }).join("");
}

function adminApprovals() {
  const st = S.state;
  if (!st.approvals.length && !st.redemptions.length) return `<p class="empty">Nothing waiting on you.</p>`;

  return `
    ${st.approvals.length ? `<h2 class="section-title">Chores to check off</h2>
      ${st.approvals.map(t => `<div class="card">
        <div class="spread">
          <div>
            <h3>${esc(t.title)}</h3>
            <div class="meta">${esc(t.childName)} · ${t.durationMin} min timer finished · ${t.points} pts</div>
          </div>
          <div class="row">
            <button class="btn small quiet" data-act="reject" data-key="${t.key}">Send back</button>
            <button class="btn small accent" data-act="approve" data-key="${t.key}">Check off</button>
          </div>
        </div>
      </div>`).join("")}` : ""}
    ${st.redemptions.length ? `<h2 class="section-title">Reward requests</h2>
      ${st.redemptions.map(r => `<div class="card">
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
      </div>`).join("")}` : ""}`;
}

function dayChips(days) {
  return `<div class="row" style="gap:7px;flex-wrap:wrap">
    ${DAYS.map((d, i) => `<button type="button" class="btn small ${days.includes(i) ? "accent on" : ""}"
      data-act="toggleDay" data-i="${i}" style="width:38px;padding:8px 0;text-align:center">${d}</button>`).join("")}
  </div>`;
}

function adminTasks() {
  const st = S.state;
  const f = formState("task", { id: "", childId: (st.children[0] || {}).id || "", title: "", type: "study", durationMin: 20, points: 10, days: [0, 1, 2, 3, 4, 5, 6] });

  return `
    <div class="card" style="margin-bottom:24px">
      <p class="eyebrow">${f.id ? "Edit task" : "New task"}</p>
      <div class="stack">
        <div><label class="lab" for="f-title">Name</label>
          <input class="field" id="f-title" value="${esc(f.title)}" placeholder="Reading, dishwasher, piano…"></div>
        <div class="grid2">
          <div><label class="lab" for="f-child">Child</label>
            <select class="field" id="f-child">
              ${st.children.map(c => `<option value="${c.id}" ${c.id === f.childId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
            </select></div>
          <div><label class="lab" for="f-type">Type</label>
            <select class="field" id="f-type">
              <option value="study" ${f.type === "study" ? "selected" : ""}>Study — timer completes it</option>
              <option value="chore" ${f.type === "chore" ? "selected" : ""}>Chore — parent checks off</option>
            </select></div>
        </div>
        <div class="grid2">
          <div><label class="lab" for="f-dur">Minutes</label>
            <input class="field" id="f-dur" type="number" min="1" max="240" value="${f.durationMin}"></div>
          <div><label class="lab" for="f-pts">Points</label>
            <input class="field" id="f-pts" type="number" min="0" max="500" value="${f.points}"></div>
        </div>
        <div><label class="lab">Days</label>${dayChips(f.days)}</div>
        <div class="row" style="justify-content:flex-end;margin-top:4px">
          ${f.id ? `<button class="btn quiet small" data-act="cancelForm">Cancel</button>` : ""}
          <button class="btn accent" data-act="saveTask">${f.id ? "Save changes" : "Add task"}</button>
        </div>
      </div>
    </div>
    ${st.children.map(c => {
      const list = st.allTasks.filter(t => t.childId === c.id);
      if (!list.length) return "";
      return `<h2 class="section-title">${esc(c.name)}</h2>
        ${list.map(t => `<div class="card flat">
          <div class="spread">
            <div>
              <h3>${esc(t.title)}</h3>
              <div class="meta">${t.type} · ${t.durationMin} min · ${t.points} pts · ${t.days.length === 7 ? "daily" : t.days.map(d => DAYS[d]).join("")}</div>
            </div>
            <div class="row">
              <button class="btn small quiet" data-act="editTask" data-id="${t.id}">Edit</button>
              <button class="btn small quiet" data-act="deleteTask" data-id="${t.id}">Remove</button>
            </div>
          </div>
        </div>`).join("")}`;
    }).join("")}`;
}

function adminRewards() {
  const st = S.state;
  const f = formState("reward", { id: "", title: "", cost: 25, childIds: [] });

  return `
    <div class="card" style="margin-bottom:24px">
      <p class="eyebrow">${f.id ? "Edit reward" : "New reward"}</p>
      <div class="stack">
        <div><label class="lab" for="r-title">Reward</label>
          <input class="field" id="r-title" value="${esc(f.title)}" placeholder="Movie night, later bedtime…"></div>
        <div><label class="lab" for="r-cost">Cost in points</label>
          <input class="field" id="r-cost" type="number" min="1" max="10000" value="${f.cost}"></div>
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
    ${st.rewards.map(r => `<div class="card flat">
      <div class="spread">
        <div>
          <h3>${esc(r.title)}</h3>
          <div class="meta">${r.cost} pts · ${r.childIds.length ? r.childIds.map(cid => (st.children.find(c => c.id === cid) || {}).name).join(", ") : "everyone"}</div>
        </div>
        <div class="row">
          <button class="btn small quiet" data-act="editReward" data-id="${r.id}">Edit</button>
          <button class="btn small quiet" data-act="deleteReward" data-id="${r.id}">Remove</button>
        </div>
      </div>
    </div>`).join("")}`;
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
    <div class="card" style="margin-bottom:24px">
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
    <div class="card flat" style="margin-bottom:24px">
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
    ${st.children.map(person).join("") || `<p class="empty">No children yet.</p>`}
    <h2 class="section-title">Parents and guardians</h2>
    ${st.admins.map(person).join("")}`;
}

/* ---------- render ---------- */

function isTyping() {
  const a = document.activeElement;
  return a && (a.tagName === "INPUT" || a.tagName === "SELECT");
}

// A re-render rebuilds the DOM, so pull anything half-typed back into state first.
function captureForm() {
  if (!S.form) return;
  if (S.form.kind === "task") readTaskForm(S.form);
  else if (S.form.kind === "reward") readRewardForm(S.form);
  else if (S.form.kind === "user") readUserForm(S.form);
}

function render() {
  captureForm();
  let html;
  if (S.view === "loading") html = `<p class="empty" style="padding-top:60px">Loading…</p>`;
  else if (S.view === "login") html = loginView();
  else if (S.view === "child") html = S.focus ? focusView() : childView();
  else html = adminView();

  root.innerHTML = html + (S.toast ? `<div class="toast">${esc(S.toast)}</div>` : "");
}

/* ---------- ticking ---------- */

function tick() {
  if (!S.state) return;
  const pool = S.state.tasks || (S.state.board || []).flatMap(b => b.tasks);
  let needsSync = false;

  for (const t of pool) {
    if (!t.running) continue;
    const total = t.durationMin * 60000;
    const left = total - liveElapsed(t);
    if (left <= 0) needsSync = true;

    const mini = document.querySelector(`.js-ring[data-id="${t.id}"] .js-mini`);
    if (mini) mini.textContent = clock(Math.max(0, left));
    const arcs = document.querySelectorAll(`.js-ring[data-id="${t.id}"] .js-arc`);
    arcs.forEach(a => {
      const c = parseFloat(a.getAttribute("stroke-dasharray"));
      a.setAttribute("stroke-dashoffset", (c * (1 - Math.min(1, liveElapsed(t) / total))).toFixed(1));
    });

    if (S.focus === t.id) {
      const out = el(".js-readout");
      if (out) out.textContent = clock(Math.max(0, left));
      const arc = document.querySelector(".dial .js-arc");
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
    if (silent && isTyping()) return;
    render();
  } catch (e) {
    if (String(e.message).includes("Sign in")) { S.view = "login"; S.state = null; render(); }
  }
}

setInterval(tick, 250);
setInterval(() => { if (S.state) refresh(true); }, 6000);

/* ---------- events ---------- */

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

      case "tab": S.tab = +node.dataset.i; S.form = null; return render();
      case "logout":
        await post("logout"); S.state = null; S.pick = null; S.view = "login";
        S.profiles = (await get("profiles")).profiles; return render();

      case "open": S.focus = node.dataset.id; {
        const t = taskById(S.focus);
        render();
        if (t && !t.running && t.status !== "done" && t.status !== "awaiting") {
          setState(await post("start", { taskId: t.id })); render();
        }
      } return;
      case "closeFocus": S.focus = null; return render();
      case "start": setState(await post("start", { taskId: node.dataset.id })); return render();
      case "pause": setState(await post("pause", { taskId: node.dataset.id })); return render();

      case "approve": setState(await post("approve", { key: node.dataset.key })); toast("Checked off"); return;
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

      case "toggleDay": {
        const f = formState("task", { days: [] });
        const i = +node.dataset.i;
        f.days = f.days.includes(i) ? f.days.filter(d => d !== i) : f.days.concat(i).sort();
        readTaskForm(f); return render();
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
        S.form = Object.assign({ kind: "task" }, t); return render();
      }
      case "saveTask": {
        const f = formState("task", { id: "", days: [0, 1, 2, 3, 4, 5, 6] });
        readTaskForm(f);
        setState(await post("saveTask", f));
        S.form = null; toast(f.id ? "Task updated" : "Task added"); return;
      }
      case "deleteTask":
        if (!confirm("Remove this task?")) return;
        setState(await post("deleteTask", { id: node.dataset.id })); return render();

      case "editReward": {
        const r = S.state.rewards.find(x => x.id === node.dataset.id);
        S.form = Object.assign({ kind: "reward" }, r); return render();
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
    f.type = val("f-type");
    f.durationMin = +val("f-dur");
    f.points = +val("f-pts");
  }
  if (!f.days || !f.days.length) f.days = [0, 1, 2, 3, 4, 5, 6];
}

function readRewardForm(f) {
  if (el("#r-title")) { f.title = val("r-title"); f.cost = +val("r-cost"); }
  if (!f.childIds) f.childIds = [];
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
