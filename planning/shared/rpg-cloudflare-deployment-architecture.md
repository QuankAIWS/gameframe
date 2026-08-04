---
title: RPG Deployment Architecture
status: accepted
document_type: architecture
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-04
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - initial VM deployment
  - Cloudflare public edge
  - future Cloudflare-native scale profile
  - Discord entry and invitations
shared_document_id: rpg-cloudflare-deployment-architecture-v1
shared_document_version: 2
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

The first production-shaped RPG deployment runs GameFrame and RPG GM Runtime as separate services on one dedicated VM. Cloudflare provides the public edge through DNS, TLS, CDN behavior, denial-of-service protection, and Cloudflare Tunnel. The VM initiates the tunnel outbound; the home router exposes no inbound application port and ordinary players require no Tailscale, WARP, VPN, tailnet membership, or direct origin access.

Only GameFrame is publicly routed. RPG GM Runtime remains private to the VM service network and accepts authenticated service calls from GameFrame. The two services use separate processes or containers, separate persistent stores, separate credentials, and independently versioned releases even when they share one machine.

Cloudflare Workers, Durable Objects, Queues, and R2 remain supported future scale components. They are not prerequisites for the first public campaign and must not become correctness dependencies until their migration gates are satisfied.

## Deployment profiles

### Profile A — Initial VM production profile

This is the controlling first deployment:

- one dedicated Linux VM;
- GameFrame Node service as the only public application origin;
- RPG GM Runtime as a private service;
- Cloudflare Tunnel as public ingress;
- Cloudflare DNS, TLS, CDN, and edge protection;
- durable local persistence owned independently by each service;
- prepared assets served by GameFrame and cacheable through Cloudflare;
- operator administration through a private management path such as Tailscale or local console;
- no router port forwarding and no public SSH, database, GameFrame service port, or GM service port.

### Profile B — Cloudflare-native scale profile

This is a later migration target:

- GameFrame edge Worker;
- campaign and encounter Durable Objects where their authority and persistence contracts justify migration;
- Queues for slow idempotent work;
- R2 or equivalent object storage for accepted binaries;
- RPG GM Runtime remaining a separate authenticated service unless a later decision explicitly changes that boundary.

Profile B must preserve the same versioned domain contracts, identities, audience rules, retry semantics, and authority split as Profile A. It is not a separate product architecture.

## Initial topology

```text
Discord invitation, OAuth, Activity launch, or browser visit
                         |
                         v
              Cloudflare public edge
         DNS, TLS, CDN, protection, Tunnel
                         |
               outbound encrypted tunnel
                         |
                         v
+--------------------- dedicated VM ----------------------+
|                                                         |
|  cloudflared                                            |
|       |                                                 |
|       v                                                 |
|  GameFrame service                                     |
|  public web app, auth, sessions, commands, presentation |
|  campaign coordination, tactical authority, assets      |
|       |                                                 |
|       | private authenticated service call              |
|       v                                                 |
|  RPG GM Runtime service                                |
|  narrative journal, context, NPC/world reasoning,       |
|  model and provider adapters                            |
|                                                         |
|  GameFrame persistence    RPG GM Runtime persistence    |
|  separate volume/store    separate volume/store         |
+---------------------------------------------------------+
```

Players connect to a normal public HTTPS hostname through Cloudflare. They do not connect to the residential IP, router, VM address, container network, or runtime service directly.

## Cloudflare edge boundary

Cloudflare is the initial public edge, not the initial authoritative application host.

The edge provides:

- public DNS for the GameFrame hostname;
- managed HTTPS and certificate termination;
- Tunnel routing to the private origin;
- cache delivery for explicitly cacheable static assets;
- edge denial-of-service and abuse protection available to the selected plan;
- origin address concealment so public DNS does not advertise the residential IP.

Normal dynamic GameFrame requests route through the tunnel to the VM without requiring a Worker or Durable Object invocation. This keeps the initial application independent of Cloudflare compute request quotas while retaining Cloudflare as the public ingress.

Stopping `cloudflared` makes the application unavailable. It must not expose a fallback origin port.

## Router and host network posture

The initial production posture is deny-by-default:

- no router forwarding for ports 80, 443, GameFrame, RPG GM Runtime, SSH, databases, or administration;
- no VM placement in the router DMZ;
- no UPnP-created application forwarding;
- host firewall denies unsolicited inbound traffic;
- the VM permits only required outbound traffic and established responses;
- GameFrame listens only on loopback or the private container network behind the tunnel;
- RPG GM Runtime listens only on the private service network;
- databases and persistent stores are never publicly bound;
- operator administration uses a separate private management channel.

The production VM should be isolated from sensitive household devices through a dedicated VM network, host-only segmentation, VLAN, or equivalent boundary where practical. The production services must not share a VM with an untrusted or general-purpose GitHub Actions runner.

## Service isolation on one VM

Same-machine deployment does not collapse the services.

GameFrame and RPG GM Runtime must have:

- separate process identities or containers;
- separate working directories and immutable application images or releases;
- separate writable data volumes;
- separate secrets;
- independent health checks and restart policies;
- bounded CPU, memory, and disk behavior;
- independently deployable and rollback-capable versions;
- an explicit authenticated service protocol.

