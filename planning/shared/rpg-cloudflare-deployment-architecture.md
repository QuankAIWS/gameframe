---
title: RPG Deployment Architecture
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-07
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - hybrid Cloudflare and VM deployment
  - Discord entry and invitations
  - trusted private staging deployment
shared_document_id: rpg-cloudflare-deployment-architecture-v1
shared_document_version: 3
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-cloudflare-deployment-architecture.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-cloudflare-deployment-architecture.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-media-theme-and-audio-pipeline.md
  - ../rpg-gameframe-interface-contract.md
  - ../rpg-platform-delivery-plan.md
---

# RPG Deployment Architecture

## Decision

The current production-shaped RPG topology is a **hybrid Cloudflare + private VM profile**.

GameFrame remains the public player-facing authority. Its Cloudflare Worker serves the public application boundary, Discord/session routes, static assets, ordinary GameFrame routes, and ordinary Durable Object-backed matches. RPG campaign and `rpg:*` tactical traffic is authenticated at that edge and HMAC-proxied to the durable RPG authority on the private VM.

The VM initiates Cloudflare Tunnel outbound. No application port is forwarded on the home router, no VM application port is advertised in public DNS, and ordinary players require no Tailscale, WARP, VPN, tailnet membership, or direct origin access.

The RPG GM Runtime remains a separate loopback-only service on the same VM. It owns hidden campaign truth and model orchestration and is never directly routed from Cloudflare or the browser.

This document supersedes the earlier assumption that the first deployment would tunnel all GameFrame traffic directly to a public-facing Node GameFrame origin on the VM. Current implemented Worker, Durable Object, HMAC proxy, durable RPG service, and SQLite authority take precedence.

## Current topology

```text
Discord Activity / browser
          |
          v
Cloudflare GameFrame Worker + assets
          |
          +--> ordinary GameFrame traffic
          |       |
          |       v
          |   Durable Objects / Worker authority
          |
          +--> RPG campaign and rpg:* tactical traffic
                  |
                  | Discord/session-authenticated request
                  | gameframe-hmac-v1 upstream signature
                  v
        stable HTTPS RPG origin hostname
                  |
          Cloudflare Tunnel
        outbound from the VM
                  |
                  v
+---------------- private staging/production VM ----------------+
|                                                               |
| cloudflared                                                   |
|    |                                                          |
|    v                                                          |
| GameFrame durable RPG service                                 |
| loopback only; default 127.0.0.1:8790                         |
| SQLite campaign/encounter/match authority for RPG traffic     |
|    |                                                          |
|    | authenticated service protocol                           |
|    v                                                          |
| RPG GM Runtime                                                |
| loopback only                                                 |
| hidden campaign truth, journal, context, provider orchestration|
|                                                               |
| separate persistent state and independently versioned releases |
+---------------------------------------------------------------+
```

Stopping `cloudflared` removes public reachability to the VM RPG origin. It must not expose a fallback LAN or public application listener.

## Cloudflare GameFrame boundary

The GameFrame Worker is the public application boundary.

It owns or fronts:

- Discord OAuth and Activity authentication;
- signed GameFrame sessions;
- browser assets and public application routes;
- invitations, seats, player command custody, and player-facing presentation;
- ordinary GameFrame Durable Object-backed matches;
- authenticated RPG campaign edge routes;
- authenticated RPG-bound tactical routes;
- HMAC construction for requests forwarded to the VM RPG origin.

The Worker requires a distinct HTTPS RPG origin and a shared HMAC secret. The RPG origin must not equal the public GameFrame origin.

The current Worker configuration uses `GAMEFRAME_RPG_ORIGIN_URL` and `GAMEFRAME_RPG_PROXY_HMAC_SECRET`. The shared secret is machine-generated, contains at least 32 bytes, and exists only in the Cloudflare Worker secret store and the private GameFrame RPG service configuration.

## VM GameFrame durable RPG authority

The VM GameFrame RPG service is a separate service from ordinary Cloudflare GameFrame match authority.

It owns the current durable SQLite authority for RPG-specific campaign coordination, RPG encounter binding, configured Monster Master RPG matches, legal RPG tactical actions, terminal participant outcomes, and delivery to the RPG GM Runtime.

Current process constraints are deliberate:

- default listen address `127.0.0.1`;
- default port `8790`;
- non-loopback bind addresses are rejected;
- Cloudflare-facing requests use HMAC proxy authentication;
- GameFrame-to-GM calls use a separate bearer service credential;
- the SQLite database lives outside immutable release directories.

