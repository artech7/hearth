# Hearth

A self-hosted daily board for studying and chores. Each child gets their own space, any number of parents or guardians can administer it, and nothing gets marked done without a timer actually running.

No dependencies, no build step, no database. One `node server.js` and a JSON file.

## Run it

Two builds are included. They are the same app.

**`hearth.js` — single file.** The frontend is embedded, so there is nothing to misplace:

```bash
node hearth.js
```

**`server.js` + `public/`** — the same thing with the frontend as editable files. Use this one if you want to change the CSS or markup. It needs this exact layout, and the files need their extensions:

```
server.js
public/index.html
public/app.js
public/styles.css
```

If a page returns "not found", that folder is the reason — the server says so at startup.

```bash
node server.js          # http://localhost:8080
PORT=3000 node server.js
DATA_FILE=/srv/hearth/data.json node server.js
```

Node 18 or newer. On first run it writes `data.json` with a demo family so you can test immediately:

| Who | Role | PIN |
| --- | --- | --- |
| Parent | admin | 1234 |
| Ari | child | 1111 |
| Nova | child | 2222 |

**Change these before real use** — Family tab → Edit → new PIN. Or delete `data.json` and it reseeds.

For other devices on your network, open `http://<your-machine-ip>:8080`. It's a normal responsive web page, so phones and tablets can just bookmark it.

## The rules it enforces

These are enforced on the server, not in the browser, so they hold even if a child reloads the page, closes the tab, or opens the console.

- **Nothing is checked off by hand.** There is no "mark done" endpoint for children. A task only advances by running its timer.
- **Study tasks complete themselves.** When the full duration has elapsed, the task flips to done and the points land automatically.
- **Pause is the only escape.** Pausing banks the time already served; resuming continues from there. There's no skip and no early finish.
- **Chores wait for a parent.** When a chore's timer runs out it moves to the parent's queue. Points are awarded on approval. A parent can also send it back, which resets the timer to zero.
- **Elapsed time is measured against the server clock.** Changing the device clock does nothing.

Parents get one deliberate override: **Excuse**, which closes out a task without awarding points — for the day someone is sick or away.

Tasks repeat by weekday, or can be **one-off**: pick a date and it appears that day only. Useful for "help unload the car" without leaving a permanent task behind.

Parents also get **Undo** on anything already checked off, which takes the points back and returns a chore to the queue.

When a study timer runs out the device plays a short chime and vibrates, so a phone face-down on the table still tells the child they're done.

## Points: allowance and savings

Every child has two balances, and the difference is the whole point.

**Allowance** is a weekly grant, 500 by default. It renews every Monday. Whatever is left on renewal day is **gone** — it never accumulates. This is spending money, not a score.

**Savings** are the points earned by finishing study blocks and chores. They roll over indefinitely and are only ever spent once allowance runs out.

Spending always draws from allowance first. A child who does no work still has 500 a week to spend; a child who works builds a balance on top that survives the reset, which is what makes saving for something expensive possible.

```
Monday:   500 allowance + 40 saved   = 540 to spend
spend 20:  480 allowance + 40 saved   = 520      (savings untouched)
earn 10:   480 allowance + 50 saved   = 530
Monday:    500 allowance + 50 saved   = 550      (the unspent 480 is gone)
```

A reward costing more than the allowance takes the remainder out of savings — 320 spent against 300 allowance and 50 saved leaves 0 and 30.

Set each child's weekly amount in the Family tab. Lowering it applies immediately; raising it takes effect at the next renewal. The renewal day (Sunday or Monday) is one setting for the whole household, also in the Family tab.

## Rewards

Each reward card carries an **icon** — a film reel for movie night, a gamepad for game time, cutlery for picking a meal. Twenty-four are built in, drawn as part of the app rather than pulled from a CDN so nothing breaks offline. Leave it on Auto and the icon is matched from the reward's name; override it from the picker in the Rewards form when the guess is wrong.

Parents create rewards with a point cost, either for everyone or for specific children. A child redeems one, points come out immediately, and the request goes to the parent queue. Marking it **Given** completes it; **Refund** returns the points to the buckets they came from — though allowance refunded after the week has turned comes back as savings, since that week's allowance no longer exists.

The ±5 buttons in the Family tab adjust **savings**, not allowance, so a manual reward or penalty behaves like earned points.

## Day handling

Tasks are recurring and scheduled by weekday. Progress is stored per calendar day, so everything resets at local midnight and past days stay in `data.json` as a record.

## If a parent forgets their PIN

PINs are stored as hashes, so there's nothing to look up — only to replace, from the machine running the container.

```bash
sudo docker exec hearth node server.js --list-users
sudo docker exec hearth node server.js --reset-pin Parent 4821
```

Names work if they're unique; otherwise pass the id shown by `--list-users`. Resetting signs that account out everywhere, so an old session can't linger.

Since this needs shell access to the Docker host, it's a real recovery route without being a back door.

## Signing in