A private Docker network or loopback connection reduces exposure but does not replace service authentication. GameFrame-to-runtime requests carry a service identity or signed credential, protocol version, bounded payload, timeout, and idempotency identity where mutation is possible.

RPG GM Runtime receives no GameFrame session-signing secret, Discord client secret, browser cookie, raw database handle, or authority to impersonate a player.

## GameFrame responsibilities in Profile A

GameFrame owns the public HTTP boundary for:

- Discord OAuth callbacks and Discord Activity authentication;
- issuance and verification of GameFrame sessions;
- invitation creation, inspection, acceptance, cancellation, and expiry;
- campaign creation, join, attach, resume, command, feed, and projection routes;
- scene, dialogue, choice, map, character, inventory, quest, recap, and encounter presentation;
- tactical legal actions, revisions, replay, reconnect, and terminal outcomes;
- browser assets and prepared campaign media;
- routing authenticated semantic commands to RPG GM Runtime;
- applying runtime-authored presentation events and structured campaign consequences through the accepted cross-repository contract.

GameFrame derives principals from verified server-side authentication. A request body, query parameter, display name, avatar, Discord username, or client-provided player ID is never proof of identity.

## RPG GM Runtime responsibilities in Profile A

RPG GM Runtime remains the separate campaign-intelligence service. It owns:

- runtime-authoritative narrative event history and semantic campaign truth;
- NPC motives, memory, relationships, and dialogue intent;
- freeform action interpretation;
- runtime-owned audience classification and hidden information;
- context construction, provider selection, retries, evaluation, and deterministic fallback;
- bounded scene, dialogue, choice, check, consequence, media, and encounter proposals;
- application of structured GameFrame outcomes to runtime-owned campaign truth.

It is not publicly routed and does not serve browser clients.

## Durable persistence in Profile A

The existing in-memory Node stores are development adapters, not production persistence.

Before public VM deployment, GameFrame requires durable local adapters for the state it must authoritatively operate and reconnect, including:

- identities needed beyond a signed session lifetime;
- campaign membership and seat claims;
- invitations and atomic acceptance receipts;
- command idempotency and conflict receipts;
- GameFrame coordination revisions and player projection positions;
- match and encounter snapshots, event history, replay, and terminal outcomes;
- asset references and readiness state owned by GameFrame.

RPG GM Runtime retains its own durable store for runtime-owned narrative events and semantic state.

The initial implementation should prefer a simple transactional local store such as SQLite in WAL mode where its write and concurrency profile is appropriate. PostgreSQL or another service may be introduced when measured concurrency, operations, backup, or availability requirements justify it.

The stores remain separate. Neither repository reads or writes the other service's database, files, journal, migrations, or internal tables. Cross-service synchronization occurs only through versioned APIs and durable identifiers.

## Revision and journal separation

Profile A must make the dual authority explicit:

- GameFrame coordination revision covers authenticated commands, memberships, client projection positions, tactical state, encounter references, and GameFrame-owned mechanics;
- RPG GM Runtime narrative revision covers semantic campaign truth, NPC/world state, runtime-authored consequences, and hidden narrative facts.

The two revisions are linked by stable command IDs, runtime commit IDs, encounter IDs, and acknowledged receipts. They are not presented as one interchangeable revision counter.

## Discord entry and invitation flow

The intended player journey is:

1. An authenticated campaign member creates a bounded, signed, expiring invitation in GameFrame.
2. The recipient opens the link through an ordinary browser or Discord Activity.
3. Discord authentication establishes the external identity.
4. GameFrame issues or resumes its own signed session for a stable principal.
5. The invitation authorizes an atomic campaign-seat claim but does not itself establish identity.
6. GameFrame commits membership and returns the authorized player projection.
7. The player resumes later through the same public GameFrame hostname without replaying the invitation.

Discord voice and social chat may accompany play. They do not substitute for GameFrame commands, projections, persistence, or authorization.

## Projection and reconnect

HTTP or an equivalent authoritative request boundary owns mutations. WebSockets may deliver responsive projections but are not a second mutation path.

Correctness cannot depend on receiving every WebSocket message. Each player can recover by presenting a valid session and bounded resume cursor, then fetching the current projection or missed feed range.

Tests must cover:

- GameFrame process restart;
- RPG GM Runtime process restart;
- browser refresh and later-session resume;
- missed projection recovery;
- duplicate and stale command rejection;
- public, party, player-private, and runtime-only filtering;
- restart during encounter completion or runtime response delivery;
- lost-response retry without duplicate campaign events.

## Static assets and media

Prepared HTML, JavaScript, CSS, Pixi bundles, game art, and deterministic campaign assets may be served by GameFrame through the tunnel. Hashed immutable assets should use long-lived cache headers so Cloudflare can serve them efficiently. API, authentication, personalized HTML, private media, and mutation routes must not be publicly cached.

R2 or another object store is optional in the first deployment. Generated media may begin on a dedicated VM volume with explicit quotas, retention, provenance, backup, and cleanup. Object storage becomes preferred when accepted binary volume, multi-origin delivery, durability, or migration requirements justify it.

