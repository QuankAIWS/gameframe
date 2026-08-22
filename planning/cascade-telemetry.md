---
title: Cascade Crush Telemetry
status: active
document_type: architecture-note
owner: Scribbles GameFrame
last_updated: 2026-08-21
applies_to:
  - Cascade Crush
  - family playtesting
related:
  - casual-games-match3-foundation.md
  - architecture.md
  - testing-strategy.md
---

# Cascade Crush Telemetry

## Purpose

Cascade telemetry exists to measure puzzle quality, accessibility/input friction, progression, session behavior, bonus-mode performance, resource flow, and client technical health during family playtesting. It must remain failure-isolated from gameplay and must not turn ordinary offline-capable Cascade play into a high-frequency network workload.

The administrator experience remains one action: **PLAYTEST DATA → Download telemetry package**.

## Authority and delivery

```text
Cascade gameplay / bonus modes
  → bounded local research history
  → telemetry v2 capture boundary
  → acknowledged IndexedDB outbox
      ↳ bounded localStorage fallback if IndexedDB is unavailable
  → authenticated byte-bounded batch upload
  → per-player Cloudflare Durable Object telemetry custody
  → admin-only structured export
```

The 500-event research history remains a debugging surface; it is no longer the delivery guarantee. New events are assigned immutable IDs when captured and remain in the outbox until the server acknowledges them as accepted, duplicate, or rejected.

A malformed event must not poison later telemetry. The server validates events independently and returns per-event outcomes so rejected entries can be quarantined while later valid entries continue.

## Request budget

Telemetry must optimize information per request rather than requests per event.

- client flush interval: 5 seconds while the page is active;
- maximum batch: 24 events;
- client batch byte budget: 14 KB, below the existing 16 KB Worker JSON request boundary;
- session start/end/heartbeat records use the same outbox and batch path rather than dedicated one-event Durable Object calls;
- duplicate-only retry batches perform no Durable Object storage writes;
- hidden or idle tabs do not generate periodic heartbeats;
- event richness should normally increase payload information, not network request count.

This is a telemetry optimization only. Moving telemetry or other GameFrame responsibilities away from Durable Objects is a separate measured architecture decision after the telemetry contract is stable.

## Event identity and attempts

New telemetry events use immutable UUID identities. Legacy retained research events keep deterministic compatibility identities during one-time migration.

Normal levels, Blitz, and Quick Recall receive authoritative telemetry run IDs. The normal run ID is persisted into the saved active-run envelope so reload/resume retains one attempt identity instead of reconstructing attempts from timestamps afterward.

Attempt timing deliberately separates:

- `activeAttemptMs` — foreground, non-idle play attributed to that attempt;
- `wallDurationMs` — literal elapsed time between first and terminal events, including suspension/time away.

Use active time for puzzle pacing and difficulty analysis. Wall time is useful for suspension/return behavior but is not gameplay duration.

## Core event families

### Session and delivery

- `telemetry_session_start`
- `telemetry_session_heartbeat`
- `telemetry_session_end`
- telemetry health counters: generated, accepted, duplicate, rejected, failed upload, outbox failure/drop, payload truncation
- session client context: browser family, platform, language, timezone offset, viewport, DPR, touch capability, pointer coarseness, reduced-motion preference

### Normal progression

Existing normal-level events remain the mechanical event stream, including:

- level start/resume/win/failure;
- moves and invalid swaps;
- clears/cascade depth;
- special creation/activation/combination fields already emitted by the runtime;
- board shuffle;
- booster arm/use;
- tutorial events.

Level-start telemetry adds initial board/special state, initial RNG state, telemetry schema version, and rules version. These fields make bad-board and version-specific investigations reproducible without logging screen video or raw pointer coordinates.

Invalid swaps add board-cell `from`/`to`, input method, and a rejection reason when observable. Raw screen coordinates and keystroke contents are intentionally not retained.

### Resources

`resource_change` records important hammer/life source and sink transitions with before/after balances. The purpose is to measure resource availability and usage, not to create a monetization system.

### Blitz

Track offer, start, completion, skip, and abandonment. Completed runs retain score, match/special/cascade metrics and active run duration. Export reconstruction treats `blitz_complete` as a terminal attempt.

### Quick Recall

Track offer, start, skip, abandonment, completion, and one `quick_recall_round_complete` summary per round. Round summaries retain sequence length, sequence/response identities, correct count, perfect/not-perfect, first-input latency, and response duration. This avoids noisy per-animation telemetry while preserving the information needed to tune the memory task.

### Technical health

Technical telemetry is aggregated and piggybacks on the normal outbox:

- bounded JavaScript/unhandled-rejection errors;
- navigation/load timing;
- connection hints when the browser exposes them;
- Long Task count/total/max duration when supported;
- JS heap snapshot when supported.

Technical telemetry must never become a polling dependency or gameplay authority.

## Export contract

The admin package keeps raw events and derived player/session/attempt rows.

Schema v2 adds:

- active vs wall attempt duration;
- complete/skipped/abandoned bonus outcomes;
- input/invalid-swap summaries;
- resource source/sink summaries;
- Blitz and Quick Recall funnel counts;
- telemetry delivery-health summaries.

`averageCompletedAttemptMs` remains temporarily for compatibility but means wall-clock duration and is deprecated for balancing. Use `averageActiveAttemptMs` for gameplay analysis.

## Data minimization

Do not collect data merely because the browser exposes it. Cascade telemetry intentionally avoids:

- raw pointer coordinates in persisted events;
- keystroke contents;
- unrelated browsing history;
- precise geolocation;
- device fingerprinting identifiers;
- DOM or screen recordings.

Prefer deterministic gameplay state (board, RNG state, moves, resources, outcomes) over high-volume observational data.

## Validation requirements

Telemetry changes require:

1. syntax validation for every telemetry browser module;
2. persistence/deduplication and malformed-event server contracts;
3. batch-size/chunking contracts;
4. exporter tests for active timing and bonus terminal states;
5. browser proof that retained history migrates into batches larger than the old five-event ceiling;
6. browser proof that an attempt ID survives normal-run reload/resume;
7. browser proof that invalid-swap context is retained.

The exact final feature head still requires the repository's deliberate Canonical Validation gate before merge.

## Follow-up: Durable Object request audit

Do not infer total Durable Object usage from the Cloudflare account-wide request card. After telemetry v2 is stable, measure concrete request budgets for representative journeys:

```text
browser action
→ Worker request(s)
→ Durable Object subrequest(s)
→ Durable Object storage reads/writes
```

At minimum measure GameFrame shell/card loading, Cascade open/idle/normal level/Blitz/Quick Recall/progression synchronization, invitations, profiles/leaderboard, and multiplayer games.

Then retain Durable Objects only where their coordination/serialization/realtime actor properties justify consuming the constrained quota. Static/offline UI and ordinary offline Cascade play must not require a healthy Durable Object merely to render.
