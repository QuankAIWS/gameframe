---
title: RPG Single-VM Deployment
status: implementation-ready
document_type: deployment_runbook
owner: Scribbles GameFrame
last_updated: 2026-08-04
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
depends_on:
  - rpg-gameframe-interface-contract.md
related:
  - ../deploy/systemd/scribbles-gameframe-rpg.service
  - ../deploy/systemd/scribbles-gameframe-rpg.env.example
---

# RPG Single-VM Deployment

## Purpose

Run the durable GameFrame RPG boundary and RPG GM Runtime as separate processes on one Linux VM with independent restart, storage, logs, and retirement behavior.

This is the initial deployment shape. Both services bind only to loopback:

- GameFrame RPG: `127.0.0.1:8790`;
- RPG GM Runtime private command ingress: `127.0.0.1:8791`.

GameFrame sends accepted player commands to the GM over loopback. The GM publishes narrative results and encounter requests back to GameFrame over loopback. Neither service requires a VPN or an open home-router port when deployed on a cloud VM.

## Security boundary

The current GameFrame process uses trusted development identity headers. It is **not an internet-safe authentication boundary**.

Until a production Discord/GameFrame identity authenticator is implemented:

- do not expose port `8790` through Cloudflare Tunnel;
- never expose port `8791` through Cloudflare Tunnel;
- do not bind either process to `0.0.0.0` or a public interface;
- allow access only from local processes on the VM;
- keep both environment files mode `0600`;
- use separate random values for the service bearer token and cursor HMAC secret.

A future public GameFrame gateway may use Cloudflare Tunnel without opening VM firewall ports, but it must authenticate users and provide verified principal claims before reaching this durable RPG boundary.

## Filesystem layout

```text
/opt/game-master/
  scribbles-gameframe/
  rpg-gm-runtime/

/etc/game-master/
  scribbles-gameframe-rpg.env
  rpg-gm-runtime.env

/var/lib/game-master/
  gameframe/
    gameframe.sqlite
  rpg-gm/
    openclaw/
    narrative-links.json
```

Use one unprivileged service account for the initial VM:

```bash
sudo useradd --system --create-home --home-dir /var/lib/game-master \
  --shell /usr/sbin/nologin game-master
sudo install -d -o game-master -g game-master -m 0750 \
  /opt/game-master \
  /var/lib/game-master/gameframe \
  /var/lib/game-master/rpg-gm/openclaw \
  /etc/game-master
```

The repository directories may be root-owned and read-only to the service account. Only `/var/lib/game-master/**` must be writable by `game-master`.

## Runtime prerequisites

Install a system-wide Node release supported by both repositories. Node `24.15.0` is the currently validated runtime target.

Verify:

```bash
/usr/bin/node --version
/usr/bin/npm --version
corepack --version
```

If Node is installed outside `/usr/bin`, update `ExecStart` in the unit files before installation.

## Repository installation

```bash
sudo git clone <GAMEFRAME_REPOSITORY_URL> /opt/game-master/scribbles-gameframe
sudo git clone <RPG_GM_RUNTIME_REPOSITORY_URL> /opt/game-master/rpg-gm-runtime

cd /opt/game-master/scribbles-gameframe
sudo npm ci

cd /opt/game-master/rpg-gm-runtime
PACKAGE_MANAGER="$(node -p "require('./package.json').packageManager")"
sudo corepack prepare "$PACKAGE_MANAGER" --activate
sudo pnpm install --frozen-lockfile --prefer-offline
```

Pin production deployments to reviewed commit SHAs. Do not deploy an arbitrary moving branch.

## Shared secrets

Generate two independent secrets:

```bash
SERVICE_TOKEN="$(openssl rand -base64 48 | tr -d '\n')"
CURSOR_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
printf '%s\n' "$SERVICE_TOKEN"
printf '%s\n' "$CURSOR_SECRET"
```

The service token must be identical in both environment files. The cursor secret belongs only to RPG GM Runtime.

## GameFrame environment

Copy:

```bash
sudo cp /opt/game-master/scribbles-gameframe/deploy/systemd/scribbles-gameframe-rpg.env.example \
  /etc/game-master/scribbles-gameframe-rpg.env
sudo chmod 0600 /etc/game-master/scribbles-gameframe-rpg.env
sudo chown root:root /etc/game-master/scribbles-gameframe-rpg.env
```

Set `RPG_GM_SERVICE_TOKEN` to the generated shared service token.

Required effective values:

```dotenv
GAMEFRAME_ALLOW_DEVELOPMENT_AUTH=1
GAMEFRAME_RPG_HOST=127.0.0.1
GAMEFRAME_RPG_PORT=8790
GAMEFRAME_RPG_DATABASE_PATH=/var/lib/game-master/gameframe/gameframe.sqlite
RPG_GM_BASE_URL=http://127.0.0.1:8791
RPG_GM_SERVICE_TOKEN=<shared-service-token>
```

## RPG GM Runtime environment

The runtime repository owns `deploy/systemd/rpg-gm-runtime.env.example` and `deploy/systemd/rpg-gm-runtime.service`.

Required effective values:

```dotenv
OPENCLAW_STATE_DIR=/var/lib/game-master/rpg-gm/openclaw
RPG_GM_HOST=127.0.0.1
RPG_GM_PORT=8791
GAMEFRAME_RPG_BASE_URL=http://127.0.0.1:8790
RPG_GM_SERVICE_TOKEN=<shared-service-token>
RPG_GM_CURSOR_SECRET=<cursor-secret>
RPG_GM_NARRATIVE_LINK_PATH=/var/lib/game-master/rpg-gm/narrative-links.json
```

## Unit installation

Install RPG GM Runtime first because GameFrame orders itself after that unit:

```bash
sudo cp /opt/game-master/rpg-gm-runtime/deploy/systemd/rpg-gm-runtime.service \
  /etc/systemd/system/rpg-gm-runtime.service
sudo cp /opt/game-master/rpg-gm-runtime/deploy/systemd/rpg-gm-runtime.env.example \
  /etc/game-master/rpg-gm-runtime.env

sudo cp /opt/game-master/scribbles-gameframe/deploy/systemd/scribbles-gameframe-rpg.service \
  /etc/systemd/system/scribbles-gameframe-rpg.service

sudo chmod 0644 \
  /etc/systemd/system/rpg-gm-runtime.service \
  /etc/systemd/system/scribbles-gameframe-rpg.service
sudo chmod 0600 \
  /etc/game-master/rpg-gm-runtime.env \
  /etc/game-master/scribbles-gameframe-rpg.env
sudo chown root:root \
  /etc/game-master/rpg-gm-runtime.env \
  /etc/game-master/scribbles-gameframe-rpg.env
```

Validate before enabling:

```bash
sudo systemd-analyze verify \
  /etc/systemd/system/rpg-gm-runtime.service \
  /etc/systemd/system/scribbles-gameframe-rpg.service
```

Start and enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rpg-gm-runtime.service
sudo systemctl enable --now scribbles-gameframe-rpg.service
```

## Health verification

```bash
curl --fail --silent http://127.0.0.1:8791/healthz | jq
curl --fail --silent http://127.0.0.1:8790/api/health | jq

sudo systemctl --no-pager --full status rpg-gm-runtime.service
sudo systemctl --no-pager --full status scribbles-gameframe-rpg.service
```

Expected properties:

- both listeners are bound to `127.0.0.1` only;
- GameFrame reports SQLite durable RPG capabilities;
- GM reports private GameFrame command ingress;
- no pending restart loop appears in either unit;
- the shared service token never appears in logs.

Inspect logs:

```bash
sudo journalctl -u rpg-gm-runtime.service -u scribbles-gameframe-rpg.service \
  --since '15 minutes ago' --no-pager
```

## Firewall and Cloudflare

No inbound firewall rule is needed for ports `8790` or `8791`. Confirm they are not public:

```bash
sudo ss -ltnp | grep -E ':(8790|8791)\b'
```

Both rows must show loopback addresses only.

Cloudflare Tunnel is deliberately deferred for this boundary. When the production identity adapter exists, expose only the public GameFrame gateway hostname. The GM ingress remains loopback-only permanently.

## Restart and ordering behavior

- RPG GM Runtime starts independently and may wait for GameFrame while idle.
- GameFrame starts after the GM unit.
- GameFrame retains accepted commands in SQLite if GM is unavailable.
- retryable deliveries remain pending for the next poll or process restart.
- exact retries do not create duplicate inbox, journal, narrative, presentation, or encounter state.
- SIGTERM closes ingress first and drains immediately safe work before process exit.

Manual restart:

```bash
sudo systemctl restart rpg-gm-runtime.service
sudo systemctl restart scribbles-gameframe-rpg.service
```

## Backup

The safest initial procedure is a coordinated stopped backup:

```bash
sudo systemctl stop scribbles-gameframe-rpg.service rpg-gm-runtime.service

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
sudo tar --numeric-owner --xattrs --acls -C /var/lib \
  -czf "/var/backups/game-master-${STAMP}.tar.gz" game-master

sudo systemctl start rpg-gm-runtime.service
sudo systemctl start scribbles-gameframe-rpg.service
```

The backup must contain all three authority surfaces together:

- GameFrame SQLite database;
- OpenClaw plugin-state directory;
- runtime narrative-link file.

Backing up only one repository's state can produce irreconcilable cross-service receipts.

## Restore

Restore both services to one coordinated snapshot:

```bash
sudo systemctl stop scribbles-gameframe-rpg.service rpg-gm-runtime.service
sudo mv /var/lib/game-master "/var/lib/game-master.pre-restore.$(date -u +%s)"
sudo tar --numeric-owner --xattrs --acls -C /var/lib \
  -xzf /var/backups/game-master-<STAMP>.tar.gz
sudo chown -R game-master:game-master /var/lib/game-master
sudo chmod 0750 \
  /var/lib/game-master \
  /var/lib/game-master/gameframe \
  /var/lib/game-master/rpg-gm \
  /var/lib/game-master/rpg-gm/openclaw

sudo systemctl start rpg-gm-runtime.service
sudo systemctl start scribbles-gameframe-rpg.service
```

Verify health, logs, campaign attachment, and a disposable command round trip before declaring the restore complete.

## Upgrade

For each repository:

1. select a reviewed green commit;
2. stop the affected service;
3. update the worktree to the pinned commit;
4. install the locked dependencies;
5. run the repository's focused RPG validation;
6. restart the service;
7. verify health and logs;
8. retain the previous commit and coordinated backup for rollback.

Do not upgrade both repositories to arbitrary latest heads without checking their protocol-v2 integration result.
