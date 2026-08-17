# Hearth study-app integration

A contract for connecting an external activity app (the math app, and whatever it grows into) to a Hearth study task. Hearth owns the schedule, the timer, and the points. The activity app owns the activity and reports what happened.

Nothing here is built yet. This is the shape to build against.

## Working out what you have

Before choosing a path, determine whether the math app has a server of its own.

- Look at the project root. A `package.json` listing `express`, `fastify`, `koa`, or similar, or a `server.js` / `app.py` / `main.go`, means there's a backend. Only `index.html`, `.js`, and `.css` means there isn't.
- Open it in a browser, play a session, then open it in a different browser or a private window. If the scores are still there, something is persisting them server-side. If they've vanished, it's `localStorage` and the app is frontend-only.
- Open devtools → Network, play a round, and watch for `fetch`/XHR calls to anything other than static files. Requests to an API mean a backend.

## The two paths

**If it has a backend** — the server reports results to Hearth. The child's browser never holds anything that could be forged. This is the one to want.

**If it's frontend-only** — the browser reports results instead. It works, and the session token limits the damage, but a child who opens the console can submit whatever numbers they like. Adding a minimal backend later closes that hole without changing the contract below.

Either way Hearth stays authoritative about *whether the block counts*: the timer still has to run its course. Results enrich the record; they don't replace the rule.

## Flow

```
child taps Start on a "Math" study task
        │
        ├─ Hearth starts its own timer as usual
        │
        └─ Hearth redirects to:
             https://math.your-domain/?session=<TOKEN>&return=https://hearth.your-domain/
                    │
                    │  child works
                    │
                    └─ POST https://hearth.your-domain/api/session/result
                         X-Hearth-Token: <TOKEN>
                         { problems, correct, streak, topics, durationMs }
                                │
                                └─ Hearth verifies, stores against today's log,
                                   shows the results on the task card
```

## The token

Hearth mints one per launch. It is opaque to the activity app — pass it back untouched.

```
<base64url(payload)>.<base64url(HMAC-SHA256(payload, HEARTH_SHARED_SECRET))>
```

The payload decodes to:

```json
{
  "childId": "u_9f2c...",
  "childName": "Ari",
  "taskId": "t_44ab...",
  "taskTitle": "Math",
  "date": "2026-08-17",
  "exp": 1755500000
}
```

Properties that matter:

- **Short-lived.** Expires when the study block's duration elapses, plus a grace period.
- **Single-use.** Hearth rejects a second result for the same token.
- **Scoped.** It authorises reporting a result for one child, one task, one day. It is not a login and grants no other access.

If the activity app has a backend, it should verify the signature itself using the same shared secret before trusting `childId` — otherwise anyone could hand it a made-up payload.

## Identity

Hearth children and math-app profiles are different things. Key the activity app's records on `childId` from the token, not on the display name — names collide, get edited, and a child picking "Ari" from a list is not proof of anything.

On first launch with an unfamiliar `childId`, create a profile silently using `childName` as the label. The child should never see a profile picker when they arrive from Hearth; they came in already identified.

## Result payload

```json
{
  "problems": 24,
  "correct": 21,
  "streak": 6,
  "durationMs": 1140000,
  "topics": [
    { "name": "Multiplication", "correct": 12, "total": 13 },
    { "name": "Fractions", "correct": 9, "total": 11 }
  ]
}
```

`problems` and `correct` are the only required fields. `topics` is an open list — Hearth renders whatever it receives, so a future spelling or geography module needs no change on the Hearth side. Keep topic names short; they become chart labels.

Accuracy is derived, not sent. One source of truth.

## Hosting notes

Different port or proxy name means a different origin. Two consequences:

- Server-to-server reporting needs no CORS at all. Another argument for the backend path.
- Browser reporting needs Hearth to send `Access-Control-Allow-Origin` for the math app's origin specifically — not `*`, since the request carries a token.

Both apps behind the same reverse proxy on the same NAS keeps traffic internal and lets both sit behind one TLS certificate.

## Secret handling

`HEARTH_SHARED_SECRET` is an environment variable on both containers. Never in a repo, never in the compose file committed to git — set it in Dockhand's stack environment variables the way `TZ` is set.

Generate one with:

```bash
openssl rand -hex 32
```

Rotating it invalidates in-flight sessions and nothing else.

## What gets built on the Hearth side

- An optional launch URL per study task, set in the admin Tasks form.
- Token minting on start, and a `/api/session/result` endpoint that verifies and stores.
- Result fields on the daily log, and the display treatment on the task card.

None of it changes existing behaviour for tasks without a launch URL.
