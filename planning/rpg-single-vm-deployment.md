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
  - rpg-signed-edge-authentication.md
related:
  - ../deploy/systemd/scribbles-gameframe-rpg.service
  - ../deploy/systemd/scribbles-gameframe-rpg.env.example
---

# RPG Single-VM Deployment

## Purpose

Run the durable GameFrame RPG boundary and RPG GM Runtime as separate loopback services on one Linux VM while the existing Cloudflare Worker remains the authenticated public GameFrame application.

The deployed request path is:

```text
browser or Discord Activity
→ Scribbles GameFrame Cloudflare Worker
→ Discord OAuth signed session
→ exact-body gameframe-hmac-v1 request
→ dedicated Cloudflare Tunnel origin hostname
→ cloudflared on the VM
→ GameFrame RPG at 127.0.0.1:8790
→ RPG GM Runtime at 127.0.0.1:8791 when required
```

The Worker serves the existing static application and game APIs. It exposes only these durable RPG player routes:

- `POST /api/rpg/campaigns/:campaignId/attach`;
- `POST /api/rpg/campaigns/:campaignId/commands`.

Runtime event publication and encounter authority routes are not public Worker routes.

## Authority and security boundary

- The Cloudflare Worker authenticates the player through the existing Discord OAuth session.
- The Worker discards all browser-supplied `Authorization` and `x-gameframe-*` identity headers.
- The Worker signs the exact forwarded body, method, path, query, player identity, timestamp, nonce, display name, and avatar URL.
- GameFrame verifies the HMAC, timestamp window, exact body digest, and nonce replay cache before parsing a command.
- GameFrame and RPG GM Runtime authenticate their loopback calls with the shared service bearer token.
- RPG GM Runtime is never reachable through the Worker or Tunnel.
- Both VM services remain bound to loopback. No inbound VM firewall or home-router port is required.

The Tunnel origin hostname is an authenticated transport target, not a browser API. Direct requests without a valid Worker-generated HMAC fail closed.

## Filesystem layout