The PIN pad locks an account after five wrong attempts, for a minute, doubling if someone keeps going. Other accounts are unaffected — one child guessing at a parent's PIN can't lock everyone else out. Locks live in memory and clear on restart.

## History and streaks

Every completed task is recorded per day, so the app remembers. Children see a seven-day strip on their Today tab and a running streak; parents see each child's streak on the board, and can pull up to 90 days per child.

A streak counts back from today over days where everything scheduled got done. Two deliberate choices: a day with nothing scheduled is skipped rather than treated as a failure, so a rest day doesn't cost a child their momentum; and today only counts once it's actually finished, so nobody watches their streak break at breakfast.

Day records are rebuilt from the logs rather than stored, so editing or deleting a task doesn't corrupt the past.


## The planner

The **Plan** tab is a month calendar. Each day shows a bar for how much of that day's work got done and a dot per scheduled event. Picking a day opens a panel underneath with everything on it.

**Scheduling across days.** Hit **Select days** in the planner to pick a span: set a from/to range, or use the Weekdays and Weekends shortcuts, then tap individual days to add or drop them. The selection shows as chips you can dismiss one at a time. Adding an item then applies it to every selected day.

Each day gets its own entry, so a child can tick off Tuesday without touching Thursday, and editing one day changes only that day. Entries created together stay linked: an item on more than one day shows "1 of 6 days" and offers **Remove all** next to the single-day remove.

**Events** are anything that isn't a task: appointments, visits, matches. They carry a name, a date, an optional time and note, and either apply to everyone or to specific children. Children see their own on their Today tab under "What's on" and can tick them off; only a parent can create, edit, or remove them.

**Marking past work done.** From that day panel, any task that wasn't completed shows a **Mark done** button, which awards the full points and counts toward history and streaks — for when someone did the job and nobody remembered to check it off. It works on today and any past day, never a future one, and refuses a task that wasn't scheduled that day or belongs to another child. Undo reverses it.


## Backups

A snapshot of `data.json` is written to a `backups/` folder beside it — once at startup if the last one is stale, then daily, keeping the most recent 14. `BACKUP_DIR` and `KEEP_BACKUPS` change either.

From **Settings** — the gear in the parent header — a parent can **Download** the current data as a file, take a **Snapshot now**, and see which snapshots exist. Downloading is the one that matters: a backup living in the same volume as the data doesn't survive losing the volume.

```bash
sudo docker exec hearth node server.js --list-backups
sudo docker exec hearth node server.js --backup
sudo docker exec hearth node server.js --restore latest
sudo docker exec hearth node server.js --restore hearth-2026-08-30-030000.json
```

A restore validates the file before touching anything and copies the current data aside first as `hearth-prerestore-*`, kept out of the rotation so it can't be pruned away. Restart the container afterwards to pick up the restored file.

## The points log

Every movement of points is recorded: work finished, chores approved, retroactive completions, parent adjustments, undos, redemptions, refunds, the weekly allowance grant, and allowance that expired unspent. Each entry keeps the amount, which bucket it touched, the reason, who did it, and the balance afterwards.

Children see **Where your points went** on their Rewards tab. Parents get a **Points log** button per child in the Family tab.

Household settings — backups, the week start day, and the recovery commands — live under the gear in the parent header, away from the day-to-day screens.

The point is answerable questions. When a child says they had more points yesterday, the log says what happened and who did it — which matters in a system whose job is being fair between siblings.

Balances that predate the log get an opening entry, so the entries always sum to the current total.


## Data and backups

Existing `data.json` files upgrade automatically on first launch: the old single `points` number becomes savings, and everyone picks up a full allowance.

Everything lives in one `data.json`. Back it up by copying it. PINs are stored as PBKDF2-SHA256 hashes with per-user salts, never in plain text. Sessions survive a restart, so a reboot doesn't make everyone sign in again.

Writes are debounced and flushed on `SIGINT`/`SIGTERM`, so stop it with Ctrl-C or `systemctl stop` rather than `kill -9`.

## Docker

```bash
docker compose up -d          # http://localhost:8080
```

That builds the image, creates a `hearth-data` volume for `data.json`, and starts on port 8080. Copy `.env.example` to `.env` to change the host port or timezone.

**Set `TZ` to your own timezone.** It is not cosmetic. Daily task resets and weekly allowance renewal both follow the container's local clock, and a container left on UTC will roll the day over at 6pm Denver time. The compose file defaults to `America/Denver`.

The container runs as a non-root user with a read-only root filesystem, no added capabilities, and `no-new-privileges`. The only writable path is `/data`.

### Deploying into Dockhand

Dockhand keeps a pasted "internal" stack's YAML in its own database, so there is no source tree on the Docker host for `build:` to use. Pick one of these:

**Build the image once on the Docker host, then paste the stack.** This is the simplest path.

```bash
# on the Docker host, in this folder
docker build -t hearth:latest .
```

Then create a stack in Dockhand and paste the contents of `compose.dockhand.yaml`, which references `hearth:latest` and never tries to build. Set `TZ` and `HEARTH_PORT` in Dockhand's stack environment variables. Rebuild and redeploy the stack whenever you change the source.