Cloudflare Tunnel may connect to `http://127.0.0.1:8790` because `cloudflared` runs on the same VM. The application itself does not need to bind to the LAN interface.

## RPG GM Runtime boundary

RPG GM Runtime remains private and loopback-only.

It owns:

- committed CampaignPackage truth and provenance;
- narrative journal and semantic campaign revision;
- hidden NPC/world state and runtime-only knowledge;
- Dungeon Master semantic decisions and player-safe rendering contracts;
- model/provider selection and bounded retries;
- application of GameFrame-authoritative encounter outcomes to campaign truth.

It accepts only authenticated service traffic from the VM GameFrame RPG service. It receives no Discord client secret, GameFrame session-signing secret, browser cookie, Cloudflare HMAC edge secret, or authority to impersonate a player.

`RPG_GM_SERVICE_TOKEN` is a separate machine-generated shared secret of at least 32 bytes installed at the GameFrame RPG service and GM service boundaries.

## Network posture

The home-hosted VM uses deny-by-default application exposure:

- no router forwarding for HTTP, HTTPS, GameFrame, RPG GM, databases, or staging application ports;
- no VM placement in a router DMZ;
- no UPnP-created application forwarding;
- GameFrame RPG and GM services bind only to loopback;
- databases are never network-bound;
- `cloudflared` creates outbound connections to Cloudflare;
- administrative SSH or Tailscale is a separate operator path and is not part of player connectivity.

A host firewall is recommended before broader production use. The primary application security invariant is still that no application service listens on a public or LAN interface merely to support Tunnel routing.

## Service and data isolation

Same-machine deployment does not collapse authority boundaries.

GameFrame RPG and RPG GM Runtime have:

- separate systemd services and process identities;
- independently versioned immutable release directories;
- separate persistent writable state directories;
- separate environment/secret files;
- independent health checks and restart policies;
- an explicit authenticated service protocol;
- no direct access to each other's private database internals.

Recommended host layout:

```text
/opt/rpg-staging/gameframe-rpg/releases/<gameframe-sha>/
/opt/rpg-staging/gameframe-rpg/current -> releases/<gameframe-sha>
/opt/rpg-staging/rpg-gm/releases/<runtime-sha>/
/opt/rpg-staging/rpg-gm/current -> releases/<runtime-sha>

/var/lib/rpg-staging/gameframe-rpg/
/var/lib/rpg-staging/rpg-gm/

/etc/rpg-staging/
```

Release files are disposable and reproducible. SQLite, narrative receipts, backups, and other durable authority live under `/var/lib`, not inside a release directory. Secrets live under root-controlled `/etc` configuration and are never copied into release artifacts.

## Trusted deployment runner boundary

The public `scribbles-gameframe` repository must not gain general execution authority on the private/home VM.

The accepted staging shape is:

```text
public scribbles-gameframe repository
        -> ordinary public-repository CI elsewhere

private rpg-gm-runtime deployment workflow
        -> trusted self-hosted VM runner
        -> resolve an exact approved GameFrame SHA
        -> fetch/build that public source as deployment input
        -> deploy the paired staging release
```

A private deployment workflow consuming an exact public GameFrame commit is not equivalent to allowing GameFrame workflows to execute on the VM.

The staging VM may share the trusted private deployment runner during active development. Public pull requests, forks, or arbitrary public-repository workflow code must never be executed on that runner with private source, deployment credentials, provider keys, or home-network authority.

## Release and rollback

Each deployment records both source revisions.

The staging deployment flow is:

1. resolve exact RPG GM Runtime and GameFrame SHAs;
2. run focused validation before deployment;
3. build each release without root privileges;
4. install immutable release directories;
5. verify required configuration and secrets are present without printing them;
6. stop the two local application services for a bounded activation window;
7. take consistent backups of durable SQLite/state files;
8. atomically update `current` release links;
9. start RPG GM Runtime first;
10. verify GM private health;
11. start the GameFrame durable RPG service;
12. verify GameFrame private health and service authentication;
13. ensure `cloudflared` is healthy;
14. verify Worker -> Tunnel -> VM routing;
15. verify GameFrame -> RPG GM Runtime delivery;
16. run an external staging smoke/canary;
17. record deployed SHAs, health results, and rollback targets.

A failed activation restores the previous `current` links and restarts the previous compatible pair. Persistent state is not rolled backward automatically unless an operator explicitly chooses a database restore, because release rollback and authority-data rollback are different operations.

