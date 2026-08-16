# Cloudflare request architecture

## Status

This document defines the forward architecture for GameFrame's Cloudflare Worker and Durable Object traffic. It was written after the August 2026 request-amplification incident in which client polling plus read-path fan-out exhausted the free-tier Durable Object request budget.

The optimization target is not minimum source-code size. GameFrame is developed with AI-assisted implementation, so explicit services, adapters, tests, and read models are cheaper to maintain than hidden coupling. Prefer a larger amount of simple code over a smaller amount of request-amplifying code.

## Incident findings

The production traffic spike was caused by several independent background loops multiplying through the player platform:

- Cascade progression called `GET /api/me/progression` every 750 ms.
- The global challenge bell called `GET /api/me/feed` every 5 seconds on every visible authenticated GameFrame page.
- Cascade telemetry emitted a session heartbeat every 30 seconds even while a tab was hidden or idle.
- Player-platform reads commonly called `upsertPlayerDirectory()` first. That helper writes the directory and also read/published progression, turning a logical read into multiple Durable Object requests and writes.
- Some GET routes repair/project state while reading it, including match and invitation reads.
- Othello remote play still has a polling fallback, and new invitation-following work must not introduce another high-frequency polling loop.

The first stabilization PR bounds the client loops. The remaining work is architectural: healthy real-time operation must become event-driven and GET/read paths must become side-effect-free.

## Design invariants

### 1. Idle means idle

A visible but untouched local-game page must not continuously write state. A hidden page must not generate periodic application traffic except where a bounded browser/platform requirement makes it unavoidable.

Target steady state after the real-time migration:

- idle authenticated shell: zero periodic Durable Object writes;
- healthy player event connection: zero feed polling;
- healthy remote match connection: zero match polling;
- local Cascade: zero progression writes until progression actually changes;
- telemetry: event batches and sparse active-session checkpoints, never hidden-tab heartbeats.

### 2. Reads do not mutate

Public GET routes are read/query boundaries. They must not update presence, rebuild projections, initialize matches, or republish progression as a side effect.

Examples:

- `GET /api/me/feed` -> one player read-model query;
- `GET /api/me/progression` -> one player progression query;
- `GET /api/players` -> one directory query;
- `GET /api/leaderboard` -> one leaderboard query;
- `GET /api/matches/:id` -> authoritative match read only;
- `GET /api/invitations/:id` -> authoritative invitation read only.

Recovery/repair operations belong behind explicit mutation or maintenance paths so their cost and failure behavior are visible.

### 3. Presence is not a query side effect

Player presence/profile discovery is updated at an explicit session/presence boundary, not every time a player asks for a resource.

`GET /api/session` may establish/touch a player profile. Repeated identical touches should be write-throttled (for example, no more than once per 10-15 minutes unless profile metadata changes). Resource reads do not touch `lastSeenAt`.

### 4. Project on mutation, not on observation

Read models are updated when authoritative state changes:

- match creation/action/completion -> player match summaries and global completed-match projection;
- invitation create/claim/cancel/decline/expire -> player invitation summaries;
- progression mutation -> player progression plus global progression/leaderboard projection;
- preference mutation -> player feed/profile projection.

A later GET must never be required to make a previous mutation visible.

### 5. One atom of coordination per Durable Object

The long-term namespace layout follows logical ownership rather than the historical migration-stable class name:

- `MatchDurableObject`: one object per authoritative match;
- `PlayerDurableObject`: one object per player, owning feed/preferences/progression and the player's real-time event sockets;
- `InvitationDurableObject`: one object per invitation when atomic claim/expiry coordination is required;
- `FamilyAuthDurableObject`: trusted-device registry/authentication state;
- telemetry objects: partitioned by player/time window as needed;
- leaderboard/directory: materialized read model, partitioned when family-scale assumptions no longer apply.

Do not turn `directory:players` or any replacement into a global command coordinator. A global read model can exist while small, but authoritative mutations must not serialize through it.

The existing `TicTacToeMatchDurableObject` class name remains migration-stable during the transition. New bindings/classes can be introduced incrementally rather than attempting a risky storage migration in one change.

### 6. HTTP owns commands; WebSockets own projection/invalidation

The existing GameFrame rule remains intact: game actions, invitation mutations, preferences, and progression commands use authenticated HTTP/RPC command boundaries. WebSockets do not become an alternate command authority.

WebSockets deliver state projection or invalidation:

- `match_state` for authoritative match projection;
- `feed.changed` / `invitation.changed`;
- `match.changed`;
- `progression.changed`;
- `preferences.changed`.

A notification can carry a compact version/revision and enough metadata to update directly, or cause one narrow GET. It must not cause a cascade of broad reloads.

### 7. Hibernation is mandatory for Durable Object WebSockets

Player and match event streams use the Durable Object WebSocket Hibernation API. Connections persist while the object sleeps. Socket identity/revision metadata is serialized as an attachment so constructor re-entry after hibernation is safe.

Do not add `setInterval`/`setTimeout` loops inside a Durable Object that is expected to hibernate. Client reconnection/backoff belongs in the browser; server deadlines/expiry belong in Durable Object alarms when required.

### 8. Polling is a degraded fallback, not the normal transport

Where a WebSocket cannot be established:

- use exponential backoff with jitter;
- stop or greatly reduce polling while hidden;
- cap retry frequency;
- reset backoff on explicit `online`/foreground transitions;
- avoid one poller per widget when one shell-level event transport can serve the page.

No new sub-5-second indefinite poller should be merged without an explicit architectural exception and request-budget test.

### 9. Cross-tab coordination is optional optimization, not correctness

Once the player event socket is stable, multiple tabs can coordinate through `BroadcastChannel` so one tab owns the live player socket and fans invalidations to sibling tabs. Correctness must not depend on leader election; each tab may fall back to its own hibernating socket.

