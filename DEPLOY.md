# Deploying JobCraft to the Raspberry Pi (home server)

This is how the app runs on the Pi for everyday use, and how to push updates as you
keep fixing bugs / adding features on your laptop.

## Topology

- **Laptop = source of truth.** You develop here, commit to git, and **build the frontend** here
  (the Pi has too little RAM to build).
- **Pi = runtime.** It serves the UI + API on one port over your WiFi. It keeps its **own** `.env`
  (your keys) and its **own** `backend/jobcraft.db` (the real data) — deploys never overwrite them.
- The AI runs in the cloud (OpenAI/Mistral); the Pi just makes API calls, so a Pi 3 is plenty.

Current setup: Pi at **192.168.0.69**, user **jishnu**, repo at **~/jobcraft**, port **8000**,
64-bit Raspberry Pi OS (aarch64).

## One-time Pi setup

```bash
# on the Pi
curl -LsSf https://astral.sh/uv/install.sh | sh    # install uv (Python toolchain)
source $HOME/.local/bin/env                        # put uv on PATH (or restart shell)
mkdir -p ~/jobcraft
```

Then deploy the code from the laptop (see **Deploy / update** below), and on the Pi:

```bash
cd ~/jobcraft
cp .env.example .env
nano .env                      # paste your real HR4U + OpenAI keys
( cd backend && uv sync )      # create backend/.venv (one time; needed by the service)
```

Quick test before installing the service:

```bash
PORT=8000 ./serve.sh --no-build
# open http://192.168.0.69:8000 from any device on the WiFi, then Ctrl-C
```

## Auto-start on boot (systemd)

```bash
sudo cp ~/jobcraft/deploy/jobcraft.service /etc/systemd/system/jobcraft.service
sudo systemctl daemon-reload
sudo systemctl enable --now jobcraft
```

Control / inspect:

```bash
systemctl status jobcraft
journalctl -u jobcraft -f        # live logs
sudo systemctl restart jobcraft  # after deploying an update
```

The service runs migrations then serves on `0.0.0.0:8000`, and **restarts on crash / on boot**.
(If your user/port/path differ, edit `deploy/jobcraft.service` first.)

## Deploy / update (run on the laptop)

Whenever you change code:

```bash
cd /home/jishnu/wsl-projects/work/labs/hr4u

# 1. (commit/push as usual for version history)
git add -A && git commit -m "…" && git push       # optional but recommended

# 2. build the frontend HERE (not on the Pi)
( cd frontend && npm run build )

# 3. sync to the Pi — excludes protect the Pi's keys, data, and venv
rsync -av --delete \
  --exclude='.git' --exclude='backend/.venv' --exclude='frontend/node_modules' \
  --exclude='.env' --exclude='backend/jobcraft.db' --exclude='jobcraft-backups' \
  ./ jishnu@192.168.0.69:~/jobcraft/

# 4. restart the service on the Pi
ssh jishnu@192.168.0.69 'sudo systemctl restart jobcraft'
```

Notes:
- `--exclude='.env'` and `--exclude='backend/jobcraft.db'` are critical: redeploys never touch
  the Pi's keys or her data.
- If you added/changed Python dependencies, also run on the Pi once: `cd ~/jobcraft/backend && uv sync`.
- If you added a DB migration, the service applies it automatically on restart (ExecStartPre).

## Backups

The data is one SQLite file (`backend/jobcraft.db`). Snapshot it:

```bash
# on the Pi
~/jobcraft/backup.sh                       # -> ~/jobcraft-backups/jobcraft-<timestamp>.db (keeps 14)
```

Automate daily at 3am:

```bash
crontab -e
# add:
0 3 * * *  /home/jishnu/jobcraft/backup.sh >> /home/jishnu/jobcraft-backups/backup.log 2>&1
```

Local backups protect against app bugs, a bad migration, or accidental deletion. They do **not**
protect against the SD card dying — for that, occasionally copy a backup off the Pi, e.g. from the
laptop: `rsync -av jishnu@192.168.0.69:~/jobcraft-backups/ ~/jobcraft-pi-backups/`
(or set `BACKUP_DIR=/mnt/usb` when running backup.sh to write to a USB stick).

## Ports & AdGuard

AdGuard Home uses 53 (DNS) and an admin port (often 80 or 3000). JobCraft uses **8000**; it was
free. If it ever clashes, pick another and keep them consistent:
`PORT=8080 ./serve.sh --no-build` and change `--port` in `deploy/jobcraft.service`.

## Troubleshooting

- **Can't reach it from another device:** confirm same WiFi; `systemctl status jobcraft` is active;
  `ss -tlnp | grep :8000` shows it listening on `0.0.0.0`.
- **LLM features error:** the Pi's `.env` still has placeholder keys — edit it and restart.
- **Reset the demo/seed:** `cd ~/jobcraft/backend && uv run python -m app.seed`.