## Cloudflare Worker deployment

The public GameFrame Worker may be deployed from the trusted private staging workflow using the exact resolved GameFrame SHA.

Cloudflare account/deploy credentials and Worker secrets remain secret-store values. They are not committed to either repository or copied to artifacts.

At minimum staging eventually configures:

- `SESSION_SECRET`;
- `DISCORD_CLIENT_ID`;
- `DISCORD_CLIENT_SECRET`;
- `DISCORD_ALLOWED_USER_IDS`;
- `GAMEFRAME_RPG_ORIGIN_URL`;
- `GAMEFRAME_RPG_PROXY_HMAC_SECRET`.

The stable public staging hostname should remain fixed while release SHAs change behind it. The RPG tunnel hostname is an origin endpoint, not the player-facing application URL.

## Persistence, backup, and recovery

GameFrame RPG and RPG GM Runtime keep separate durable stores.

Backups cover at least:

- GameFrame RPG SQLite state;
- RPG GM Runtime SQLite/state and narrative-link state;
- deployment metadata identifying the paired source SHAs;
- non-secret configuration needed to reconstruct service layout.

Secret recovery follows operator policy and remains outside ordinary release artifacts.

Restore testing must prove that a campaign can resume without duplicate command application, identity collision, missing terminal outcome, or cross-service revision confusion.

## Discord entry

The intended staging/production player path is:

```text
Discord Activity
  -> stable GameFrame HTTPS hostname
  -> Cloudflare Worker
  -> ordinary Cloudflare authority or RPG edge proxy as appropriate
```

Discord URL configuration should normally remain stable across application deployments. A release changes what runs behind the staging hostname, not the Activity URL itself.

## Failure behavior

| Failure | Required behavior |
| --- | --- |
| Browser disconnect | Preserve committed state and permit resume. |
| Tunnel interruption | Keep local state intact; VM application ports remain private. |
| GameFrame Worker failure | Do not create a direct-origin bypass. |
| GameFrame RPG restart | Recover GameFrame-owned RPG state from SQLite. |
| RPG GM Runtime restart | Recover runtime-owned journal/state without duplicating accepted commands. |
| Runtime timeout | Preserve semantic command identity and retry without duplicate events. |
| Lost response after commit | Return/recover the existing durable receipt or committed result. |
| Deployment failure | Restore previous release links and restart the previous compatible pair. |
| VM outage | Restore from durable state/backups; never reconstruct authority from browser state. |

## Future migration profile

Cloudflare-native migration may continue incrementally, but the current hybrid is already an intentional architecture rather than a temporary fake deployment.

Future candidates include moving additional RPG coordination or encounter authority into Durable Objects, Queues, or R2 only when export/import, retry, reconnect, privacy, cost, and rollback gates are proven. RPG GM Runtime remains a separate authenticated service unless a later architectural decision explicitly moves that trust boundary.

No migration may require campaign reset or direct cross-service database sharing.

## Environments

Maintain separate local, test, staging, and production configuration.

- local development may use explicit synthetic identity and disposable stores;
- automated tests use deterministic providers and isolated state;
- VM staging uses the hybrid Worker/DO + Tunnel + loopback-service topology with restricted Discord access;
- production uses the same authority split with stronger operational controls, budgets, retention, backups, and incident procedures.

No environment silently falls back from authenticated staging/production behavior to development identity.

## Staging acceptance gates

The hybrid staging profile is useful before the complete campaign is product-complete, but each evidence claim remains bounded.

Deployment-level acceptance requires:

1. Worker and assets reachable through the stable staging hostname;
2. no router application forwarding and no direct public VM application listener;
3. Worker RPG edge health reports configured upstream routing;
4. HMAC-authenticated Worker -> Tunnel -> GameFrame RPG requests;
5. bearer-authenticated GameFrame RPG -> GM calls;
6. separate durable state for both services;
7. restart recovery for both local services;
8. release rollback without deleting durable state;
9. actual configured Monster Master Arena traffic using the VM RPG authority;
10. later, the complete single-player campaign and Discord Activity canary required by the testing ladder.

A successful tunnel or health endpoint does not by itself prove a complete RPG campaign.

## Governing rule

> GameFrame stays the public player authority at Cloudflare; ordinary GameFrame traffic stays on Worker/Durable Object authority; RPG-specific traffic is authenticated and proxied through Cloudflare Tunnel to the loopback-only durable RPG service; RPG GM Runtime remains a separate private service; and the public GameFrame repository never receives general execution authority on the private VM.