**Or deploy it as a Git stack.** Push this folder to a repository and point Dockhand at it. The checkout gives it the build context, so `compose.yaml` works as-is and webhooks can redeploy on push. See below.

### Deploying as a Git stack

Dockhand checks the repository out onto its own filesystem and deploys from there, which is what gives `build:` the source it needs.

**1. Put this folder in a repository.** Any Git host works — GitHub, Gitea, Forgejo. A private repo is the right call: the compose file names your timezone and port, and the repo is deploy-time input to your home network.

```bash
cd hearth
git init
git add .
git commit -m "Hearth"
git branch -M main
git remote add origin https://github.com/YOUR-USER/hearth.git
git push -u origin main
```

The included `.gitignore` keeps `data.json` and `.env` out. Check that `git status` shows no `data.json` before your first push — that file is your family's actual data, PIN hashes included.

**2. Give Dockhand credentials** if the repo is private: Settings → Git. A personal access token with read access to that one repo is enough. HTTPS repository URLs work; you don't need to set up SSH keys.

**3. Create the stack.** Stacks → Create → deploy from Git. You'll need:

| Field | Value |
| --- | --- |
| Repository URL | `https://github.com/YOUR-USER/hearth.git` |
| Branch | `main` |
| Compose path | `compose.yaml` |

Add `TZ` and `HEARTH_PORT` as stack environment variables in Dockhand's UI rather than committing a `.env` — Dockhand manages stack variables itself and encrypts them.

**4. Deploy.** The first run builds the image, which takes a minute; after that it's cached.

**5. Optionally wire up the webhook** so a push redeploys automatically. Copy the stack's webhook URL from its settings, then in GitHub go to Settings → Webhooks → Add webhook, paste the URL, set the content type to `application/json`, and set a secret — Dockhand verifies the signature and refuses webhooks without a configured secret. It compares each commit against the stack's compose directory, so a README-only push is skipped rather than triggering a pointless redeploy.

If you'd rather poll than push, Dockhand can also sync on a cron schedule.

**Why `pull_policy: build` is in `compose.yaml`:** without it, compose sees an existing `hearth:latest` and starts that, so a redeploy after a source change would quietly run the old code. `build` forces a rebuild every time; layer caching keeps it quick when nothing changed.

**Or let GitHub build it for you.** This is the most reliable option on a NAS, where building through a Docker UI tends to fail on build-context and BuildKit temp-mount issues. `.github/workflows/build-image.yml` builds on every push to `main` and publishes to GHCR for both amd64 and arm64.

After the first successful run, open the package on GitHub (your profile → Packages → hearth → Package settings) and set its visibility to **public**, or the Docker host will need registry credentials to pull it. Then deploy `compose.ghcr.yaml` as an internal stack in Dockhand — it references `ghcr.io/OWNER/hearth:latest` and never builds anything. To upgrade later, push to `main`, wait for the action, then redeploy the stack with re-pull enabled.

**Or push to a registry by hand** if you have one:

```bash
docker build -t ghcr.io/YOUR-USER/hearth:latest .
docker push ghcr.io/YOUR-USER/hearth:latest
```

Then change `image:` in `compose.dockhand.yaml` to that tag.

### Data and upgrades

`data.json` lives in the `hearth-data` volume, not the image, so rebuilds don't touch it.

```bash
docker compose cp hearth:/data/data.json ./backup-data.json   # back up
docker compose down && docker compose up -d --build           # upgrade
```

To use a host folder instead of a named volume, swap the volume line for a bind mount and make sure the directory is writable by uid 1000 (the `node` user in the image):

```yaml
    volumes:
      - /srv/hearth:/data
```

```bash
sudo mkdir -p /srv/hearth && sudo chown 1000:1000 /srv/hearth
```

Stop it with `docker compose stop` rather than killing it — the container gets 15 seconds to flush pending writes.

## Running it as a service

```ini
# /etc/systemd/system/hearth.service
[Unit]
Description=Hearth
After=network.target

[Service]
WorkingDirectory=/srv/hearth
ExecStart=/usr/bin/node /srv/hearth/server.js
Environment=PORT=8080
Restart=on-failure
User=hearth

[Install]
WantedBy=multi-user.target
```

## Worth knowing

PINs over plain HTTP are fine on a home LAN and not fine on the open internet. If you expose this beyond your own network, put it behind a reverse proxy with TLS and consider longer PINs — the server accepts any secret of 4+ characters, digits are just what the on-screen keypad offers.

## Files

```
.github/workflows/       builds and publishes the image on push
.gitignore               keeps data.json and .env out of the repo
Dockerfile               image definition
compose.yaml             build and run locally
compose.dockhand.yaml    image-only stack for Dockhand's editor
compose.ghcr.yaml        pulls the prebuilt image from GHCR
.env.example             host port and timezone
server.js        API, auth, timer arbitration, JSON persistence
public/index.html
public/app.js    all views: login, child board, focus timer, admin
public/styles.css
data.json        created on first run
```