```text
/opt/game-master/
  scribbles-gameframe/
  rpg-gm-runtime/

/etc/game-master/
  scribbles-gameframe-rpg.env
  rpg-gm-runtime.env
  cloudflared/
    config.yml

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

Repository directories may be root-owned and read-only to the service account. Only `/var/lib/game-master/**` must be writable by `game-master`.

## Runtime prerequisites

Install a system-wide Node release supported by both repositories. Node `24.15.0` is the currently validated runtime target.

```bash
/usr/bin/node --version
/usr/bin/npm --version
corepack --version
cloudflared --version
```

Pin production deployments to reviewed commit SHAs. Do not deploy arbitrary moving branches.

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

## Secrets

Generate three independent secrets:

```bash
SERVICE_TOKEN="$(openssl rand -base64 48 | tr -d '\n')"
PROXY_HMAC_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
CURSOR_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
```

Custody:

- `SERVICE_TOKEN`: GameFrame VM service and RPG GM Runtime;
- `PROXY_HMAC_SECRET`: Cloudflare Worker and GameFrame VM service;
- `CURSOR_SECRET`: RPG GM Runtime only;
- `SESSION_SECRET`: Cloudflare Worker only;
- Discord client secret: Cloudflare Worker only.

Do not reuse one value for multiple roles.

## GameFrame VM environment

Copy the template:

```bash
sudo cp /opt/game-master/scribbles-gameframe/deploy/systemd/scribbles-gameframe-rpg.env.example \
  /etc/game-master/scribbles-gameframe-rpg.env
sudo chmod 0600 /etc/game-master/scribbles-gameframe-rpg.env
sudo chown root:root /etc/game-master/scribbles-gameframe-rpg.env
```

Required effective values:

```dotenv
GAMEFRAME_RPG_AUTH_MODE=hmac-proxy
GAMEFRAME_RPG_HOST=127.0.0.1
GAMEFRAME_RPG_PORT=8790
GAMEFRAME_RPG_DATABASE_PATH=/var/lib/game-master/gameframe/gameframe.sqlite
GAMEFRAME_RPG_PROXY_HMAC_SECRET=<proxy-hmac-secret>
GAMEFRAME_RPG_PROXY_MAX_CLOCK_SKEW_MS=60000
GAMEFRAME_RPG_PROXY_MAX_REPLAY_ENTRIES=10000
RPG_GM_BASE_URL=http://127.0.0.1:8791
RPG_GM_SERVICE_TOKEN=<shared-service-token>
```

`development-header` mode remains available for local development only. Never map a Tunnel hostname to a service using development-header mode.

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

## Cloudflare Worker secrets

Configure the existing `scribbles-gameframe` Worker:

```bash
cd /opt/game-master/scribbles-gameframe
printf '%s' "$PROXY_HMAC_SECRET" | npx wrangler secret put GAMEFRAME_RPG_PROXY_HMAC_SECRET
printf '%s' 'https://rpg-origin.example.com/' | npx wrangler secret put GAMEFRAME_RPG_ORIGIN_URL
```

The Worker also requires its existing secrets:

- `SESSION_SECRET`;
- `DISCORD_CLIENT_ID`;
- `DISCORD_CLIENT_SECRET`;
- `DISCORD_ALLOWED_USER_IDS`.

`GAMEFRAME_RPG_ORIGIN_URL` must be a distinct HTTPS origin root. It must not equal the public Worker origin, or the Worker would recurse into itself.

Deploy only after focused and canonical validation:

```bash
npm run test:workerd
npx wrangler deploy
```

Verify the Worker boundary:

```bash
curl --fail --silent https://<PUBLIC_GAMEFRAME_HOST>/api/rpg/edge/health | jq
```

The response should report `configured: true`.

## Cloudflare Tunnel origin

Create one dedicated origin hostname, for example `rpg-origin.example.com`. Configure its origin hostname to `http://127.0.0.1:8790` on the VM.

A locally managed ingress example is:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json
ingress:
  - hostname: rpg-origin.example.com
    service: http://127.0.0.1:8790
  - service: http_status:404
```

The final catch-all is mandatory. Do not add an ingress rule for port `8791`; never expose port `8791` through Cloudflare Tunnel.

The public GameFrame hostname remains attached to the Worker. The Worker fetches the dedicated origin hostname only after authenticating the session and creating an HMAC claim.

## Unit installation

Install RPG GM Runtime first because GameFrame orders itself after that unit:

```bash
sudo cp /opt/game-master/rpg-gm-runtime/deploy/systemd/rpg-gm-runtime.service \
  /etc/systemd/system/rpg-gm-runtime.service
sudo cp /opt/game-master/rpg-gm-runtime/deploy/systemd/rpg-gm-runtime.env.example \
  /etc/game-master/rpg-gm-runtime.env
sudo cp /opt/game-master/scribbles-gameframe/deploy/systemd/scribbles-gameframe-rpg.service \
  /etc/systemd/system/scribbles-gameframe-rpg.service

sudo chmod 0644 /etc/systemd/system/rpg-gm-runtime.service \
  /etc/systemd/system/scribbles-gameframe-rpg.service
sudo chmod 0600 /etc/game-master/rpg-gm-runtime.env \
  /etc/game-master/scribbles-gameframe-rpg.env
sudo chown root:root /etc/game-master/rpg-gm-runtime.env \
  /etc/game-master/scribbles-gameframe-rpg.env

sudo systemd-analyze verify \
  /etc/systemd/system/rpg-gm-runtime.service \
  /etc/systemd/system/scribbles-gameframe-rpg.service

sudo systemctl daemon-reload
sudo systemctl enable --now rpg-gm-runtime.service
sudo systemctl enable --now scribbles-gameframe-rpg.service
```

## Health verification

```bash
curl --fail --silent http://127.0.0.1:8791/healthz | jq
curl --fail --silent http://127.0.0.1:8790/api/health | jq
sudo ss -ltnp | grep -E ':(8790|8791)\b'
```

Both listeners must show loopback addresses only. Inspect service logs without printing environment files:

```bash
sudo journalctl -u rpg-gm-runtime.service -u scribbles-gameframe-rpg.service \
  --since '15 minutes ago' --no-pager
```

## Restart behavior

- RPG GM Runtime starts independently and may wait for GameFrame while idle.
- GameFrame starts after the GM unit.
- GameFrame retains accepted commands in SQLite if GM is unavailable.
- retryable deliveries remain pending for the next poll or process restart.
- exact retries do not create duplicate inbox, journal, narrative, presentation, or encounter state.
- SIGTERM closes ingress first and drains immediately safe work before process exit.

```bash
sudo systemctl restart rpg-gm-runtime.service
sudo systemctl restart scribbles-gameframe-rpg.service
```

## Backup

Use a coordinated stopped backup:

```bash
sudo systemctl stop scribbles-gameframe-rpg.service rpg-gm-runtime.service
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
sudo tar --numeric-owner --xattrs --acls -C /var/lib \
  -czf "/var/backups/game-master-${STAMP}.tar.gz" game-master
sudo systemctl start rpg-gm-runtime.service
sudo systemctl start scribbles-gameframe-rpg.service
```

The backup must contain all authority surfaces together:

- GameFrame SQLite database;
- OpenClaw plugin-state directory;
- runtime narrative-link file.

Backing up only one repository's state can produce irreconcilable cross-service receipts.

Worker secrets, Discord credentials, Tunnel credentials, and both systemd environment files require a separate encrypted secret backup. Do not put them in the state archive.

## Restore and rollback

Restore both VM services from one coordinated snapshot, then redeploy the reviewed Worker commit that matches the restored GameFrame protocol:

```bash
sudo systemctl stop scribbles-gameframe-rpg.service rpg-gm-runtime.service
sudo mv /var/lib/game-master "/var/lib/game-master.pre-restore.$(date -u +%s)"
sudo tar --numeric-owner --xattrs --acls -C /var/lib \
  -xzf /var/backups/game-master-<STAMP>.tar.gz
sudo chown -R game-master:game-master /var/lib/game-master
sudo systemctl start rpg-gm-runtime.service
sudo systemctl start scribbles-gameframe-rpg.service
```

Verify local health, Worker edge health, Discord login, campaign attachment, and one disposable command round trip before declaring recovery complete.