Slow model, image, audio, and composition work never executes inside a state commit that must complete for legal play. Media failure retains a placeholder or prepared fallback.

## Release and rollback

Each repository produces an independently versioned deployable artifact, preferably an immutable container image or release bundle.

The deployment flow should:

1. validate the exact source revision;
2. build the GameFrame or runtime artifact;
3. publish it to an owner-controlled registry or release store;
4. pull the pinned version onto the VM;
5. run schema and migration preflight;
6. start the candidate with health checks;
7. switch traffic or service routing only after readiness;
8. retain the previous compatible artifact and database backup for rollback.

A GameFrame deployment must not silently upgrade the GM service, and a GM deployment must not replace GameFrame. Cross-repository compatibility is verified through the shared contract and recorded source versions.

## Backup and recovery

The VM profile requires documented backup and restore before public campaigns are considered durable.

Backups cover:

- GameFrame persistence;
- RPG GM Runtime persistence;
- accepted local media and provenance records;
- deployment configuration excluding recoverable build artifacts;
- encrypted secret recovery material according to operator policy.

Restore testing must prove a campaign can resume from backups without identity collision, duplicate command application, missing terminal outcome, or cross-service revision confusion.

## Failure behavior

| Failure | Required behavior |
| --- | --- |
| Browser disconnect | Preserve committed state and permit resume. |
| WebSocket loss | Recover by authenticated polling or feed cursor. |
| Tunnel interruption | Keep local state intact and resume public service when the tunnel reconnects. |
| GameFrame restart | Recover GameFrame-owned state from durable persistence. |
| RPG GM Runtime restart | Recover runtime-owned journal and semantic state without duplicating accepted commands. |
| Runtime timeout | Preserve command identity and retry without duplicate events. |
| Lost response after commit | Return the existing durable receipt or committed result. |
| Image provider failure | Keep placeholder or prepared asset and continue play. |
| Audio provider failure | Display text and continue play. |
| Local media volume unavailable | Keep the asset unresolved and do not publish a broken reference. |
| Discord unavailable after login | Existing valid GameFrame sessions continue according to session policy. |
| VM outage | Restore from durable disks or backups; never reconstruct authority from browser state. |

## Cloudflare-native scale profile

Profile B may be adopted incrementally rather than as one rewrite.

Candidate migrations include:

1. move public route handling or selected stateless edge logic to a Worker;
2. move large accepted binaries to R2 or equivalent object storage;
3. move asynchronous work to Queues;
4. move encounter authority to an Encounter Durable Object after its storage and replay contract is proven;
5. move GameFrame campaign coordination to a Campaign Durable Object after dual-revision ownership, migration, reconnect, and recovery semantics are settled;
6. retain RPG GM Runtime behind the same narrow authenticated service contract.

A migration must preserve stable IDs, accepted receipts, revisions, event ordering, player projections, terminal outcomes, and rollback capability. It must not require campaign reset or direct database sharing.

## Cloudflare-native migration gates

Cloudflare compute is not a production correctness dependency until automated tests prove:

1. export and import between the local persistence adapter and target Cloudflare storage;
2. exact command retry and conflict behavior across migration;
3. campaign and encounter recovery after Durable Object eviction;
4. projection reconnect after Worker or object restart;
5. one campaign entering and returning from an encounter;
6. player-private projection enforcement;
7. stable asset retrieval after storage migration;
8. rollback to a compatible prior deployment without campaign corruption;
9. public desktop and mobile journeys that require no Tailscale;
10. measured request, duration, storage, and cost behavior within the selected Cloudflare plan or approved budget.

## Environments

Maintain separate local, test, staging, and production configuration.

- Local development may use synthetic identity only through explicit development-only routes.
- Test environments use deterministic providers and disposable stores.
- VM staging uses the same service topology, tunnel behavior, persistence adapters, and migration process as VM production with restricted Discord access.
- Cloudflare-native staging is introduced only for Profile B migration work.
- Production uses explicit budgets, rate limits, logs, metrics, backups, retention, and incident procedures.

No environment may silently fall back from authenticated production behavior to synthetic local identity.

## Initial validation gates

Profile A is production-shaped when automated and operator-observed tests prove:

1. public Discord OAuth or Activity authentication through Cloudflare Tunnel;
2. signed invitation and atomic campaign-seat claim;
3. two public-network players joining the same campaign without a VPN;
4. no router port forwarding or direct public origin route;
5. GameFrame-to-runtime authenticated service calls over the private network;
6. durable command idempotency and revision conflict behavior;
7. GameFrame and runtime restart recovery;
8. campaign-to-Arena-Battles-to-campaign outcome application;
9. player-private projection enforcement;
10. prepared asset delivery with safe cache behavior;
11. provider failure without campaign corruption;
12. backup restoration and later-session resume;
13. desktop and mobile journeys that require no Tailscale.

## Governing rule

> Cloudflare is the public edge; the first authoritative services run separately on one private VM; GameFrame is the only public game origin; RPG GM Runtime remains private; and Cloudflare-native stateful compute is adopted later only through an evidence-backed migration.