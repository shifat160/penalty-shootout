# ⚽ xCloud Penalty Shootout — WordCamp Rajshahi booth game

A self-hosted, World-Cup-themed penalty shootout mini-game for your booth.
Players register with **name, email, and the country they want to play as**,
then take **5 penalties** in a floodlit-stadium scene: pick a corner, time the
**power meter**, and beat a diving keeper. The penalty taker wears the chosen
nation's **kit**, and everyone lands on a **shared live leaderboard** (with
flags). Perfect for a "beat the high score, win a prize" booth competition —
and you can **export captured leads (name/email/country) as CSV**.

- First-person stadium scene (crowd, floodlights, goal, diving keeper, shooter)
- 40+ national kits selected at registration; jersey colours applied to the taker
- Pure **HTML/CSS/JS** front end (no build step, works great on phones + a big TV)
- Tiny **Node.js** backend (no dependencies) for a persistent shared leaderboard
- **One-command Docker deploy** on any VPS — including one you host on xCloud
- Leaderboard data persists across restarts via a mounted volume

---

## Quick start (Docker Compose — recommended)

On your VPS:

```bash
# 1. copy this folder onto the server, then:
cd penalty-shootout
docker compose up -d --build
```

Open `http://YOUR_SERVER_IP:8080` — done.

The leaderboard is stored in `./data/scores.json` on the host, so it survives
rebuilds and restarts.

## Quick start (plain Docker)

```bash
docker build -t penalty-shootout .
docker run -d --name penalty-shootout \
  -p 8080:8080 \
  -v "$(pwd)/data:/app/data" \
  --restart unless-stopped \
  penalty-shootout
```

## Deploy on xCloud (Custom Docker feature)

xCloud's Custom Docker flow deploys from a `docker-compose.yml` you paste in (or
host at a public URL) and auto-detects the exposed port. That flow does **not**
build from local source, so don't use the `build: .` compose here — push a
prebuilt image and use `docker-compose.xcloud.yml` instead.

**1. Build and push the image** (from this folder):

```bash
docker build -t YOUR_DOCKERHUB_USER/penalty-shootout:1.0 .
docker push YOUR_DOCKERHUB_USER/penalty-shootout:1.0
```

**2. Create the server:** xCloud dashboard → Add New Server → select the
**Docker + NGINX** stack (required for Custom Docker) → wait for provisioning.

**3. Create the site:** New Site → choose that server → **Custom Docker** tab →
**Docker Compose**.

**4. Domain:** pick **Demo Site** for a free xCloud test domain (great for a
booth) or **Go Live** with your own domain.

**5. Compose source:** choose **Paste content**, paste
`docker-compose.xcloud.yml`, and edit `YOUR_DOCKERHUB_USER` + `ADMIN_TOKEN`.
Only port 8080 is exposed, so deployment starts without asking you to pick one.

**6. Visit Site** once deployment finishes.

> Leaderboard persistence: the xCloud compose uses a **named Docker volume**
> (`penalty_data`), which Docker manages and keeps across restarts and
> redeploys — more reliable here than a relative host path.

To clear the board between days, set `ADMIN_TOKEN` in the compose, then:

```bash
curl -X POST "https://YOUR_DOMAIN/api/reset?token=your-secret"
```

---

## Run without Docker (local test)

```bash
node server.js
# http://localhost:8080
```

Requires Node 18+. No `npm install` needed — it uses only the standard library.

---

## Booth setup tips

- **Two-screen setup:** open the game on a tablet/phone for players to tap, and
  open `http://YOUR_SERVER_IP:8080` on a laptop/TV showing the end screen so the
  crowd sees the leaderboard. (Both hit the same backend.)
- **Offline-friendly:** runs entirely on your VPS/LAN. If your booth Wi-Fi can
  reach the server, you don't need internet.
- **Prizes:** the result screen tells players to show staff their score to claim
  a prize. Adjust that copy in `public/index.html` (search for "claim a prize").

## Clearing the leaderboard between days/sessions

Set an admin token, then call the reset endpoint:

1. In `docker-compose.yml`, uncomment and set `ADMIN_TOKEN=your-secret`.
2. `docker compose up -d` to apply.
3. Reset with:
   ```bash
   curl -X POST "http://YOUR_SERVER_IP:8080/api/reset?token=your-secret"
   ```

Or just stop the container and delete `data/scores.json`.

---

## How scoring works

- Each player takes 5 shots; a goal = 1 point (max 5).
- The leaderboard keeps each **player's best score**, keyed by **email** when
  present (so retries don't create duplicate rows), sorted highest first, ties
  broken by who reached it first.
- Each shot has two steps: **aim** (tap a zone in the goal) then **power** (tap
  SHOOT while the meter is in the green band). Too little power = easy save; too
  much on the top corners = over the bar.
- The keeper dives to a (slightly centre-biased) random zone; a match is a save,
  with a small fingertip-save chance on adjacent zones. Perfect-power corners can
  still beat the keeper — enough randomness to keep a queue trying for 5/5.

## Customising

- **Branding / colours:** edit the `:root` CSS variables and the `.brand` block
  at the top of `public/index.html`.
- **Nations / kits:** edit the `COUNTRIES` array in `public/index.html` —
  `[name, flag, shirt, trim, shorts, socks, striped]`. Default selection is
  Bangladesh.
- **Number of shots:** change `TOTAL_SHOTS` in `public/index.html`.
- **Difficulty:** in `public/index.html`, the `judge()` function controls
  goal/save/miss logic — tweak the power bands and save chances there.

## Files

```
.
├── Dockerfile
├── docker-compose.yml
├── server.js            # Node backend: static serving + leaderboard API
└── public/
    └── index.html       # the entire game (UI + logic)
```

## API (for reference)

- `GET  /api/leaderboard` → `{ "top": [ { "name", "country", "flag", "score" }, ... ] }`
- `POST /api/score` body `{ "name", "email", "country", "flag", "score": 0-5 }` → saves + returns board
- `POST /api/reset?token=...` → clears board (only if `ADMIN_TOKEN` is set)
- `GET  /api/export?token=...` → downloads all entries as CSV
  (`name,email,country,score,timestamp`) for lead capture (needs `ADMIN_TOKEN`)
