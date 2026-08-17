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

Parents create rewards with a point cost, either for everyone or for specific children. A child redeems one, points come out immediately, and the request goes to the parent queue. Marking it **Given** completes it; **Refund** returns the points to the buckets they came from — though allowance refunded after the week has turned comes back as savings, since that week's allowance no longer exists.

The ±5 buttons in the Family tab adjust **savings**, not allowance, so a manual reward or penalty behaves like earned points.

## Day handling

Tasks are recurring and scheduled by weekday. Progress is stored per calendar day, so everything resets at local midnight and past days stay in `data.json` as a record.

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

**Or deploy it as a Git stack.** Push this folder to a repository and point Dockhand at it. The checkout gives it the build context, so `compose.yaml` works as-is and webhooks can redeploy on push.

**Or push to a registry** if you have one, which also lets other hosts pull it:

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
Dockerfile               image definition
compose.yaml             build and run locally
compose.dockhand.yaml    image-only stack for Dockhand's editor
.env.example             host port and timezone
server.js        API, auth, timer arbitration, JSON persistence
public/index.html
public/app.js    all views: login, child board, focus timer, admin
public/styles.css
data.json        created on first run
```
