---
title: RPG Deployment Architecture
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - hybrid Cloudflare and VM deployment
  - embodied exploration realtime
  - Discord entry and invitations
  - trusted private staging deployment
shared_document_id: rpg-cloudflare-deployment-architecture-v1
shared_document_version: 5
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-cloudflare-deployment-architecture.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-cloudflare-deployment-architecture.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-media-theme-and-audio-pipeline.md
  - ../rpg-gameframe-interface-contract.md
  - ../rpg-platform-delivery-plan.md
---

# RPG Deployment Architecture

## Decision

The current production-shaped RPG topology remains a **hybrid Cloudflare + private VM profile**.

GameFrame remains the public player-facing authority. Its Cloudflare Worker serves the public application boundary, Discord/session routes, static assets, ordinary GameFrame routes, and ordinary Durable Object-backed matches. RPG campaign/exploration and `rpg:*` tactical traffic is authenticated at that edge and HMAC-proxied through Cloudflare Tunnel to the durable RPG GameFrame authority on the private VM.

RPG GM Runtime remains a separate loopback-only service on the same VM. It owns hidden campaign truth and model orchestration and is never directly routed from Cloudflare or the browser.

The VM initiates Cloudflare Tunnel outbound. No application port is forwarded on the home router, no VM application port is advertised in public DNS, and ordinary players require no Tailscale/WARP/VPN/tailnet membership or direct origin access.

Embodied exploration extends the existing WebSocket path but does not change campaign authority:

- durable semantic commands/recovery remain authoritative service/HTTP operations;
- bounded realtime movement/session traffic may use WebSocket;
- frame-by-frame avatar transforms are not RPG campaign truth;
- SQLite/runtime state and GameFrame materialization state remain recoverable without the live socket.

## Current topology

```text
Discord Activity / browser
          |
          v
Cloudflare GameFrame Worker + static assets
          |
          +--> ordinary GameFrame traffic
          |       |
          |       v
          |   Durable Objects / Worker authority
          |
          +--> RPG campaign / exploration / tactical traffic
                  |
                  | authenticated HTTP semantic commands/recovery
                  | authenticated WebSocket realtime/session traffic
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
| SQLite campaign/encounter/materialization authority           |
| semantic HTTP + realtime exploration/tactical WebSockets      |
|    |                                                          |
|    | authenticated service protocol                           |
|    v                                                          |
| RPG GM Runtime                                                |
| loopback only                                                 |
| package/world/journal/knowledge/DM provider orchestration      |
|                                                               |
+---------------------------------------------------------------+
```

Stopping `cloudflared` removes public reachability to the VM RPG origin. It must not expose a fallback LAN/public application listener.

## Cloudflare GameFrame boundary

The Worker owns/fronts:

- Discord OAuth/Activity authentication;
- signed GameFrame sessions;
- browser/static assets and public application routes;
- invitations/seats/player command custody;
- ordinary GameFrame Durable Object-backed matches;
- authenticated RPG semantic command/recovery routes;
- authenticated RPG exploration/tactical WebSocket upgrades;
- HMAC construction for requests forwarded to the private VM origin.

The Worker requires a distinct HTTPS RPG origin and shared HMAC secret. The HMAC secret exists only in Worker secret storage and private GameFrame RPG service configuration.

A proxied WebSocket does not make the Worker another RPG authority. Browser messages never receive the HMAC secret.

## VM GameFrame durable RPG authority

The VM GameFrame RPG service owns current durable GameFrame-side RPG state, including:

- campaign coordination/membership/presentation positions;
- accepted exploration materialization identity/state required for stable revisit/recovery;
- semantic anchor/transition bindings that belong to GameFrame materialization;
- encounter binding/configured Monster Master RPG matches;
- legal tactical actions/terminal outcomes;
- delivery to RPG GM Runtime.

Current process constraints remain deliberate:

- default listen address `127.0.0.1`;
- default port `8790`;
- non-loopback binds rejected;
- Cloudflare-facing HTTP/WebSocket uses HMAC proxy authentication;
- GameFrame→GM uses separate service credential;
- SQLite lives outside immutable release directories;
- realtime connection registries are process-local/disposable rather than durable authority.

## RPG realtime transport

Realtime transport now has two related purposes.

### 1. Durable semantic change notification

The existing campaign/tactical realtime paths continue to notify browsers after durable commits so clients can refresh/recover authoritative projections.

### 2. Embodied exploration session traffic

The exploration client may use an authenticated scene-scoped WebSocket for bounded high-frequency state such as:

- movement input/vector;
- facing;
- avatar transform projection;
- nearby-player transforms;
- local transient animation state;
- scene-session heartbeat/reconnect metadata;
- post-commit scene/materialization notifications.

### Realtime invariants

- player identity/resource/scene scope is fixed at handshake;
- the VM reauthorizes exact player/campaign/scene scope even though the Worker authenticated the browser;
- bounded frame sizes/message rates/connections apply;
- clients cannot switch semantic scene or identity by sending a socket message;
- a socket never owns campaign truth;
- missed/duplicate/reordered realtime frames cannot create semantic world changes;
- semantic scene transfer, inventory changes, checks, freeform adjudication, Ask-GM, encounter lifecycle, and other durable mutations remain versioned authoritative operations;
- reconnect recovers semantic scene/materialization state rather than trusting stale client coordinates;
- no runtime narrative revision is created for every movement frame;
- healthy hosted sessions should not require aggressive HTTP polling.

## Durable semantic command posture

HTTP/service commands remain appropriate for:

- campaign create/join/attach/resume;
- Ask-GM;
- Do Something Else/freeform intent;
- targeted interactions that create durable semantic consequences;
- inventory/equipment/resource mutations;
- scene transfers/route commitment;
- checks/mechanics;
- encounter launch/return coordination;
- materialization acceptance/version operations where GameFrame persistence is involved;
- recovery/snapshots.

A browser may move into an exit zone over WebSocket, but the meaningful transfer to another semantic scene is not authorized merely by the client reporting coordinates.

## Exploration materialization persistence

GameFrame may persist or reproducibly derive materialization data required for stable revisit/reconnect. This is separate from RPG GM Runtime semantic truth.

Examples include:

- materialization ID/version;
- deterministic recipe/seed identity;
- geometry profile;
- semantic anchor bindings;
- transition-zone identities;
- accepted asset-pack references;
- GameFrame-owned gameplay geometry/state.

RPG GM Runtime may store/reference only the stable semantic/materialization identifiers required by its contract. Neither service reads the other's private database.

## RPG GM Runtime boundary

RPG GM Runtime remains private/loopback-only and owns:

- committed CampaignPackage truth/provenance;
- semantic WorldGraph/location truth;
- narrative journal/revision;
- Entity/Scene/Observer-Knowledge state;
- Dungeon Master referee/entity-performance/GM-intervention context and decisions;
- model/provider selection/retries;
- application of GameFrame-authoritative mechanic/tactical results to campaign truth.

It accepts only authenticated service traffic from the VM GameFrame RPG service. It receives no browser cookie, Discord secret, GameFrame session-signing secret, or Cloudflare HMAC edge secret.

The browser WebSocket never connects directly to RPG GM Runtime.

## Network posture

The home-hosted VM uses deny-by-default application exposure:

- no router forwarding for HTTP/HTTPS/GameFrame/RPG GM/databases/staging ports;
- no router DMZ;
- no UPnP-created application forwarding;
- GameFrame RPG and GM services bind loopback only;
- databases are never network-bound;
- `cloudflared` creates outbound connections to Cloudflare;
- administrative SSH/Tailscale is a separate operator path, not player connectivity.

A host firewall remains recommended before broader production use.

## Service/data isolation

Same-machine deployment does not collapse authority boundaries.

GameFrame RPG and RPG GM Runtime retain:

- separate systemd services/process identities;
- independently versioned immutable release directories;
- separate persistent writable state directories;
- separate environment/secret files;
- independent health checks/restart policies;
- explicit authenticated service protocol;
- no direct access to each other's private database internals.

Recommended layout remains:

```text
/opt/rpg-staging/gameframe-rpg/releases/<gameframe-sha>/
/opt/rpg-staging/gameframe-rpg/current -> releases/<gameframe-sha>
/opt/rpg-staging/rpg-gm/releases/<runtime-sha>/
/opt/rpg-staging/rpg-gm/current -> releases/<runtime-sha>

/var/lib/rpg-staging/gameframe-rpg/
/var/lib/rpg-staging/rpg-gm/

/etc/rpg-staging/
```

## Trusted deployment runner boundary

The public `scribbles-gameframe` repository must not gain general execution authority on the private/home VM.

Accepted staging shape:

```text
public scribbles-gameframe
  -> ordinary public-repository CI elsewhere

private rpg-gm-runtime deployment workflow
  -> trusted self-hosted VM runner
  -> resolve exact approved GameFrame SHA
  -> fetch/build public source as deployment input
  -> deploy paired staging release
```

