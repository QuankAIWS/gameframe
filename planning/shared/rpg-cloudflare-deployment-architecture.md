---
title: RPG Deployment Architecture
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - hybrid Cloudflare and VM deployment
  - embodied exploration realtime
  - Discord entry and invitations
  - trusted private staging deployment
shared_document_id: rpg-cloudflare-deployment-architecture-v1
shared_document_version: 6
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

The current production-shaped topology is **Cloudflare public boundary + private VM GameFrame RPG authority + private RPG GM Runtime**.

GameFrame is the only public player-facing application authority. RPG GM Runtime remains loopback/private and never receives direct browser traffic.

The VM reaches Cloudflare through outbound Tunnel connectivity. No application port is forwarded on the home router and ordinary players require no Tailscale/WARP/VPN access.

## Current mutation/realtime invariant

**HTTP owns every GameFrame RPG command/mutation. WebSockets are projection/notification-only.**

This includes exploration movement.

Current movement path:

```text
browser WASD / mobile D-pad
→ authenticated same-origin HTTP
POST /api/rpg/campaigns/:campaignId/exploration/move
→ Cloudflare Worker/HMAC proxy
→ private VM GameFrame RPG service
→ collision + physical position revision + SQLite commit
→ exploration_position response
→ browser Pixi reconciliation/camera follow
```

Runtime receives no per-step movement traffic.

WebSockets may notify clients that durable state changed and may carry reconnectable projection/session notifications where supported, but a WebSocket frame cannot mutate campaign, movement, object, inventory, travel, or tactical truth.

## Current topology

```text
browser / Discord-authenticated player
          |
          v
Cloudflare GameFrame Worker + static assets
          |
          +--> ordinary GameFrame Worker/DO traffic
          |
          +--> authenticated RPG HTTP commands/recovery
          |        |
          |        | gameframe-hmac-v1
          |        v
          |   Cloudflare Tunnel
          |        |
          |        v
          |   VM GameFrame RPG service
          |   loopback 127.0.0.1:8790
          |   SQLite physical/campaign-side state
          |        |
          |        | private service bearer
          |        v
          |   RPG GM Runtime
          |   loopback 127.0.0.1:8791
          |   package/journal/semantic/DM state
          |
          +--> authenticated RPG WebSocket upgrades
                   projection/notification only
```

Staging also uses a loopback private reset/control listener; it is not a public admin service.

## Cloudflare GameFrame boundary

The Worker fronts:

- Discord OAuth/Activity authentication;
- signed GameFrame sessions;
- static/browser routes;
- ordinary GameFrame routes;
- authenticated RPG HTTP commands/recovery;
- authenticated RPG projection WebSocket upgrades;
- HMAC signing/proxying to the private VM RPG origin.

The browser never receives the HMAC secret or Runtime service credential.

A proxied WebSocket is not a second RPG command authority.

## VM GameFrame RPG authority

The VM GameFrame RPG service owns current GameFrame-side RPG state including:

- campaign coordination/presentation positions where applicable;
- accepted exploration materialization identity/state;
- GameFrame semantic-anchor/interaction bindings;
- player x/y/facing and physical position revision;
- collision/interaction-range outcomes;
- encounter/tactical binding while legacy substrate remains;
- deterministic tactical state/outcomes as promoted;
- delivery to RPG GM Runtime.

Process constraints:

- loopback bind only;
- no public application listener;
- Cloudflare-facing requests use HMAC proxy authentication;
- GameFrame→Runtime uses a separate bearer/service credential;
- SQLite lives outside immutable release directories;
- realtime connection registries are disposable process state, not authority.

## RPG GM Runtime boundary

Runtime owns:

- committed CampaignPackage/WorldGraph truth;
- semantic campaign journal/revision;
- Entity Registry;
- semantic Scene Registry;
- Observer Knowledge;
- Dungeon Master context/orchestration;
- semantic scene transfer/world consequences;
- semantic Tactical Activation requirements/reconciliation;
- model/provider interaction.

It accepts authenticated private GameFrame service traffic only. The browser never connects directly to Runtime.

Runtime does not receive x/y/facing movement commands or per-frame transforms.

## HTTP command families

Authenticated HTTP is appropriate for:

- campaign create/join/attach/resume;
- exploration movement;
- targeted interactions that require semantic/mechanical consequences;
- Do Something Else/freeform intent;
- Ask Game Master;
- inventory/equipment/resource mutations;
- deploy/recall and other ruleset mechanics;
- scene travel/transfer;
- checks/mechanics;
- Tactical Activation/actions/outcomes;
- materialization acceptance/version operations where required;
- recovery/snapshots/admin reset where authorized.

Physical arrival at an exit may make a travel command eligible. Coordinates alone do not authorize semantic transfer.

## WebSocket posture

WebSockets are optional low-latency delivery for reconstructable state changes, such as:

- campaign projection-change notifications;
- match/tactical projection notifications;
- scene/materialization invalidation notifications;
- nearby-player presentation in later multiplayer if that state can be safely reconstructed from GameFrame authority.

Invariants:

- identity/resource scope is fixed at authenticated handshake;
- no client identity/scene switching by frame payload;
- no semantic or physical mutation by frame payload;
- missed/duplicate/reordered frames cannot create world changes;
- reconnect falls back to authoritative HTTP attach/recovery;
- correctness never requires a permanently connected socket.

## Network posture

The home-hosted VM remains deny-by-default:

- no router HTTP/HTTPS/RPG/DB port forwarding;
- no router DMZ;
- no UPnP application forwarding;
- GameFrame RPG/Runtime/admin listeners bind loopback;
- databases are not network services;
- `cloudflared` creates outbound Cloudflare connectivity;
- operator SSH/Tailscale is separate from player connectivity.

A host firewall remains recommended before broader production use.

## Service/data isolation

Same-machine deployment does not collapse boundaries.

GameFrame RPG and RPG GM Runtime retain separate:

- systemd services/process identities;
- immutable release directories;
- persistent writable state directories;
- environment/secret files;
- health/restart policies;
- authenticated service protocol;
- databases.

Neither service reads the other's private database directly.

Recommended staging layout:

```text
/opt/rpg-staging/gameframe-rpg/releases/<gameframe-sha>/
/opt/rpg-staging/gameframe-rpg/current -> releases/<gameframe-sha>
/opt/rpg-staging/rpg-gm/releases/<runtime-sha>/
/opt/rpg-staging/rpg-gm/current -> releases/<runtime-sha>

/var/lib/rpg-staging/gameframe-rpg/
/var/lib/rpg-staging/rpg-gm/
/etc/rpg-staging/
```

## Trusted runner boundary

Public `scribbles-gameframe` source must not gain general execution authority on the private/home VM.

Accepted deployment shape:

```text
public scribbles-gameframe
  -> public-repository CI elsewhere

private rpg-gm-runtime deploy workflow
  -> trusted self-hosted VM runner
  -> resolve exact approved GameFrame SHA
  -> fetch/build public source as deployment input
  -> activate paired staging release
```

Public PR/fork/arbitrary workflow code must never run on the trusted VM runner with private source, deployment secrets, provider keys, or home-network authority.

## Release/rollback

Deployments resolve and record exact Runtime + GameFrame SHAs. Activation should validate/build immutable releases, preserve separate durable state, atomically activate paired revisions, restart/health-check Runtime/GameFrame/Tunnel, deploy the exact GameFrame Worker revision, and run public/private health canaries.

Release rollback and durable-data rollback are different operations.

## Staging reset

The authenticated staging Admin reset is intentionally destructive test tooling. It must:

- bind to the currently configured/attached staging campaign identity;
- require an explicit confirmation bound to that same campaign;
- fail closed on legacy/wrong campaign identity;
- clear disposable GameFrame + Runtime staging state;
- restart/reseed the current canonical staging campaign;
- never become a generic production reset surface.

## Persistence/recovery

Durable recovery must be possible without any live WebSocket:

1. Runtime recovers semantic package/journal/entity/scene/knowledge state.
2. GameFrame recovers accepted materialization and physical x/y/facing/tactical state.
3. browser reattaches over authenticated HTTP.
4. optional WebSocket notification delivery resumes afterward.

## Scaling posture

Do not introduce Durable Object or other Cloudflare semantic authorities merely because embodied play exists. Current VM/local SQLite authority remains acceptable while it meets availability/performance goals.

Use evidence before migrating state architecture.

## Governing rule

> Cloudflare is the authenticated public transport boundary; the VM GameFrame service is the physical/deterministic RPG authority; RPG GM Runtime is the private semantic campaign authority; HTTP owns mutations; WebSockets only accelerate reconstructable presentation/notification.