### 10. Queues are for coarse asynchronous work

Cloudflare Queues are useful for low-volume, reconstructable asynchronous projections, exports, notifications, and background processing. They are not the transport for every game action or telemetry point. Queue operations themselves have a free-tier budget and a normally delivered message consumes write/read/delete operations.

Use mutation-driven direct player projection for latency-sensitive family play. Introduce queues only when durability/decoupling is worth their operation budget.

## Migration plan

### Stage 1 - stop amplification

Implemented in the stabilization branch:

- replace Cascade's 750 ms server read loop with local change detection plus a five-minute reconciliation;
- exponential progression retry backoff;
- support the deployed progression response shape;
- reduce alert fallback from 5 seconds to 60 seconds;
- reduce active telemetry heartbeat from 30 seconds to 5 minutes and suppress hidden/idle periodic heartbeats;
- add request-budget regression coverage.

### Stage 2 - pure query boundaries

Refactor the edge/router and player coordinator:

1. Keep player directory/profile touch at session establishment.
2. Remove `upsertPlayerDirectory()` from feed/progression/leaderboard/profile reads.
3. Split progression publication out of presence/profile upsert.
4. Throttle identical presence writes in the directory runtime.
5. Stop `indexMatchView()` on match GET; index on create/action/claim/completion.
6. Stop invitation projection/repair work on ordinary invitation GET. Put recovery behind an explicit idempotent recovery path if required.
7. Add instrumented fake-namespace tests that assert exact Durable Object call counts and zero writes for GET routes.

Acceptance target: a successful `GET /api/me/feed` performs exactly one player Durable Object request and no storage write caused by the edge layer.

### Stage 3 - player event stream

Add authenticated `GET /api/me/events` WebSocket upgrade routing to the current per-player Durable Object.

The player object:

- accepts the server socket through `ctx.acceptWebSocket()`;
- serializes a player-event attachment;
- broadcasts a compact invalidation after successful player mutations;
- does not read the feed merely to broadcast an invalidation;
- can hibernate between mutations.

The browser shell:

- opens one player event connection after identity establishment;
- refreshes the challenge bell on relevant invalidations;
- reconnects with capped exponential backoff and jitter;
- uses the 60-second visible-tab feed poll only when the WebSocket is unavailable.

Once stable, remove steady-state alert polling entirely.

### Stage 4 - finish multiplayer push

- migrate Othello's 12-second remote match refresh to the existing hibernating match WebSocket;
- implement invitation waiting/rematch navigation from the player event stream rather than 1.2-second invitation polling;
- keep one explicit refresh on reconnect to close any missed-event window;
- retain HTTP action authority.

### Stage 5 - explicit Durable Object services and typed RPC

Introduce new classes/bindings incrementally. Prefer typed Durable Object RPC for Worker-to-object operations on new code. Do not perform a rewrite solely to save source lines; the purpose is explicit domain boundaries, typed contracts, and fewer accidental fan-out chains.

RPC is not a billing escape hatch: every RPC method call/session still counts as a Durable Object request. Design each public operation to do useful domain work in one actor rather than replacing one `fetch()` with several RPC calls.

### Stage 6 - read-model scalability

The current global directory/leaderboard object is acceptable for a small family deployment but is a known hotspot if GameFrame grows.

Before broad public scale:

- separate authoritative player state from global discovery/leaderboard projections;
- partition or move global analytical/read models to an appropriate store;
- keep leaderboard updates idempotent by event/accomplishment ID;
- batch low-priority projection work;
- ensure temporary read-model failure cannot reject an authoritative game action.

## Request-budget tests

Treat request budgets as product contracts, not dashboard observations.

Required regression tests should cover:

- idle Cascade for several seconds: one startup progression read, zero repeat reads, zero unchanged writes;
- failing progression endpoint: retries obey backoff rather than the local sampling interval;
- visible authenticated shell fallback: alert refresh cadence is bounded;
- hidden tab: no periodic alert/telemetry/progression network work;
- player feed GET: one player-object request, no directory/progression writes;
- player progression GET: one player-object request, no directory write;
- match GET: no player-feed projection write;
- healthy WebSocket match/player sessions: no HTTP poll while connected;
- WebSocket disconnect: one immediate reconciliation followed by capped backoff.

When practical, fake Durable Object namespaces should count calls by logical object and path. A route that unexpectedly grows from one call to four should fail tests before it reaches Cloudflare metrics.

## Operational budgets

For the current family-scale deployment, use conservative targets:

- ordinary idle page: effectively zero writes;
- player-shell fallback polling: <= 1 read/minute only while visible, then zero once player push is proven;
- cross-device progression reconciliation: <= 1 read/5 minutes while visible plus explicit foreground/online events;
- failed optional service: exponential backoff to a multi-minute ceiling;
- active telemetry checkpoint: <= 1 periodic event/5 minutes, with gameplay events batched separately;
- active multiplayer under healthy WebSocket: commands only, no periodic match reads.

These are engineering budgets. Cloudflare plan limits remain the hard outer constraint and should not be treated as a target utilization level.

## Review checklist for future agents

Before adding any timer, polling loop, heartbeat, presence touch, or read-model repair:

1. What is the maximum requests/day for one continuously open tab?
2. How many Durable Object calls and writes does one logical request fan out into?
3. What happens with five tabs or three family members?
4. Does the loop stop while hidden/idle?
5. Does failure back off, or does it retry at the normal cadence?
6. Could a mutation event or hibernating WebSocket replace the poll?
7. Is a GET causing a write?
8. Is one global Durable Object becoming a coordination bottleneck?
9. Is there a request-budget regression test?

If those questions are not answered, the feature is not ready to merge.