Public pull requests/forks/arbitrary public workflow code must never execute on the trusted runner with private source, provider keys, deployment credentials, or home-network authority.

## Release/rollback

Each deployment records exact GameFrame/runtime revisions.

Activation should continue to:

1. resolve exact SHAs;
2. run focused validation;
3. build without root;
4. install immutable release directories;
5. verify configuration/secrets without printing them;
6. take consistent durable backups during bounded activation;
7. atomically update release links;
8. start/health-check GM Runtime;
9. start/health-check GameFrame RPG;
10. ensure cloudflared healthy;
11. verify Worker→Tunnel→VM HTTP and WebSocket routing;
12. verify GameFrame→GM delivery;
13. run external staging canary including exploration reconnect and tactical return;
14. record rollback targets.

Release rollback and authority-data rollback remain different operations.

## Persistence, backup, recovery

Backups cover at least:

- GameFrame RPG SQLite state, including materialization records that are required for stable revisit/recovery;
- RPG GM Runtime SQLite/state/journal/narrative-link state;
- deployment metadata identifying paired SHAs;
- non-secret reconstruction configuration.

Realtime socket registries are never backup material.

Restore testing must prove campaign resume without duplicate scene presence, materialization replacement, command application, encounter aftermath, or cross-service revision confusion.

## Failure behavior

| Failure | Required behavior |
| --- | --- |
| Exploration WebSocket disconnect | Stop/degrade local realtime control safely; preserve campaign truth; reconnect and recover semantic/materialized scene state. |
| Missed/duplicate movement frame | Never create semantic campaign mutations. |
| Missed durable notification | Recover through authoritative projection/snapshot. |
| Tunnel interruption | Keep local state intact; VM application ports stay private. |
| GameFrame Worker failure | Do not create direct-origin bypass. |
| GameFrame RPG restart | Close sockets, recover GameFrame-owned RPG/materialization state, allow resynchronization. |
| RPG GM Runtime restart | Recover package/journal/world state without duplicating accepted commands. |
| Provider timeout | Preserve semantic command identity and retry/fail without duplicate world events. |
| Lost response after commit | Recover existing durable receipt/result. |
| Deployment failure | Restore previous release links and compatible services. |
| VM outage | Restore from durable backups; never reconstruct authority from browser state. |

## Future migration profile

Cloudflare-native migration may continue incrementally, but the hybrid profile is intentional.

Do not add a Durable Object merely to relay VM-owned exploration WebSockets. If RPG authority later moves to Cloudflare-native state, move the relevant authority coherently rather than create competing state owners.

No migration may require campaign reset or direct cross-service database sharing.

## Split-party / multi-map operational posture

The network topology can support multiple simultaneous active scene sockets without changing the public boundary, but product complexity increases substantially.

Later multi-scene operation requires:

- player-specific scene-scoped WebSocket subscriptions;
- independent materialization/session recovery;
- scene-local event/entity projection;
- bounded concurrency/fan-out controls;
- explicit cross-scene communication channels;
- observability keyed by campaign + scene + player;
- correct behavior when one subgroup enters Arena while another remains exploratory.

The first multiplayer product should therefore use one shared exploration scene and one party transition at a time while retaining zero-or-more-scene architecture in runtime.

## Environments

Maintain local/test/staging/production configuration.

- local: synthetic identity/disposable stores permitted explicitly;
- automated tests: deterministic providers/isolated state;
- VM staging: hybrid Worker/Tunnel/loopback topology with restricted Discord access and VM-backed exploration/tactical WebSockets;
- production: same authority split with stronger operational controls/budgets/backups/retention.

No environment silently falls back from authenticated staging/production behavior to development identity.

## Staging acceptance gates

Deployment-level acceptance for embodied RPG requires:

1. Worker/assets reachable through stable staging hostname;
2. no router forwarding/direct public VM app listener;
3. HMAC-authenticated Worker→Tunnel→GameFrame RPG HTTP;
4. HMAC-authenticated exploration/tactical WebSocket upgrades with player/resource/scene authorization;
5. ordinary movement/realtime projection without per-frame runtime narrative writes;
6. semantic scene transfer/recovery survives reconnect;
7. GameFrame→RPG GM authenticated service traffic remains private;
8. Arena transition/authoritative return updates embodied scene before control resumes;
9. stopping tunnel removes public reachability;
10. restart/backup/restore canaries remain green.

## Governing rule

> Cloudflare exposes GameFrame, not the private campaign brain; WebSockets may make the world move smoothly, but only durable semantic authorities decide what actually happened in the campaign.
